import { Hono, type Context } from 'hono';
import { configResponse } from './routes.js';
import type { Ctx } from '../context.js';
import { ApiException, validation } from '../lib/errors.js';
import { mockSub, parseEmails } from '../auth/people.js';
import { parse, clockSchema, outageSchema, resetSchema, testConfigSchema, testMotivationSchema, testVersionSchema } from '../lib/validation.js';
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
    ctx.auth.reset();
    ctx.resetPeople();
    ctx.prefs.reset();
    ctx.themes.reset();
    ctx.canvas.reset();
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
    // an empty reset must not create the tasks calendar (scenarios set up Google's calendar list themselves)
    const items = input.seed || input.fixture ? (await ctx.calendar.items('1970-01-01', '2100-01-01')).items : [];
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

  // "A new version of the app is deployed": /api/config reports this build version from now on.
  t.post('/version', async (c) => {
    ctx.overrides.version = parse(testVersionSchema, await body(c)).version;
    return c.json(configResponse(ctx));
  });

  t.post('/outage', async (c) => {
    const b = parse(outageSchema, await body(c));
    mock.setOutage(b.down, (b.status as 500 | 503 | undefined) ?? 503);
    ctx.health = null;
    return c.json({ down: b.down });
  });

  // `owner` (a Google address) selects that person's mock calendar; without it the shared one is used.
  const store = (owner: string | undefined) => (owner ? ctx.mockFor(mockSub(owner)) : mock);
  const calendarOf = (owner: string | undefined) => (owner ? ctx.calendarFor(mockSub(owner)) : ctx.calendar);

  // Sets one person's calendar list; `shared` calendars are read-only and not their primary.
  t.post('/calendars', async (c) => {
    const b = (await body(c)) as { owner?: unknown; calendars?: Array<{ id?: string; name?: string; color?: string; primary?: boolean; shared?: boolean }> } | undefined;
    if (typeof b?.owner !== 'string' || !Array.isArray(b.calendars)) throw validation('owner and calendars are required');
    store(b.owner).setCalendars(b.calendars.map((k) => ({
      id: String(k.id), summary: String(k.name), backgroundColor: String(k.color ?? '#039be5'), primary: !!k.primary && !k.shared,
      accessRole: k.shared ? 'reader' as const : 'owner' as const,
    })));
    ctx.calendarFor(mockSub(b.owner)).invalidate();
    return c.json({ ok: true });
  });

  // The raw calendar list of one account, hidden entries included.
  t.get('/remote/calendars', (c) => c.json({ calendars: store(c.req.query('owner')).remote.calendars() }));

  // Adds a calendar to one account's list as another Google client would (e.g. an existing tasks calendar).
  t.post('/remote/calendars', async (c) => {
    const b = (await body(c)) as { owner?: string; summary?: unknown; hidden?: unknown; id?: string; color?: string; readOnly?: boolean } | undefined;
    if (typeof b?.summary !== 'string' || !b.summary) throw validation('summary is required', 'summary');
    // optional id / colour / read-only role, e.g. Google's contacts "Birthdays" calendar
    const cal = store(b.owner).remote.insertCalendar(b.summary, b.hidden === true, {
      ...(b.id ? { id: b.id } : {}), ...(b.color ? { backgroundColor: b.color } : {}), ...(b.readOnly ? { accessRole: 'reader' as const } : {}),
    });
    calendarOf(b.owner).invalidate();
    return c.json(cal, 201);
  });

  // The person's tasks calendar id, found or created like the app does on first use.
  t.get('/tasks-calendar', async (c) => c.json({ id: await calendarOf(c.req.query('owner')).tasks.id() }));

  t.get('/remote/events', (c) => {
    const q = c.req.query('q');
    let items = store(c.req.query('owner')).remote.list(c.req.query('calendarId'), c.req.query('includeCancelled') === 'true');
    if (q !== undefined) items = items.filter((e) => e.summary === q);
    return c.json({ items });
  });

  t.post('/remote/events', async (c) => {
    const b = (await body(c)) as (GoogleEventInput & { calendarId?: string; owner?: string }) | undefined;
    if (!b || typeof b !== 'object' || !b.start || !b.end) throw validation('start and end are required');
    const { calendarId, owner, ...ev } = b;
    return c.json(store(owner).remote.insert(calendarId ?? 'primary', ev), 201);
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

  // ---- sign-in test double ----
  t.post('/auth', async (c) => {
    const b = (await body(c)) as { allowedEmails?: unknown } | undefined;
    if (!Array.isArray(b?.allowedEmails)) throw validation('allowedEmails must be an array', 'allowedEmails');
    ctx.auth.on = true;
    ctx.auth.allowedEmails = parseEmails(b.allowedEmails.join(','));
    return c.json({ on: true, allowedEmails: ctx.auth.allowedEmails });
  });

  // The Google account the fake consent screen signs in next.
  t.post('/oauth/account', async (c) => {
    const b = (await body(c)) as { email?: unknown } | undefined;
    if (typeof b?.email !== 'string' || !b.email) throw validation('email is required', 'email');
    ctx.auth.fake!.account = b.email;
    return c.json({ email: b.email });
  });

  t.get('/oauth/consent', (c) => {
    const fake = ctx.auth.fake!;
    const state = c.req.query('state');
    if (!fake.account || !state) throw validation('No Google account chosen');
    return c.redirect(`/api/auth/google/callback?code=${encodeURIComponent(fake.codeFor(fake.account))}&state=${encodeURIComponent(state)}`, 302);
  });

  // The fake consent screen leaves the "Google Calendar" checkbox unticked (granted: false) or ticked again.
  t.post('/oauth/calendar-access', async (c) => {
    const b = (await body(c)) as { granted?: unknown } | undefined;
    if (typeof b?.granted !== 'boolean') throw validation('granted must be a boolean', 'granted');
    ctx.auth.fake!.calendarGranted = b.granted;
    return c.json({ granted: b.granted });
  });

  // Google answers this person's token refresh with invalid_grant from now on.
  t.post('/oauth/revoke', async (c) => {
    const b = (await body(c)) as { email?: unknown } | undefined;
    if (typeof b?.email !== 'string' || !b.email) throw validation('email is required', 'email');
    ctx.mockFor(mockSub(b.email)).setRevoked(true);
    return c.json({ revoked: b.email });
  });

  t.get('/memory', (c) => {
    if (c.req.query('gc') === 'true') { (globalThis as { gc?: () => void }).gc?.(); (globalThis as { gc?: () => void }).gc?.(); }
    const m = process.memoryUsage();
    return c.json({ rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal, external: m.external });
  });

  r.route('/__test', t);
  return r;
}
