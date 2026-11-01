import { Hono, type Context } from 'hono';
import type { Category, InkStroke } from './types.js';
import type { Ctx } from '../context.js';
import { VERSION } from '../context.js';
import { readApkInfo } from '../routes/download.js';
import { enabledPlugins } from '../plugins/registry.js';
import { ApiException, preconditionFailed, validation, notFound } from '../lib/errors.js';
import { templateNotFound } from '../services/templateStore.js';
import { isLocalDate, formatInZone, dayNumber } from '../lib/time.js';
import { nearestGoogleColorId } from '@calendar/shared/colors';
import { nanoid } from '../lib/ids.js';
import { MAX_THEME_BYTES, sanitizePicture, validatePicture, validateTheme, type ThemePicture } from '@calendar/shared';
import { parsePrefsPatch } from '@calendar/shared/prefs';
import { mergeInk, visibleInk } from '@calendar/shared/ink';
import { INK_STROKES_MAX } from '@calendar/shared/limits';
import { themeFitsSize } from '../services/themeStore.js';
import { loadSvgSanitizer } from '../lib/svg.js';
import {
  addItemSchema, canvasDocSchema, inkSchema, defaultRemindersSchema, categoryCreateSchema, categoryOrderSchema, categoryPatchSchema, createBirthdaySchema, createEventSchema, createTaskListSchema, orderSchema,
  categoryShareSchema, parse, patchItemSchema, shareSchema, settingsPatchSchema, parseTemplate, themePatchSchema, updateEventSchema, updateTaskListSchema,
} from '../lib/validation.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';
import { withGoogleColor } from '../services/settingsStore.js';
import type { Scope } from '../services/calendar.js';
import { registerChanges } from './changesRoutes.js';
import { kindsOfPath } from '../services/changeBus.js';
import { isSharedId } from '../services/sharedLists.js';

const HEALTH_TTL_MS = 10_000;

/** The ids of a list's handwritten items. */
/** How far ahead of the server's clock a device's stroke time may be (ms); beyond it the time is cut back. */
const INK_SKEW_MS = 5 * 60_000;
const inkIds = (l: { items: { id: string; ink?: true }[] }): string[] => l.items.filter((i) => i.ink).map((i) => i.id);

/** The list holds all the ink it may (decision Q3); the web app suggests a new list. */
const inkFull = () => new ApiException('PAYLOAD_TOO_LARGE', 413, 'This list is full of ink. Start a new list.', undefined, 'tasklist.inkFull');

