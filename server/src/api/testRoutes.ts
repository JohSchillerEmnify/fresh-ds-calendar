import { Hono, type Context } from 'hono';
import { configResponse } from './routes.js';
import type { Ctx } from '../context.js';
import { ApiException, validation } from '../lib/errors.js';
import { parse, clockSchema, outageSchema, resetSchema, testConfigSchema, testMotivationSchema } from '../lib/validation.js';
import type { GoogleEventInput, GoogleEventPatch } from '../providers/CalendarProvider.js';

async function body(c: Context): Promise<unknown> {
  try { return await c.req.json(); } catch { return undefined; }
}
const optBody = async (c: Context) => { const b = await body(c); return b === undefined ? {} : b; };

/** Registered only when TEST_MODE=true and PROVIDER=mock (see app.ts). */
export function testRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  const mock = ctx.mock!;
  const t = new Hono();

  t.post('/reset', async (c) => {
    const input = parse(resetSchema, await optBody(c));
    mock.reset();
    ctx.clock.set(null);
    ctx.overrides = {};
    ctx.health = null;
    ctx.calendar.invalidate();
    const settings = ctx.settings.reset();
    ctx.motivation.reset();
    if (input.seed) await ctx.seed();
    for (const e of input.fixture?.events ?? []) {
      const { id, ...rest } = e;
      await ctx.calendar.createEvent(rest, id ? { id } : undefined);
    }
    for (const l of input.fixture?.tasklists ?? []) {
      const { id, ...rest } = l;
      await ctx.calendar.createTaskList(rest, id ? { id } : undefined);
    }
    // Fixture creation must not leave plant points / streak behind.
    if (input.fixture) ctx.motivation.reset();
    const items = (await ctx.calendar.items('1970-01-01', '2100-01-01')).items;
    return c.json({ calendars: await ctx.calendar.calendars(), items, settings });
  });

  t.post('/clock', async (c) => {
    const b = parse(clockSchema, await body(c));
    if (b.now === null) ctx.clock.set(null);
    else {
      const ms = Date.parse(b.now);
      if (Number.isNaN(ms)) throw validation('now must be an ISO date-time', 'now');
      ctx.clock.set(ms, b.frozen ?? true);
    }
    return c.json({ now: ctx.clock.now().toISOString(), clockFrozen: ctx.clock.frozen });
  });

  t.post('/motivation', async (c) => c.json(ctx.motivation.setState(parse(testMotivationSchema, await body(c)))));

  t.post('/config', async (c) => {
    const b = parse(testConfigSchema, await body(c));
    if (b.pollIntervalMs !== undefined) ctx.overrides.pollIntervalMs = b.pollIntervalMs;
    return c.json(configResponse(ctx));
  });

  t.post('/outage', async (c) => {
    const b = parse(outageSchema, await body(c));
    mock.setOutage(b.down, (b.status as 500 | 503 | undefined) ?? 503);
    ctx.health = null;
    return c.json({ down: b.down });
  });

  t.get('/remote/events', (c) => {
    const q = c.req.query('q');
    let items = mock.remote.list(c.req.query('calendarId'), c.req.query('includeCancelled') === 'true');
    if (q !== undefined) items = items.filter((e) => e.summary === q);
    return c.json({ items });
  });

  t.post('/remote/events', async (c) => {
    const b = (await body(c)) as (GoogleEventInput & { calendarId?: string }) | undefined;
    if (!b || typeof b !== 'object' || !b.start || !b.end) throw validation('start and end are required');
    const { calendarId, ...ev } = b;
    return c.json(mock.remote.insert(calendarId ?? 'primary', ev), 201);
  });

  t.patch('/remote/events/:id', async (c) => {
    const found = mock.remote.find(c.req.param('id'));
    if (!found) throw new ApiException('NOT_FOUND', 404, 'Not found');
    return c.json(mock.remote.patch(found.calendarId, found.id, ((await body(c)) ?? {}) as GoogleEventPatch));
  });

  t.delete('/remote/events/:id', (c) => {
    const found = mock.remote.find(c.req.param('id'));
    if (!found) throw new ApiException('NOT_FOUND', 404, 'Not found');
    mock.remote.delete(found.calendarId, found.id);
    return c.body(null, 204);
  });

  t.get('/memory', (c) => {
    if (c.req.query('gc') === 'true') { (globalThis as { gc?: () => void }).gc?.(); (globalThis as { gc?: () => void }).gc?.(); }
    const m = process.memoryUsage();
    return c.json({ rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal, external: m.external });
  });

  r.route('/__test', t);
  return r;
}
