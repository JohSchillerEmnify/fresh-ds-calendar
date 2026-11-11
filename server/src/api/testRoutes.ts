import { Hono, type Context } from 'hono';
import { configResponse } from './routes.js';
import { placeTestRoutes } from './testPlaces.js';
import type { Ctx } from '../context.js';
import { ApiException, notFound, validation } from '../lib/errors.js';
import fs from 'node:fs';
import { mockSub, parseEmails, userDir } from '../auth/people.js';
import { returnTarget } from '../auth/oauth.js';
import { forgetVerifiedHolidays } from '../services/holidays.js';
import type { HolidayVariant } from '@calendar/shared/api';
import { HOLIDAY_REGIONS, HOLIDAY_VARIANTS, holidayCalendarId } from '../providers/holidayRegions.js';
import { noteId, MAX_RELEASE_NOTES } from '../services/releaseNotes.js';
import { newestFirst } from '../services/backup.js';
import { LOCAL_PERSON } from '../services/prefsStore.js';
import { parse, clockSchema, outageSchema, unreadableSchema, rateLimitSchema, resetSchema, testConfigSchema, testMotivationSchema, testVersionSchema, testSlowSchema, refuseNextWriteSchema, testApkSchema, testReleaseNotesSchema } from '../lib/validation.js';
import type { MockContactInput } from '../providers/mock/MockContacts.js';
import type { GoogleEventInput, GoogleEventPatch, ProviderCalendar } from '../providers/CalendarProvider.js';

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
    ctx.live.closeAll();
    mock.reset();
    ctx.clock.set(null);
    ctx.overrides = {};
    ctx.health = null;
    ctx.calendar.invalidate();
    ctx.calendar.forgetFeedHealth();
    forgetVerifiedHolidays();
    ctx.auth.reset();
    ctx.resetPeople();
    ctx.prefs.reset();
    ctx.themes.reset();
    ctx.backup.reset();
    ctx.push.reset();
    ctx.pushRecorder?.reset();
    ctx.mockDrive?.reset();
    ctx.canvas.reset();
    ctx.ink.reset();
    ctx.templates.reset();
    ctx.widgetKeys.reset();
    ctx.idempotency.reset();
    ctx.people.reset();
    ctx.shared.reset();
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
    // the push loop runs on the app clock: moving the clock sends what became due, without waiting for its timer
    await ctx.push.tick();
    ctx.planScheduler.tick();
    return c.json({ now: ctx.clock.now().toISOString(), clockFrozen: ctx.clock.frozen });
  });

  // the signed-in person's streak and plant (the local person's while sign-in is off)
  const person = (c: Context) => (ctx.auth.on ? (c.get('person') as { sub: string } | undefined)?.sub : undefined) ?? LOCAL_PERSON;
  t.post('/motivation', async (c) => c.json(ctx.motivation.setState(person(c), parse(testMotivationSchema, await body(c)))));

  t.post('/config', async (c) => {
    const b = parse(testConfigSchema, await body(c));
    if (b.pollIntervalMs !== undefined) ctx.overrides.pollIntervalMs = b.pollIntervalMs;
    if (b.googlePollMs !== undefined) ctx.overrides.googlePollMs = b.googlePollMs;
    return c.json(configResponse(ctx));
  });

  // "The server answers only after N seconds": every later non-test /api answer waits `ms` (cleared by reset).
  t.post('/slow', async (c) => {
    ctx.overrides.slowMs = parse(testSlowSchema, await body(c)).ms;
    return c.json({ ms: ctx.overrides.slowMs });
  });

  // "The server refuses the next change": the next event or task list write answers 400 or 404 (cleared by reset).
  t.post('/refuse-next-write', async (c) => {
    ctx.overrides.refuseNextWrite = parse(refuseNextWriteSchema, await optBody(c)).status ?? 400;
    return c.json({ status: ctx.overrides.refuseNextWrite });
  });

  // "A new version of the app is deployed": /api/config reports this build version from now on.
  t.post('/version', async (c) => {
    ctx.overrides.version = parse(testVersionSchema, await body(c)).version;
    return c.json(configResponse(ctx));
  });

  // "The release notes are": GET /api/release-notes answers this list (as given, newest first) until the next reset.
  t.post('/release-notes', async (c) => {
    const { notes } = parse(testReleaseNotesSchema, await body(c));
    ctx.overrides.notes = notes.slice(0, MAX_RELEASE_NOTES).map((n) => ({ id: noteId(n.date, n.text), date: n.date, text: n.text }));
    return c.json({ notes: ctx.overrides.notes });
  });

  // "The server offers an APK": /api/config reports it from now on (null = none).
  t.post('/apk', async (c) => {
    ctx.overrides.apk = parse(testApkSchema, await body(c));
    return c.json(configResponse(ctx));
  });

  t.post('/outage', async (c) => {
    const b = parse(outageSchema, await body(c));
    mock.setOutage(b.down, (b.status as 500 | 503 | undefined) ?? 503);
    ctx.health = null;
    return c.json({ down: b.down });
  });

  // "Google cannot read the calendar X": its events reads fail, the other calendars answer.
  t.post('/unreadable', async (c) => {
    const b = parse(unreadableSchema, await body(c));
    mock.setUnreadable(b.calendarId, b.on);
    return c.json(b);
  });

  // "Google asks the app to slow down": the next provider call answers "rate limited" (ADR 0007).
  t.post('/rate-limit', async (c) => {
    const { retryAfterSec } = parse(rateLimitSchema, await body(c));
    mock.setRateLimitNext(retryAfterSec);
    return c.json({ retryAfterSec });
  });

  // `owner` (a Google address) selects that person's mock calendar; without it the shared one is used.
  const store = (owner: string | undefined) => (owner ? ctx.mockFor(mockSub(owner)) : mock);
  const calendarOf = (owner: string | undefined) => (owner ? ctx.calendarFor(mockSub(owner)) : ctx.calendar);

  // Sets one person's calendar list; `shared` calendars are read-only and not their primary.
  t.post('/calendars', async (c) => {
    const b = (await body(c)) as { owner?: unknown; calendars?: Array<{ id?: string; name?: string; color?: string; primary?: boolean; shared?: boolean; ownerEmail?: string; accessRole?: ProviderCalendar['accessRole'] }> } | undefined;
    if (typeof b?.owner !== 'string' || !Array.isArray(b.calendars)) throw validation('owner and calendars are required');
    store(b.owner).setCalendars(b.calendars.map((k) => ({
      id: String(k.id), summary: String(k.name), backgroundColor: String(k.color ?? '#039be5'), primary: !!k.primary && !k.shared,
      accessRole: k.accessRole ?? (k.shared ? 'reader' as const : 'owner' as const), ...(k.ownerEmail ? { owner: k.ownerEmail } : {}),
    })));
    ctx.calendarFor(mockSub(b.owner)).invalidate();
    return c.json({ ok: true });
  });

  // The Google id of a region's holiday calendar (the slug table stays on the server).
  t.get('/holiday-id', (c) => {
    const code = c.req.query('code') ?? '';
    const variant = c.req.query('variant');
    if (!(code in HOLIDAY_REGIONS) || !HOLIDAY_VARIANTS.includes(variant as HolidayVariant)) throw validation('code and variant are required');
    return c.json({ id: holidayCalendarId(code, c.req.query('lang') === 'de' ? 'de' : 'en', variant as HolidayVariant) });
  });

  // Makes Google answer 404 for the given variants of a region (both languages), as if it had no such holiday calendar.
  t.post('/holiday-missing', async (c) => {
    const b = (await body(c)) as { owner?: string; code?: string; variants?: HolidayVariant[] } | undefined;
    if (!b?.code || !(b.code in HOLIDAY_REGIONS) || !Array.isArray(b.variants)) throw validation('code and variants are required');
    const ids = (['en', 'de'] as const).flatMap((lang) => b.variants!.filter((v) => HOLIDAY_VARIANTS.includes(v)).map((v) => holidayCalendarId(b.code!, lang, v)));
    store(b.owner).addPublicMissing(ids);
    forgetVerifiedHolidays();
    return c.json({ ok: true });
  });

  // Adds a region's holiday calendar to one account's list as another Google client would.
  t.post('/remote/holiday-calendars', async (c) => {
    const b = (await body(c)) as { owner?: string; code?: string; variant?: HolidayVariant } | undefined;
    if (!b?.code || !(b.code in HOLIDAY_REGIONS) || !HOLIDAY_VARIANTS.includes(b.variant!)) throw validation('code and variant are required');
    const cal = await store(b.owner).subscribeCalendar(holidayCalendarId(b.code, 'en', b.variant!));
    calendarOf(b.owner).invalidate();
    return c.json(cal, 201);
  });

  // The raw calendar list of one account, hidden entries included.
  // How many change lookups the server made against the mock Google since reset (live sync).
  t.get('/remote/lookups', (c) => c.json({ count: mock.lookups }));

  t.get('/remote/calendars', (c) => c.json({ calendars: store(c.req.query('owner')).remote.calendars() }));

  // Contacts of one account's People API stand-in (feature contact-birthdays); `owner` as above.
  t.post('/remote/contacts', async (c) => {
    const b = (await body(c)) as { owner?: string; name?: unknown; birthday?: unknown; events?: unknown } | undefined;
    if (typeof b?.name !== 'string' || !b.name) throw validation('name is required', 'name');
    const resourceName = store(b.owner).contacts.add({ name: b.name, ...(b.birthday ? { birthday: b.birthday as MockContactInput['birthday'] } : {}), ...(b.events ? { events: b.events as MockContactInput['events'] } : {}) });
    calendarOf(b.owner).invalidate();
    return c.json({ resourceName }, 201);
  });
  t.delete('/remote/contacts/:resourceName{.+}', (c) => {
    const owner = c.req.query('owner');
    if (!store(owner).contacts.remove(c.req.param('resourceName'))) throw notFound('Contact not found');
    calendarOf(owner).invalidate();
    return c.body(null, 204);
  });
  t.post('/remote/contacts-error', async (c) => {
    const b = (await body(c)) as { owner?: string; status?: unknown } | undefined;
    if (b?.status !== null && typeof b?.status !== 'number') throw validation('status must be a number or null', 'status');
    store(b.owner).contacts.setError(b.status);
    calendarOf(b.owner).invalidate();
    return c.body(null, 204);
  });

  // Adds a calendar to one account's list as another Google client would (e.g. an existing tasks calendar).
  t.post('/remote/calendars', async (c) => {
    const b = (await body(c)) as { owner?: string; summary?: unknown; hidden?: unknown; id?: string; color?: string; readOnly?: boolean; accessRole?: ProviderCalendar['accessRole']; ownerEmail?: string } | undefined;
    if (typeof b?.summary !== 'string' || !b.summary) throw validation('summary is required', 'summary');
    // optional id / colour / role / owner address, e.g. Google's contacts "Birthdays" calendar or a calendar shared by another person
    const cal = store(b.owner).remote.insertCalendar(b.summary, b.hidden === true, {
      ...(b.id ? { id: b.id } : {}), ...(b.color ? { backgroundColor: b.color } : {}), ...(b.readOnly ? { accessRole: 'reader' as const } : {}),
      ...(b.accessRole ? { accessRole: b.accessRole } : {}), ...(b.ownerEmail ? { owner: b.ownerEmail } : {}),
    });
    calendarOf(b.owner).invalidate();
    return c.json(cal, 201);
  });

  // Switches a calendar off or on in Google's list as another Google client would (e.g. the old contacts Birthdays calendar).
  t.put('/remote/calendars/:id/hidden', async (c) => {
    const b = (await body(c)) as { owner?: string; hidden?: unknown } | undefined;
    if (typeof b?.hidden !== 'boolean') throw validation('hidden must be a boolean', 'hidden');
    store(b.owner).remote.setHidden(c.req.param('id'), b.hidden);
    calendarOf(b.owner).invalidate();
    return c.json({ ok: true });
  });

  // Sets a calendar's Google `defaultReminders` as another Google client would (popup minutes, optional email ones).
  t.put('/remote/calendars/:id/default-reminders', async (c) => {
    const b = (await body(c)) as { owner?: string; defaultReminders?: Array<{ method?: unknown; minutes?: unknown }> } | undefined;
    if (!Array.isArray(b?.defaultReminders)) throw validation('defaultReminders is required', 'defaultReminders');
    store(b.owner).remote.setDefaultReminders(c.req.param('id'), b.defaultReminders.map((r) => ({ method: String(r.method ?? 'popup'), minutes: Number(r.minutes) })));
    calendarOf(b.owner).invalidate();
    return c.json({ ok: true });
  });

  // The person's tasks calendar id, found or created like the app does on first use.
  t.get('/tasks-calendar', async (c) => c.json({ id: await calendarOf(c.req.query('owner')).tasks.id() }));

  // Creates a task list in one person's mock calendar — undated unless `date` is given; `category` is a category name; `tags` optional.
  t.post('/tasklists', async (c) => {
    const b = (await body(c)) as { owner?: unknown; title?: unknown; items?: unknown; category?: unknown; date?: unknown; tags?: unknown } | undefined;
    if (typeof b?.owner !== 'string' || typeof b.title !== 'string') throw validation('owner and title are required');
    const owner = calendarOf(b.owner);
    const category = typeof b.category === 'string' ? ctx.settings.categories(owner.sub).find((k) => k.name === b.category) : undefined;
    if (typeof b.category === 'string' && !category) throw validation('Unknown category', 'category');
    const items = Array.isArray(b.items) ? b.items.map((title) => ({ title: String(title) })) : [];
    const date = typeof b.date === 'string' ? b.date : null;
    const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];
    // a fixture is not user activity: the plant state stays as it was
    const { plant } = ctx.motivation.get(owner.sub);
    const list = await owner.createTaskList({ title: b.title, date, items, categoryId: category?.id ?? null, ...(tags.length ? { tags } : {}) });
    ctx.motivation.setState(owner.sub, { plant: { growth: plant.growth, lastWatered: plant.lastWatered, todayPoints: plant.todayPoints } });
    return c.json(list, 201);
  });

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
    // the allowed addresses count as people who signed in once, so they can be picked as members
    for (const e of ctx.auth.allowedEmails) ctx.people.recordMock(e);
    return c.json({ on: true, allowedEmails: ctx.auth.allowedEmails });
  });

  // When a widget key was last used (`at: null` = never); the key is named by its device name.
  t.post('/widget-keys/last-used', async (c) => {
    const b = (await body(c)) as { owner?: unknown; name?: unknown; at?: unknown } | undefined;
    if (typeof b?.name !== 'string' || (b.at !== null && typeof b.at !== 'string')) throw validation('name and at are required', 'name');
    const sub = typeof b.owner === 'string' ? mockSub(b.owner) : LOCAL_PERSON;
    const key = ctx.widgetKeys.list(sub).find((k) => k.name === b.name);
    if (!key) throw notFound('Widget key not found');
    ctx.widgetKeys.setLastUsed(sub, key.id, b.at);
    return c.json({ ok: true });
  });

  // The Google account the fake consent screen signs in next.
  t.post('/oauth/account', async (c) => {
    const b = (await body(c)) as { email?: unknown; driveScope?: unknown } | undefined;
    if (typeof b?.email !== 'string' || !b.email) throw validation('email is required', 'email');
    if (b.driveScope !== undefined && typeof b.driveScope !== 'boolean') throw validation('driveScope must be a boolean', 'driveScope');
    ctx.auth.fake!.account = b.email;
    ctx.auth.fake!.driveScope = b.driveScope !== false;
    return c.json({ email: b.email });
  });

  t.get('/oauth/consent', (c) => {
    const fake = ctx.auth.fake!;
    const state = c.req.query('state');
    // signed out (local mode) a Contacts grant has no person to sign in: it returns at once, the double's switch is the grant
    const issued = state && !ctx.auth.on ? ctx.auth.states.consume(state) : null;
    if (issued?.contacts) return c.redirect(returnTarget(issued), 302);
    if (!state || !fake.account) throw validation('No Google account chosen');
    return c.redirect(`/api/auth/google/callback?code=${encodeURIComponent(fake.codeFor(fake.account))}&state=${encodeURIComponent(state)}`, 302);
  });

  // The fake consent screen leaves the "Google Calendar" checkbox unticked (granted: false) or ticked again.
  t.post('/oauth/calendar-access', async (c) => {
    const b = (await body(c)) as { granted?: unknown } | undefined;
    if (typeof b?.granted !== 'boolean') throw validation('granted must be a boolean', 'granted');
    ctx.auth.fake!.calendarGranted = b.granted;
    return c.json({ granted: b.granted });
  });

  // The fake consent screen adds the Contacts permission (feature contact-birthdays); for the signed-out person this is the grant itself.
  t.post('/oauth/contacts-access', async (c) => {
    const b = (await body(c)) as { granted?: unknown } | undefined;
    if (typeof b?.granted !== 'boolean') throw validation('granted must be a boolean', 'granted');
    ctx.auth.fake!.contactsScope = b.granted;
    ctx.calendar.invalidate();
    return c.json({ granted: b.granted });
  });

  // Google answers this person's token refresh with invalid_grant from now on.
  t.post('/oauth/revoke', async (c) => {
    const b = (await body(c)) as { email?: unknown } | undefined;
    if (typeof b?.email !== 'string' || !b.email) throw validation('email is required', 'email');
    ctx.mockFor(mockSub(b.email)).setRevoked(true);
    return c.json({ revoked: b.email });
  });

  // ---- backups to the mock Drive ----
  t.post('/backup/flush', async (c) => c.json({ ran: await ctx.backup.flush() }));
  t.post('/backup/tick', async (c) => c.json({ ran: await ctx.backup.tick() }));
  t.post('/backup/timers', async (c) => {
    const b = ((await body(c)) ?? {}) as { debounceMs?: unknown; minIntervalMs?: unknown };
    for (const k of ['debounceMs', 'minIntervalMs'] as const) {
      if (b[k] === undefined) continue;
      if (typeof b[k] !== 'number' || !Number.isFinite(b[k]) || (b[k] as number) < 0) throw validation(`${k} must be a number of milliseconds`, k);
      ctx.backup.timings[k] = b[k] as number;
    }
    return c.json({ debounceMs: ctx.backup.timings.debounceMs, minIntervalMs: ctx.backup.timings.minIntervalMs });
  });
  t.post('/backup/drive-down', async (c) => {
    const b = (await body(c)) as { down?: unknown } | undefined;
    if (typeof b?.down !== 'boolean') throw validation('down must be a boolean', 'down');
    ctx.mockDrive!.down = b.down;
    return c.json({ down: b.down });
  });
  // The server "lost" this person's data (a new server with an empty DATA_DIR); the mock Drive stays as it is.
  t.post('/backup/wipe', async (c) => {
    const b = (await body(c)) as { owner?: unknown } | undefined;
    if (typeof b?.owner !== 'string' || !b.owner) throw validation('owner is required', 'owner');
    const sub = mockSub(b.owner);
    fs.rmSync(userDir(ctx.config.dataDir, sub), { recursive: true, force: true });
    ctx.auth.sessions.deleteSub(sub);
    ctx.backup.forget(sub);
    return c.body(null, 204);
  });
  // What a backup of the single local person would carry (the public backup needs a signed-in person with Drive).
  t.get('/backup/collect', (c) => c.json({ files: ctx.backup.collect('local') }));
  t.get('/backup/drive', (c) => {
    const owner = c.req.query('owner');
    if (!owner) throw validation('owner is required', 'owner');
    return c.json({ files: newestFirst(ctx.mockDrive!.filesOf(mockSub(owner))) });
  });

  // ---- web push: the recorder stands in for the push services ----
  t.get('/pushes', (c) => c.json({ pushes: ctx.pushRecorder?.sent ?? [] }));
  t.get('/push-subscriptions', (c) => c.json({ subscriptions: ctx.push.all() }));
  t.post('/push/tick', async (c) => c.json({ sent: await ctx.push.tick() }));

  // ---- place search and map pictures (feature event-location) ----
  placeTestRoutes(t, ctx);

  t.get('/memory', (c) => {
    if (c.req.query('gc') === 'true') { (globalThis as { gc?: () => void }).gc?.(); (globalThis as { gc?: () => void }).gc?.(); }
    const m = process.memoryUsage();
    return c.json({ rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal, external: m.external });
  });

  r.route('/__test', t);
  return r;
}
