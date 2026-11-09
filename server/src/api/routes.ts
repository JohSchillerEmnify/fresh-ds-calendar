import { Hono, type Context } from 'hono';
import type { Ctx } from '../context.js';
import { VERSION } from '../context.js';
import { readApkInfo } from '../routes/download.js';
import { enabledPlugins } from '../plugins/registry.js';
import { ApiException, validation, notFound } from '../lib/errors.js';
import { templateNotFound } from '../services/templateStore.js';
import { formatInZone } from '../lib/time.js';
import { parsePrefsPatch } from '@calendar/shared/prefs';
import { canvasDocSchema, defaultRemindersSchema, calendarColorPickSchema, createBirthdaySchema, createEventSchema, parse, parseTemplate, updateEventSchema } from '../lib/validation.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';
import { registerChanges } from './changesRoutes.js';
import { alsoRange, body, range, type RouteDeps } from './routeHelpers.js';
import { registerSettings } from './settingsRoutes.js';
import { registerTaskLists } from './taskListRoutes.js';
import { registerThemes, themeReaders } from './themeRoutes.js';
import { kindsOfPath } from '../services/changeBus.js';
import { isSharedId } from '../services/sharedLists.js';

const HEALTH_TTL_MS = 10_000;


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
  const { motivation, config } = ctx;
  // the signed-in person's calendar (the shared one while auth is off)
  const cal = (c: Context) => ctx.calendarFor((c.get('person') as { sub: string } | undefined)?.sub);
  const tz = config.tz;
  // whose preferences apply: the signed-in person, `local` while auth is off
  const person = (c: Context) => (ctx.auth.on ? (c.get('person') as { sub: string } | undefined)?.sub : undefined) ?? LOCAL_PERSON;
  const deps: RouteDeps = { r, ctx, person, cal };

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
    const b = (await body(c)) as { hidden?: unknown; defaultReminders?: unknown; color?: unknown; colorId?: unknown } | undefined;
    // `hidden` (this person's choice), `defaultReminders` (Google's popup defaults) and/or `color` (the person's list colour)
    if (b?.hidden === undefined && b?.defaultReminders === undefined && b?.color === undefined && b?.colorId === undefined) throw validation('hidden must be a boolean', 'hidden');
    if (b.hidden !== undefined && typeof b.hidden !== 'boolean') throw validation('hidden must be a boolean', 'hidden');
    const minutes = b.defaultReminders === undefined ? undefined : parse(defaultRemindersSchema, b.defaultReminders);
    if (!(await cal(c).calendars()).some((x) => x.id === id)) throw notFound('Calendar not found');
    if (minutes) await cal(c).setDefaultReminders(id, minutes);
    if (b.color !== undefined || b.colorId !== undefined) await cal(c).setColor(id, parse(calendarColorPickSchema, { color: b.color, colorId: b.colorId }));
    if (typeof b.hidden === 'boolean') ctx.prefs.setHidden(person(c), id, b.hidden);
    const k = (await cal(c).calendars()).find((x) => x.id === id)!;
    return c.json({ ...k, hidden: ctx.prefs.hiddenCalendars(person(c)).includes(id) });
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

  // ---- per-person theme and imported themes ----
  const readers = themeReaders(ctx);
  registerThemes(deps, readers);

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

  registerChanges(r, ctx, { person, cal, theme: readers.themeOf, themes: readers.themesOf });

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



  registerTaskLists(deps);
  registerSettings(deps);

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
