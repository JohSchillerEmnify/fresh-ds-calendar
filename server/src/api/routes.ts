import { Hono, type Context } from 'hono';
import type { Category } from './types.js';
import type { Ctx } from '../context.js';
import { VERSION } from '../context.js';
import { ApiException, preconditionFailed, validation, notFound } from '../lib/errors.js';
import { isLocalDate, formatInZone } from '../lib/time.js';
import { dayNumber } from '../lib/time.js';
import { nearestGoogleColorId } from '../lib/colors.js';
import { nanoid } from '../lib/ids.js';
import {
  addItemSchema, categoryCreateSchema, categoryOrderSchema, categoryPatchSchema, createEventSchema, createTaskListSchema, orderSchema,
  parse, patchItemSchema, settingsPatchSchema, themePatchSchema, updateEventSchema, updateTaskListSchema,
} from '../lib/validation.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';
import { withGoogleColor } from '../services/settingsStore.js';

const HEALTH_TTL_MS = 10_000;

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

function range(c: Context, maxDays: number): { from: string; to: string } {
  const from = dateParam(c, 'from');
  const to = dateParam(c, 'to');
  if (to <= from) throw validation('to must be after from', 'to');
  if (dayNumber(to) - dayNumber(from) > maxDays) throw validation(`Range must be at most ${maxDays} days`, 'to');
  return { from, to };
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
    return c.json({ status: 'ok', provider: ctx.provider.name, providerStatus: status, version: VERSION, time: formatInZone(now, tz), testMode: config.testMode });
  });

  r.get('/config', (c) => c.json(configResponse(ctx)));

  r.get('/calendars', async (c) => {
    const hidden = ctx.prefs.hiddenCalendars(person(c));
    return c.json({ calendars: (await cal(c).calendars()).map((k) => ({ ...k, hidden: hidden.includes(k.id) })) });
  });
  r.patch('/calendars/:id', async (c) => {
    const id = c.req.param('id');
    const b = (await body(c)) as { hidden?: unknown } | undefined;
    if (typeof b?.hidden !== 'boolean') throw validation('hidden must be a boolean', 'hidden');
    const k = (await cal(c).calendars()).find((x) => x.id === id);
    if (!k) throw notFound('Calendar not found');
    ctx.prefs.setHidden(person(c), id, b.hidden);
    return c.json({ ...k, hidden: b.hidden });
  });

  r.get('/prefs', (c) => c.json({ ...ctx.prefs.labsPrefs(person(c)), tasksCalendarVisible: cal(c).tasks.visible() }));
  r.patch('/prefs', async (c) => {
    const b = ((await body(c)) ?? {}) as Record<string, unknown>;
    const patch: { labs?: boolean; approachBar?: boolean } = {};
    for (const k of ['labs', 'approachBar', 'tasksCalendarVisible'] as const) {
      if (b[k] !== undefined && typeof b[k] !== 'boolean') throw validation(`${k} must be a boolean`, k);
    }
    for (const k of ['labs', 'approachBar'] as const) if (b[k] !== undefined) patch[k] = b[k] as boolean;
    // "Show tasks calendar in Google" changes Google's calendar list first, so a failure stores nothing
    if (b.tasksCalendarVisible !== undefined) await cal(c).tasks.setVisible(b.tasksCalendarVisible as boolean);
    return c.json({ ...ctx.prefs.setLabs(person(c), patch), tasksCalendarVisible: cal(c).tasks.visible() });
  });
  // ---- per-person theme ----
  r.get('/prefs/theme', (c) => c.json(ctx.prefs.theme(person(c))));
  r.patch('/prefs/theme', async (c) => c.json(ctx.prefs.setTheme(person(c), parse(themePatchSchema, await body(c)))));

  // ---- items ----
  r.get('/items', async (c) => {
    const { from, to } = range(c, 100);
    const ids = c.req.query('calendarIds')?.split(',').map((s) => s.trim()).filter(Boolean);
    return c.json(await cal(c).items(from, to, ids));
  });

  r.get('/summary', async (c) => {
    const { from, to } = range(c, 400);
    return c.json({ days: await cal(c).summary(from, to) });
  });

  // ---- events ----
  r.post('/events', async (c) => c.json(await cal(c).createEvent(parse(createEventSchema, await body(c))), 201));
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
  r.post('/tasklists', async (c) => c.json(await cal(c).createTaskList(parse(createTaskListSchema, await body(c))), 201));
  r.get('/tasklists/:id', async (c) => c.json(await cal(c).getTaskList(c.req.param('id'))));
  r.patch('/tasklists/:id', async (c) => c.json(await cal(c).updateTaskList(c.req.param('id'), parse(updateTaskListSchema, await body(c)), c.req.header('If-Match'))));
  r.delete('/tasklists/:id', async (c) => {
    await cal(c).deleteTaskList(c.req.param('id'), c.req.header('If-Match'));
    return c.body(null, 204);
  });
  r.post('/tasklists/:id/items', async (c) => c.json(await cal(c).addItem(c.req.param('id'), parse(addItemSchema, await body(c))), 201));
  r.put('/tasklists/:id/items/order', async (c) => c.json(await cal(c).reorder(c.req.param('id'), parse(orderSchema, await body(c)).itemIds)));
  r.patch('/tasklists/:id/items/:itemId', async (c) => c.json(await cal(c).patchItem(c.req.param('id'), c.req.param('itemId'), parse(patchItemSchema, await body(c)))));
  r.delete('/tasklists/:id/items/:itemId', async (c) => c.json(await cal(c).deleteItem(c.req.param('id'), c.req.param('itemId'))));

  // ---- settings / categories ----
  r.get('/settings', (c) => c.json(settings.get()));
  r.patch('/settings', async (c) => {
    const patch = parse(settingsPatchSchema, await body(c));
    const im = c.req.header('If-Match');
    if (im !== undefined && String(settings.get().version) !== im.replaceAll('"', '').trim()) throw preconditionFailed('Settings were changed elsewhere. Reload and try again.');
    return c.json(
      settings.update((d) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          (d as unknown as Record<string, unknown>)[k] = k === 'seedColor' ? (v as string).toLowerCase() : v;
        }
      }),
    );
  });

  const uniqueName = (cats: Category[], name: string, exceptId?: string) => {
    if (cats.some((x) => x.id !== exceptId && x.name.toLowerCase() === name.toLowerCase())) {
      throw validation('A category with this name already exists', 'name');
    }
  };

  r.post('/categories', async (c) => {
    const b = parse(categoryCreateSchema, await body(c));
    uniqueName(settings.categories(), b.name);
    return c.json(
      settings.update((d) => {
        d.categories.push(withGoogleColor({ id: nanoid(), name: b.name, color: b.color.toLowerCase(), icon: b.icon ?? null }));
      }),
      201,
    );
  });
  r.put('/categories/order', async (c) => {
    const { categoryIds } = parse(categoryOrderSchema, await body(c));
    const cur = settings.categories();
    if (categoryIds.length !== cur.length || new Set(categoryIds).size !== cur.length || categoryIds.some((i) => !cur.some((x) => x.id === i))) {
      throw validation('categoryIds must contain every category id exactly once', 'categoryIds');
    }
    return c.json(settings.update((d) => { d.categories = categoryIds.map((i) => d.categories.find((x) => x.id === i)!); }));
  });
  r.patch('/categories/:id', async (c) => {
    const id = c.req.param('id');
    const b = parse(categoryPatchSchema, await body(c));
    if (!settings.categories().some((x) => x.id === id)) throw notFound('Category not found');
    if (b.name !== undefined) uniqueName(settings.categories(), b.name, id);
    return c.json(
      settings.update((d) => {
        const cat = d.categories.find((x) => x.id === id)!;
        if (b.name !== undefined) cat.name = b.name;
        if (b.color !== undefined) { cat.color = b.color.toLowerCase(); cat.googleColorId = nearestGoogleColorId(cat.color); }
        if (b.icon !== undefined) cat.icon = b.icon;
      }),
    );
  });
  r.delete('/categories/:id', (c) => {
    const id = c.req.param('id');
    if (!settings.categories().some((x) => x.id === id)) throw notFound('Category not found');
    return c.json(settings.update((d) => { d.categories = d.categories.filter((x) => x.id !== id); }));
  });

  // ---- motivation ----
  r.get('/motivation', (c) => c.json(motivation.get()));
  r.post('/streak/checkin', (c) => c.json(motivation.checkIn()));

  // ---- demo reset (mock mode only; documented in README) ----
  r.post('/demo/reset', async (c) => {
    if (!ctx.mock) throw new ApiException('NOT_FOUND', 404, 'Not found');
    ctx.mock.reset();
    ctx.calendar.invalidate();
    motivation.reset();
    await ctx.seed();
    return c.json({ ok: true });
  });

  return r;
}