async function body(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function dateParam(c: Context, name: string): string {
  const v = c.req.query(name);
  if (!v || !isLocalDate(v)) throw validation(`${name} must be a date (YYYY-MM-DD)`, name);
  return v;
}

/** `?scope=` of a task list change: `following` = this and all later occurrences of a repeating list (feature tasklist-repeating); absent or `this` = the given id. */
function scopeOf(c: Context): Scope {
  const v = c.req.query('scope');
  if (v === undefined || v === 'this') return undefined;
  if (v === 'following') return 'following';
  throw validation('scope must be this or following', 'scope');
}

function checkRange(from: string, to: string, maxDays: number, field: string): { from: string; to: string } {
  if (to <= from) throw validation('to must be after from', field);
  if (dayNumber(to) - dayNumber(from) > maxDays) throw validation(`Range must be at most ${maxDays} days`, field);
  return { from, to };
}

function range(c: Context, maxDays: number): { from: string; to: string } {
  return checkRange(dateParam(c, 'from'), dateParam(c, 'to'), maxDays, 'to');
}

/** The optional `also=YYYY-MM-DD..YYYY-MM-DD` range (same rules as `from`/`to`). */
function alsoRange(c: Context, maxDays: number): { from: string; to: string } | undefined {
  const v = c.req.query('also');
  if (v === undefined) return undefined;
  const [from, to, ...rest] = v.split('..');
  if (rest.length || !from || !to || !isLocalDate(from) || !isLocalDate(to)) {
    throw validation('also must be a range (YYYY-MM-DD..YYYY-MM-DD)', 'also');
  }
  return checkRange(from, to, maxDays, 'also');
}

export function configResponse(ctx: Ctx) {
  return {
    now: ctx.clock.now().toISOString(),
    clockFrozen: ctx.clock.frozen,
    timeZone: ctx.config.tz,
    weekStartsOn: 1 as const,
    pollIntervalMs: ctx.overrides.pollIntervalMs ?? ctx.config.pollIntervalMs,
    provider: ctx.provider.name,
    testMode: ctx.config.testMode,
    publicUrl: ctx.config.publicUrl,
    version: ctx.overrides.version ?? VERSION,
    apk: ctx.overrides.apk !== undefined ? ctx.overrides.apk : readApkInfo(ctx.config.dataDir),
    plugins: enabledPlugins(ctx),
    // TEST_MODE: the server's own stand-ins (testRoutes.ts), so a test never reaches the real hosts
    placeSearchUrl: ctx.config.testMode ? '/api/__test/photon' : ctx.config.places.searchUrl,
    mapTileUrl: ctx.config.testMode ? '/api/__test/tiles/{z}/{x}/{y}.png' : ctx.config.places.tileUrl,
  };
}

export function apiRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  const { settings, motivation, config } = ctx;
  // the signed-in person's calendar (the shared one while auth is off)
  const cal = (c: Context) => ctx.calendarFor((c.get('person') as { sub: string } | undefined)?.sub);
  const tz = config.tz;
  // whose preferences apply: the signed-in person, `local` while auth is off
  const person = (c: Context) => (ctx.auth.on ? (c.get('person') as { sub: string } | undefined)?.sub : undefined) ?? LOCAL_PERSON;

  // Mutations that awarded plant points are flagged so the client refetches /api/motivation.
  r.use('*', async (c, next) => {
    const before = motivation.rev;
    await next();
    if (motivation.rev !== before && c.req.method !== 'GET') c.header('X-Motivation-Changed', '1');
  });

  // Reads answered while Google's rate limit is in force come from the server's cache: say so.
  r.use('*', async (c, next) => {
    await next();
    if (c.req.method === 'GET' && c.res.status === 200 && cal(c).stale()) c.header('X-Stale', '1');
  });

  // Every successful write is reported once on the change bus (who is affected, which kind of data); a publisher listens there.
  const sharedPeople = (sub: string, id: string | undefined): string[] => {
    if (!id || !isSharedId(id)) return [];
    try {
      const d = ctx.shared.access(sub, id);
      return [d.owner, ...d.members];
    } catch {
      return [];
    }
  };
  r.use('*', async (c, next) => {
    const path = c.req.path.replace(/^\/api/, '');
    const kinds = c.req.method === 'GET' ? [] : kindsOfPath(path);
    const listId = /^\/tasklists\/([^/]+)/.exec(path)?.[1];
    const me = person(c);
    // the members are read before the write too: a delete or a leave removes the list they are found by
    const rulePeople = () => (path.startsWith('/categories') ? Object.values(ctx.shared.rulesOf(me)).map((p) => p.sub) : []);
    const before = kinds.length ? [...sharedPeople(me, listId), ...rulePeople()] : [];
    await next();
    if (!kinds.length || c.res.status >= 400) return;
    const shown = (await c.res.clone().json().catch(() => null)) as { id?: unknown } | null;
    const own = [me, ...before, ...sharedPeople(me, listId), ...sharedPeople(me, typeof shown?.id === 'string' ? shown.id : undefined),
      ...rulePeople()];
    for (const k of kinds) ctx.changes.emit(own, k);
  });

  // ---- health / config ----
  r.get('/health', async (c) => {
    const now = ctx.clock.real();
    let status = ctx.health && now - ctx.health.at < HEALTH_TTL_MS && !ctx.mock?.isDown ? ctx.health.status : null;
    if (!status) {
      try {
        // per-person Google access cannot be probed without a person
        if (!ctx.personProvider) await ctx.provider.ping();
        status = 'ok';
      } catch {
        status = 'unavailable';
      }
      ctx.health = ctx.mock?.isDown ? null : { at: now, status };
    }
    return c.json({ status: 'ok', provider: ctx.provider.name, providerStatus: status, version: VERSION, time: formatInZone(now, tz), testMode: config.testMode, plugins: enabledPlugins(ctx) });
  });

  r.get('/config', (c) => c.json(configResponse(ctx)));
  // The plain-English lines of CHANGELOG.md, newest first (feature release-notes).
  r.get('/release-notes', (c) => c.json({ notes: ctx.overrides.notes ?? ctx.releaseNotes }));

  r.get('/calendars', async (c) => {
    const hidden = ctx.prefs.hiddenCalendars(person(c));
    return c.json({ calendars: (await cal(c).calendars()).map((k) => ({ ...k, hidden: hidden.includes(k.id) })) });
  });
  r.patch('/calendars/:id', async (c) => {
    const id = c.req.param('id');
    const b = (await body(c)) as { hidden?: unknown; defaultReminders?: unknown } | undefined;
    // `hidden` (this person's choice) and/or `defaultReminders` (Google's popup defaults of the calendar)
    if (b?.hidden === undefined && b?.defaultReminders === undefined) throw validation('hidden must be a boolean', 'hidden');
    if (b.hidden !== undefined && typeof b.hidden !== 'boolean') throw validation('hidden must be a boolean', 'hidden');
    const minutes = b.defaultReminders === undefined ? undefined : parse(defaultRemindersSchema, b.defaultReminders);
    if (!(await cal(c).calendars()).some((x) => x.id === id)) throw notFound('Calendar not found');
    if (minutes) await cal(c).setDefaultReminders(id, minutes);
    if (typeof b.hidden === 'boolean') ctx.prefs.setHidden(person(c), id, b.hidden);
    const hidden = ctx.prefs.hiddenCalendars(person(c));
    const k = (await cal(c).calendars()).find((x) => x.id === id)!;
    return c.json({ ...k, hidden: hidden.includes(id) });
  });
  // The tasks calendar is not in the calendar list; its reminder default is edited here (feature reminders).
  r.get('/reminders/tasks-calendar', async (c) => c.json({ defaultReminders: await cal(c).tasksDefaultReminders() }));
  r.patch('/reminders/tasks-calendar', async (c) => {
    const b = (await body(c)) as { defaultReminders?: unknown } | undefined;
    return c.json({ defaultReminders: await cal(c).setDefaultReminders('', parse(defaultRemindersSchema, b?.defaultReminders), true) });
  });

  r.get('/prefs', (c) => c.json(ctx.prefs.labsPrefs(person(c))));
  r.patch('/prefs', async (c) => {
    const b = ((await body(c)) ?? {}) as Record<string, unknown>;
    // validate every field first, so a bad value changes neither Google nor the stored prefs
    const parsed = parsePrefsPatch(b, ctx.prefs.labsPrefs(person(c)));
    if ('error' in parsed) throw validation(parsed.error, parsed.field);
    // "Show tasks calendar in Google" changes Google's calendar list first, so a failure stores nothing
    const { tasksCalendarVisible, ...patch } = parsed.patch;
    if (tasksCalendarVisible !== undefined) await cal(c).tasks.setVisible(tasksCalendarVisible);
    return c.json(ctx.prefs.setLabs(person(c), patch));
  });
  // ---- per-person theme ----
  const themeOf = (sub: string) => {
    ctx.prefs.migrateScene(sub, settings.legacyTopBarScene(sub));
    ctx.prefs.migrateGarden(sub, settings.legacyGarden(sub));
    return ctx.prefs.theme(sub);
  };
  const themesOf = (sub: string) => ({ themes: ctx.themes.list(sub).map(({ id, doc, picture }) => ({ id, doc, ...(picture ? { picture } : {}) })) });
  r.get('/prefs/theme', (c) => c.json(themeOf(person(c))));
  r.patch('/prefs/theme', async (c) => c.json(ctx.prefs.setTheme(person(c), parse(themePatchSchema, await body(c)))));

  // ---- imported themes ----
  r.get('/themes', (c) => c.json(themesOf(person(c))));
  r.post('/themes', async (c) => {
    const b = await body(c);
    const fail = (errors: string[]) => new ApiException('VALIDATION_ERROR', 400, errors[0]!, errors.map((issue) => ({ issue })));
    if (typeof b !== 'object' || b === null || Array.isArray(b)) throw fail(['Request body must be a JSON object']);
    const unknown = Object.keys(b).filter((k) => k !== 'theme' && k !== 'picture');
    if (unknown.length) throw fail(unknown.map((k) => `${k} is not a known field`));
    const { theme, picture } = b as { theme?: unknown; picture?: unknown };
    const doc = validateTheme(theme);
    if (!doc.ok) throw fail(doc.errors);
    if (!themeFitsSize(theme)) throw fail([`The theme must be at most ${MAX_THEME_BYTES / 1024} KB`]);
    let clean: ThemePicture | undefined;
    let removed = false;
    if (picture !== undefined) {
      const valid = validatePicture(picture);
      if (!valid.ok) throw fail(valid.errors);
      // the sanitiser (jsdom) is only loaded for a theme that brings a picture
      const safe = sanitizePicture(await loadSvgSanitizer(), valid.picture);
      if (!safe.ok) throw fail(safe.errors);
      clean = safe.picture;
      removed = safe.removed;
    }
    const saved = ctx.themes.add(person(c), doc.doc, clean);
    return c.json({ id: saved.id, doc: saved.doc, ...(clean ? { picture: clean } : {}), sanitized: removed }, 201);
  });
  r.delete('/themes/:id', (c) => {
    if (!ctx.themes.remove(person(c), c.req.param('id'))) throw notFound('Theme not found');
    return c.body(null, 204);
  });

  // ---- canvas areas (feature tasks-canvas) ----
  r.get('/canvas', (c) => c.json(ctx.canvas.get(person(c))));
  r.put('/canvas', async (c) => c.json(ctx.canvas.put(person(c), parse(canvasDocSchema, await body(c)).areas)));

  // ---- task list templates (feature tasklist-templates) ----
  r.get('/templates', (c) => c.json({ templates: ctx.templates.list(person(c)) }));
  r.post('/templates', async (c) => c.json(ctx.templates.add(person(c), parseTemplate(await body(c))), 201));
  r.put('/templates/:id', async (c) => c.json(ctx.templates.replace(person(c), c.req.param('id'), parseTemplate(await body(c)))));
  r.delete('/templates/:id', (c) => {
    if (!ctx.templates.remove(person(c), c.req.param('id'))) throw templateNotFound();
    return c.body(null, 204);
  });

  registerChanges(r, ctx, { person, cal, theme: themeOf, themes: themesOf });

  // ---- items ----
  r.get('/items', async (c) => {
    const { from, to } = range(c, 100);
    const also = alsoRange(c, 100);
    const ids = c.req.query('calendarIds')?.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await cal(c).items(from, to, ids, also);
    // the widget cannot filter by the person's hidden calendars itself, so it asks the server to
    if (c.req.query('excludeHidden') === '1') {
      const hidden = new Set(ctx.prefs.hiddenCalendars(person(c)));
      res.items = res.items.filter((i) => !hidden.has(i.calendarId));
    }
    return c.json(res);
  });

  r.get('/summary', async (c) => {
    const { from, to } = range(c, 400);
    return c.json({ days: await cal(c).summary(from, to) });
  });

  // ---- events ----
  r.post('/events', async (c) => {
    const b = await body(c);
    // a birthday has its own body (name, day, colour): Google accepts nothing else on it
    if ((b as { kind?: unknown } | undefined)?.kind === 'birthday') return c.json(await cal(c).createBirthday(parse(createBirthdaySchema, b)), 201);
    return c.json(await cal(c).createEvent(parse(createEventSchema, b)), 201);
  });
  r.get('/events/:id', async (c) => c.json(await cal(c).getEvent(c.req.param('id'))));
  r.patch('/events/:id', async (c) => c.json(await cal(c).updateEvent(c.req.param('id'), parse(updateEventSchema, await body(c)), c.req.header('If-Match'))));
  r.delete('/events/:id', async (c) => {
    await cal(c).deleteEvent(c.req.param('id'), c.req.header('If-Match'));
    return c.body(null, 204);
  });

  // ---- task lists ----
  r.get('/tasklists/open', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    const daysRaw = c.req.query('days');
    const days = daysRaw === undefined ? 30 : Number(daysRaw);
    if (!Number.isInteger(days) || days < 0 || days > 90) throw validation('days must be 0-90', 'days');
    return c.json(await cal(c).openTaskLists(today, days));
  });
  r.get('/tasklists/all-open', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    return c.json(await cal(c).allOpenTaskLists(today));
  });
  r.get('/tasklists/archive', async (c) => {
    const today = c.req.query('today') ?? ctx.motivation.today();
    if (!isLocalDate(today)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    return c.json(await cal(c).archivedTaskLists(today));
  });
  r.post('/tasklists', async (c) => {
    const input = parse(createTaskListSchema, await body(c));
    const kept = (input.items ?? []).filter((i) => i.title.trim() || i.strokes);
    if (!ctx.inks.fitsNew(kept.flatMap((i) => (i.strokes ? [i.strokes as InkStroke[]] : [])))) throw inkFull();
    const list = await cal(c).createTaskList(input);
    // ink items keep their strokes in the ink store, under the ids the list gave them (same order as the kept input)
    list.items.forEach((item, n) => { const s = kept[n]?.strokes; if (s) ctx.inks.set(person(c), list.id, item.id, s as InkStroke[]); });
    return c.json(list, 201);
  });
  r.get('/tasklists/:id', async (c) => c.json(await cal(c).getTaskList(c.req.param('id'))));
  r.patch('/tasklists/:id', async (c) => c.json(await cal(c).updateTaskList(c.req.param('id'), parse(updateTaskListSchema, await body(c)), c.req.header('If-Match'), scopeOf(c))));
  r.delete('/tasklists/:id', async (c) => {
    const before = await cal(c).getTaskList(c.req.param('id'));
    await cal(c).deleteTaskList(c.req.param('id'), c.req.header('If-Match'));
    if (!before.seriesId && !isSharedId(c.req.param('id'))) ctx.inks.remove(person(c), c.req.param('id'), inkIds(before));
    return c.body(null, 204);
  });
  // ---- sharing (feature shared-lists) ----
  r.get('/people', (c) => c.json({ people: ctx.shared.candidates(person(c)) }));
  r.post('/tasklists/:id/share', async (c) => c.json(await cal(c).shareTaskList(c.req.param('id'), parse(shareSchema, await body(c)).person)));
  r.delete('/tasklists/:id/share', async (c) => c.json(await cal(c).unshareTaskList(c.req.param('id'))));
  r.post('/tasklists/:id/leave', (c) => {
    cal(c).leaveTaskList(c.req.param('id'));
    return c.body(null, 204);
  });
  r.get('/categories/shares', (c) => c.json({ shares: ctx.shared.rulesOf(person(c)) }));
  r.put('/categories/:id/share', async (c) => c.json({ shares: await cal(c).shareCategory(c.req.param('id'), parse(categoryShareSchema, await body(c)).person) }));
  // ---- handwritten items (feature handwritten-lists): the item is in the list, its strokes in the ink store ----
  r.get('/ink', (c) => c.json(ctx.inks.doc(person(c))));
  r.post('/tasklists/:id/items', async (c) => {
    const input = parse(addItemSchema, await body(c));
    const sub = person(c);
    const listId = c.req.param('id');
    if (input.strokes === undefined) {
      if (input.title === undefined) throw validation('Item title is required', 'title');
      return c.json(await cal(c).addItem(listId, { ...input, title: input.title }, scopeOf(c)), 201);
    }
    if (input.title !== undefined) throw validation('An ink item has no title', 'title');
    const itemId = input.id ?? nanoid();
    const strokes = input.strokes as InkStroke[];
    const before = await cal(c).getTaskList(listId);
    if (!ctx.inks.fits(sub, listId, inkIds(before), itemId, strokes)) throw inkFull();
    const list = await cal(c).addItem(listId, { ...input, id: itemId, title: '', ink: true }, scopeOf(c));
    // a repeated request finds the item already there: its ink is stored once, and only for an ink item
    if (list.items.find((i) => i.id === itemId)?.ink) ctx.inks.set(sub, listId, itemId, strokes);
    return c.json(list, 201);
  });
  r.put('/tasklists/:id/items/:itemId/ink', async (c) => {
    const { strokes: sent, base, at } = parse(inkSchema, await body(c));
    const sub = person(c);
    const [listId, itemId] = [c.req.param('id'), c.req.param('itemId')];
    const list = await cal(c).getTaskList(listId);
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw notFound('Item not found');
    if (!item.ink) throw validation('Only a handwritten item holds ink', 'itemId');
    // a change that says where it started from is merged with what other devices wrote meanwhile (decision G5)
    // the wall clock, as the devices' own clocks are (the app clock of a test can stand still)
    const nowMs = ctx.clock.real();
    // a stroke time far ahead of the server's clock would make the stroke survive every erase: it counts as at most a little ahead
    const drawn = (sent as InkStroke[]).map((s) => (s.t !== undefined && s.t > nowMs + INK_SKEW_MS ? { ...s, t: nowMs + INK_SKEW_MS } : s));
    const strokes = base ? mergeInk(ctx.inks.get(sub, listId, itemId), drawn, base, Math.min(at ?? nowMs, nowMs)) : drawn;
    // a merge can add to what the device saw: what one item holds stays within what a request may carry
    if (visibleInk(strokes).length > INK_STROKES_MAX || !ctx.inks.fits(sub, listId, inkIds(list), itemId, strokes)) throw inkFull();
    ctx.inks.set(sub, listId, itemId, strokes);
    // the answer carries what the item holds now: a merge may have added strokes the device has not seen
    return c.json({ ...(await cal(c).getTaskList(listId)), ink: { [itemId]: strokes } });
  });
  r.put('/tasklists/:id/items/order', async (c) => c.json(await cal(c).reorder(c.req.param('id'), parse(orderSchema, await body(c)).itemIds)));
  r.patch('/tasklists/:id/items/:itemId', async (c) => c.json(await cal(c).patchItem(c.req.param('id'), c.req.param('itemId'), parse(patchItemSchema, await body(c)), scopeOf(c))));
  r.delete('/tasklists/:id/items/:itemId', async (c) => {
    const [listId, itemId, scope] = [c.req.param('id'), c.req.param('itemId'), scopeOf(c)];
    const before = await cal(c).getTaskList(listId);
    const list = await cal(c).deleteItem(listId, itemId, scope);
    // one occurrence of a repeating list losing the item leaves it to the others (the ink is shared by item id)
    if (before.items.find((i) => i.id === itemId)?.ink && (scope === 'following' || !before.seriesId)) ctx.inks.remove(person(c), listId, [itemId]);
    return c.json(list);
  });

  // ---- settings / categories ----
  r.get('/settings', (c) => c.json(settings.get(person(c))));
  r.patch('/settings', async (c) => {
    // an app not yet updated may still send the retired `defaultEventColorId`: dropped, so its other settings still save
    const raw = await body(c);
    const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
    const rest = isObject ? { ...(raw as Record<string, unknown>) } : raw;
    if (isObject) delete (rest as Record<string, unknown>).defaultEventColorId;
    const patch = parse(settingsPatchSchema, rest);
    const im = c.req.header('If-Match');
    if (im !== undefined && String(settings.get(person(c)).version) !== im.replaceAll('"', '').trim()) throw preconditionFailed('Settings were changed elsewhere. Reload and try again.');
    return c.json(
      settings.update(person(c), (d) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          (d as unknown as Record<string, unknown>)[k] = k === 'seedColor' ? (v as string).toLowerCase() : v;
        }
      }),
    );
  });

  const uniqueName = (cats: Category[], name: string, exceptId?: string) => {
    if (cats.some((x) => x.id !== exceptId && x.name.toLowerCase() === name.toLowerCase())) {
      throw validation('A category with this name already exists', 'name', 'category.nameExists');
    }
  };

  r.post('/categories', async (c) => {
    const b = parse(categoryCreateSchema, await body(c));
    uniqueName(settings.categories(person(c)), b.name);
    return c.json(
      settings.update(person(c), (d) => {
        d.categories.push(withGoogleColor({ id: nanoid(), name: b.name, color: b.color.toLowerCase(), icon: b.icon ?? null }));
      }),
      201,
    );
  });
  r.put('/categories/order', async (c) => {
    const { categoryIds } = parse(categoryOrderSchema, await body(c));
    const cur = settings.categories(person(c));
    if (categoryIds.length !== cur.length || new Set(categoryIds).size !== cur.length || categoryIds.some((i) => !cur.some((x) => x.id === i))) {
      throw validation('categoryIds must contain every category id exactly once', 'categoryIds');
    }
    return c.json(settings.update(person(c), (d) => { d.categories = categoryIds.map((i) => d.categories.find((x) => x.id === i)!); }));
  });
  r.patch('/categories/:id', async (c) => {
    const id = c.req.param('id');
    const b = parse(categoryPatchSchema, await body(c));
    if (!settings.categories(person(c)).some((x) => x.id === id)) throw notFound('Category not found');
    if (b.name !== undefined) uniqueName(settings.categories(person(c)), b.name, id);
    const saved = settings.update(person(c), (d) => {
      const cat = d.categories.find((x) => x.id === id)!;
      if (b.name !== undefined) cat.name = b.name;
      if (b.color !== undefined) { cat.color = b.color.toLowerCase(); cat.googleColorId = nearestGoogleColorId(cat.color); }
      if (b.icon !== undefined) cat.icon = b.icon;
    });
    // the people the owner shares lists of this category with see the new look
    const now = saved.categories.find((x) => x.id === id)!;
    ctx.shared.refreshCategory(person(c), id, { name: now.name, color: now.color, icon: now.icon });
    return c.json(saved);
  });
  r.delete('/categories/:id', (c) => {
    const id = c.req.param('id');
    if (!settings.categories(person(c)).some((x) => x.id === id)) throw notFound('Category not found');
    ctx.shared.refreshCategory(person(c), id, null);
    return c.json(settings.update(person(c), (d) => { d.categories = d.categories.filter((x) => x.id !== id); }));
  });

  // ---- motivation ----
  r.get('/motivation', (c) => c.json(motivation.get(person(c))));
  r.post('/streak/checkin', (c) => c.json(motivation.checkIn(person(c))));

  // ---- demo reset (mock mode only; documented in README) ----
  r.post('/demo/reset', async (c) => {
    if (!ctx.mock) throw new ApiException('NOT_FOUND', 404, 'Not found');
    ctx.mock.reset();
    ctx.calendar.invalidate();
    motivation.reset();
    await ctx.seed();
    ctx.changes.emitAll([...new Set([person(c), ...ctx.people.all().map((p) => p.sub)])]);
    return c.json({ ok: true });
  });

  return r;
}
