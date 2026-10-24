import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { NotFoundError, PreconditionFailedError, ProviderError, ProviderForbiddenError, ProviderUnavailableError, ReauthRequiredError } from '../src/providers/CalendarProvider.js';
import { createGoogleProvider, GoogleProvider, makeApi, mapGoogleError } from '../src/providers/google/GoogleProvider.js';
import { GoogleOAuth } from '../src/providers/google/auth.js';
import { hasDriveScope } from '../src/auth/people.js';

interface Call { url: URL; method: string; headers: Headers; body: any }
function setup(handler: (c: Call) => { status?: number; json?: unknown } | Promise<{ status?: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: any, init?: any) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input?.url ?? input));
    const method = req ? req.method : init?.method ?? 'GET';
    const headers = new Headers(req ? req.headers : init?.headers);
    const raw = req ? await req.text() : init?.body;
    const call: Call = { url, method, headers, body: raw ? JSON.parse(typeof raw === 'string' ? raw : String(raw)) : undefined };
    calls.push(call);
    const r = await handler(call);
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
  auth.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
  const provider = new GoogleProvider({ api: makeApi(auth, fetchImpl) });
  return { provider, calls };
}

const gev = (o: object = {}) => ({ id: 'abc12', etag: '"e1"', status: 'confirmed', summary: 'S', start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, created: '2026-10-01T00:00:00Z', updated: '2026-10-01T00:00:00Z', ...o });

describe('GoogleProvider (mocked HTTP)', () => {
  it('lists events with singleEvents, filters and pagination; maps fields', async () => {
    const { provider, calls } = setup((c) =>
      c.url.searchParams.get('pageToken')
        ? { json: { items: [gev({ id: 'p2' })], nextSyncToken: 'sync1' } }
        : { json: { items: [gev({ extendedProperties: { private: { kind: 'tasklist' } }, colorId: '3', recurrence: ['RRULE:FREQ=DAILY'] })], nextPageToken: 'n2' } },
    );
    const r = await provider.listEvents({ calendarId: 'primary', timeMin: '2026-10-12T00:00:00+02:00', timeMax: '2026-10-13T00:00:00+02:00', privateExtendedProperty: ['kind=tasklist'] });
    expect(r.items.map((e) => e.id)).toEqual(['abc12', 'p2']);
    expect(r.items[0]).toMatchObject({ calendarId: 'primary', etag: '"e1"', colorId: '3', extendedProperties: { private: { kind: 'tasklist' } }, recurrence: ['RRULE:FREQ=DAILY'] });
    expect(r.nextSyncToken).toBe('sync1');
    const q = calls[0]!.url;
    expect(q.pathname).toBe('/calendar/v3/calendars/primary/events');
    expect(q.searchParams.get('singleEvents')).toBe('true');
    expect(q.searchParams.get('privateExtendedProperty')).toBe('kind=tasklist');
    expect(q.searchParams.get('timeMin')).toBe('2026-10-12T00:00:00+02:00');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer tok');
    expect(calls).toHaveLength(2);
  });

  it('lists without singleEvents when asked (each series once, its exceptions on their own)', async () => {
    const { provider, calls } = setup(() => ({ json: { items: [gev({ id: 'm1', recurrence: ['RRULE:FREQ=WEEKLY'] }), gev({ id: 'm1_20261019', recurringEventId: 'm1' })] } }));
    const r = await provider.listEvents({ calendarId: 'primary', privateExtendedProperty: ['kind=tasklist'], singleEvents: false });
    expect(calls[0]!.url.searchParams.get('singleEvents')).toBe('false');
    expect(r.items.map((e) => [e.id, e.recurringEventId ?? null])).toEqual([['m1', null], ['m1_20261019', 'm1']]);
  });

  it('maps eventType and birthdayProperties of a Google birthday event', async () => {
    // shape of an event of the contacts Birthdays calendar (Google Calendar API "event types" guide)
    const birthday = gev({
      id: '_60q30c1g60o30e1i60o4ac1g60rj8gpqc8p0', summary: "Anna's birthday", recurrence: ['RRULE:FREQ=YEARLY'], visibility: 'private', transparency: 'transparent',
      eventType: 'birthday', birthdayProperties: { type: 'anniversary', customTypeName: '', contact: 'people/c123' },
    });
    const { provider } = setup(() => ({ json: { items: [birthday, gev({ id: 'plain' })] } }));
    const r = await provider.listEvents({ calendarId: 'addressbook#contacts@group.v.calendar.google.com' });
    expect(r.items[0]).toMatchObject({ eventType: 'birthday', birthdayProperties: { type: 'anniversary', contact: 'people/c123' } });
    expect(r.items[1]).not.toHaveProperty('eventType');
    expect(r.items[1]).not.toHaveProperty('birthdayProperties');
  });

  it('inserts, gets, patches with If-Match and nulls the other date field', async () => {
    const { provider, calls } = setup((c) => ({ json: gev({ summary: JSON.stringify(c.body?.summary ?? null) }) }));
    const ins = await provider.insertEvent('primary', { summary: 'A', start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, extendedProperties: { private: { kind: 'tasklist' } } });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { summary: 'A', extendedProperties: { private: { kind: 'tasklist' } } } });
    expect(ins.id).toBe('abc12');
    await provider.getEvent('primary', 'abc12');
    expect(calls[1]!.url.pathname).toBe('/calendar/v3/calendars/primary/events/abc12');
    await provider.patchEvent('primary', 'abc12', { start: { dateTime: '2026-10-12T09:00:00+02:00' }, end: { dateTime: '2026-10-12T10:00:00+02:00' }, colorId: null, extendedProperties: { private: { items_1: null } } }, { ifMatch: '"e1"' });
    const p = calls[2]!;
    expect(p.method).toBe('PATCH');
    expect(p.headers.get('if-match')).toBe('"e1"');
    expect(p.body.start).toEqual({ dateTime: '2026-10-12T09:00:00+02:00', date: null });
    expect(p.body.colorId).toBeNull();
    expect(p.body.extendedProperties.private.items_1).toBeNull();
    await provider.patchEvent('primary', 'abc12', { start: { date: '2026-10-13' }, end: { date: '2026-10-14' } });
    expect(calls[3]!.body.start).toEqual({ date: '2026-10-13', dateTime: null });
    expect(calls[3]!.headers.get('if-match')).toBeNull();
  });

  it('deletes (with If-Match) and moves', async () => {
    const { provider, calls } = setup(() => ({ json: gev() }));
    await provider.deleteEvent('primary', 'abc12', { ifMatch: '"e1"' });
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]!.headers.get('if-match')).toBe('"e1"');
    const m = await provider.moveEvent('primary', 'abc12', 'work');
    expect(calls[1]!.url.pathname).toBe('/calendar/v3/calendars/primary/events/abc12/move');
    expect(calls[1]!.url.searchParams.get('destination')).toBe('work');
    expect(m.calendarId).toBe('work');
  });

  it('lists every calendar of the person (hidden ones too) and aliases the primary one', async () => {
    const { provider, calls } = setup(() => ({ json: { items: [
      { id: 'me@gmail.com', summary: 'me', primary: true, backgroundColor: '#9FE1E7', accessRole: 'owner' },
      { id: 'team@group.calendar.google.com', summary: 'Team', summaryOverride: 'Team (mine)', backgroundColor: '#000000', accessRole: 'reader' },
      { id: 'other@x.com', summary: 'Other', backgroundColor: '#111111', accessRole: 'owner', hidden: true },
    ] } }));
    expect(await provider.listCalendars()).toEqual([
      { id: 'primary', summary: 'me', backgroundColor: '#9fe1e7', primary: true, accessRole: 'owner', hidden: false, owner: 'me@gmail.com', defaultReminders: [] },
      { id: 'team@group.calendar.google.com', summary: 'Team (mine)', backgroundColor: '#000000', primary: false, accessRole: 'reader', hidden: false, defaultReminders: [] },
      { id: 'other@x.com', summary: 'Other', backgroundColor: '#111111', primary: false, accessRole: 'owner', hidden: true, defaultReminders: [] },
    ]);
    expect(calls[0]!.url.searchParams.get('showHidden')).toBe('true');
  });

  it('reads event reminders and calendar defaults, and patches a calendar default', async () => {
    const { provider, calls } = setup((c) => c.method === 'PATCH'
      ? { json: {} }
      : c.url.pathname.endsWith('/calendarList')
        ? { json: { items: [{ id: 'me@gmail.com', summary: 'me', primary: true, accessRole: 'owner', defaultReminders: [{ method: 'popup', minutes: 30 }, { method: 'email', minutes: 60 }] }] } }
        : { json: { items: [gev({ reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }, { method: 'email', minutes: 5 }] } }), gev({ id: 'd', reminders: { useDefault: true } })] } });
    expect((await provider.listCalendars())[0]!.defaultReminders).toEqual([{ method: 'popup', minutes: 30 }, { method: 'email', minutes: 60 }]);
    const r = await provider.listEvents({ calendarId: 'primary' });
    expect(r.items[0]!.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 15 }, { method: 'email', minutes: 5 }] });
    expect(r.items[1]!.reminders).toEqual({ useDefault: true });
    await provider.setCalendarDefaultReminders('primary', [{ method: 'popup', minutes: 10 }]);
    const p = calls.at(-1)!;
    expect(p.method).toBe('PATCH');
    expect(p.url.pathname).toBe('/calendar/v3/users/me/calendarList/primary');
    expect(p.body).toEqual({ defaultReminders: [{ method: 'popup', minutes: 10 }] });
  });

  it('pings with a cheap call', async () => {
    const { provider, calls } = setup(() => ({ json: { items: [] } }));
    await provider.ping();
    expect(calls[0]!.url.pathname).toBe('/calendar/v3/users/me/calendarList');
  });

  it.each([
    [401, ProviderUnavailableError], [403, ProviderUnavailableError], [404, NotFoundError], [410, NotFoundError],
    [412, PreconditionFailedError], [500, ProviderUnavailableError], [503, ProviderUnavailableError], [400, ProviderError],
  ])('maps HTTP %i', async (status, cls) => {
    const { provider } = setup(() => ({ status, json: { error: { code: status, message: 'boom' } } }));
    await expect(provider.getEvent('primary', 'x')).rejects.toBeInstanceOf(cls);
  });

  it('maps network failures to unavailable', async () => {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: 't', expiry_date: Date.now() + 3_600_000 });
    const provider = new GoogleProvider({ api: makeApi(auth, (async () => { throw new TypeError('fetch failed'); }) as typeof fetch) });
    await expect(provider.ping()).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(mapGoogleError(new Error('invalid_grant'))).toBeInstanceOf(ReauthRequiredError);
    expect(mapGoogleError(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'invalid_grant' } } }))).toBeInstanceOf(ReauthRequiredError);
  });

  it('drives the whole REST API through GoogleProvider (task list item op against a fake Google)', async () => {
    const store = new Map<string, any>();
    const calendarList: any[] = [{ id: 'me', primary: true, summary: 'Me', backgroundColor: '#039be5', accessRole: 'owner' }];
    const { provider } = setup((c) => {
      const m = /\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(c.url.pathname);
      if (c.url.pathname.endsWith('/calendarList')) return { json: { items: calendarList } };
      // calendars.insert + calendarList.patch: the tasks calendar is created on first use and hidden
      if (c.method === 'POST' && c.url.pathname.endsWith('/calendar/v3/calendars')) {
        const cal = { id: 'tasks1@group.calendar.google.com', summary: c.body.summary, backgroundColor: '#7986cb', accessRole: 'owner' };
        calendarList.push(cal);
        return { json: cal };
      }
      const entry = /\/users\/me\/calendarList\/([^/]+)$/.exec(c.url.pathname);
      if (c.method === 'PATCH' && entry) {
        const cal = calendarList.find((k) => k.id === decodeURIComponent(entry[1]!));
        Object.assign(cal, c.body);
        return { json: cal };
      }
      if (!m) return { status: 404, json: {} };
      if (c.method === 'GET' && !m[2]) return { json: { items: [...store.values()] } };
      if (c.method === 'GET') return store.has(m[2]!) ? { json: store.get(m[2]!) } : { status: 404, json: {} };
      if (c.method === 'POST') { const e = { ...c.body, id: 'g1', etag: '"1"', status: 'confirmed', created: 'x', updated: 'y' }; store.set('g1', e); return { json: e }; }
      if (c.method === 'PATCH') {
        const cur = store.get(m[2]!);
        if (c.headers.get('if-match') && c.headers.get('if-match') !== cur.etag) return { status: 412, json: {} };
        const e = { ...cur, ...c.body, etag: '"2"', extendedProperties: { private: Object.fromEntries(Object.entries({ ...cur.extendedProperties.private, ...c.body.extendedProperties.private }).filter(([, v]) => v !== null)) } };
        store.set(m[2]!, e); return { json: e };
      }
      return { status: 204 };
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-g-'));
    const app = buildApp({ ...loadConfig({ DATA_DIR: dir, PROVIDER: 'google' }), webDist: null }, { provider });
    app.ctx.auth.on = false; // this test drives the REST API through the provider, not sign-in
    try {
      const create = await app.request('/api/tasklists', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'L', date: '2026-10-12', items: [{ title: 'a' }] }) });
      expect(create.status).toBe(201);
      const list = await create.json();
      expect(list.calendarId).toBe('tasks1@group.calendar.google.com');
      expect(calendarList[1]).toMatchObject({ summary: 'Calendar app: tasks', hidden: true });
      const tick = await app.request(`/api/tasklists/g1/items/${list.items[0].id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: true }) });
      expect((await tick.json()).doneCount).toBe(1);
      expect(store.get('g1').description).toBe('☑ a');
      expect((await (await app.request('/api/health')).json()).provider).toBe('google');
    } finally { app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('createGoogleProvider fails fast without client credentials', () => {
    expect(() => createGoogleProvider(loadConfig({ PROVIDER: 'google' }), 'p1')).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('without any token every call asks the person to sign in again', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-g-'));
    try {
      const p = createGoogleProvider(loadConfig({ PROVIDER: 'google', GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', DATA_DIR: dir }), 'p1');
      await expect(p.ping()).rejects.toBeInstanceOf(ReauthRequiredError);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('Google OAuth routes', () => {
  const dirs: string[] = [];
  afterEach(() => { vi.restoreAllMocks(); for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
  const mkApp = (env: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-auth-'));
    dirs.push(dir);
    const config = { ...loadConfig({ DATA_DIR: dir, ...env }), webDist: null };
    return { dir, config, app: buildApp(config, env.PROVIDER === 'google' ? { provider: new GoogleProvider({ api: makeApi(new OAuth2Client()) }) } : {}) };
  };
  const g = { PROVIDER: 'google', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', PUBLIC_URL: 'https://cal.example.org' };

  it('are 404 with PROVIDER=mock', async () => {
    const { app } = mkApp({});
    expect((await app.request('/api/auth/google/start')).status).toBe(404);
    expect((await app.request('/api/auth/google/callback?code=a&state=b')).status).toBe(404);
  });

  it('start redirects to Google consent with offline access, prompt=consent and state', async () => {
    const { app } = mkApp({ ...g, GOOGLE_CLIENT_ID: 'cid-start' });
    const res = await app.request('/api/auth/google/start');
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.host).toBe('accounts.google.com');
    expect(loc.searchParams.get('access_type')).toBe('offline');
    expect(loc.searchParams.get('prompt')).toBe('consent');
    expect(loc.searchParams.get('redirect_uri')).toBe('https://cal.example.org/api/auth/google/callback');
    expect(loc.searchParams.get('client_id')).toBe('cid-start');
    expect(loc.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // signed payload.signature
  });

  const startFlow = async (app: ReturnType<typeof buildApp>) => {
    const res = await app.request('/api/auth/google/start');
    const state = new URL(res.headers.get('location')!).searchParams.get('state')!;
    return { state, cookie: `cal_oauth_state=${state}` };
  };
  const mockGoogle = (email: string, refreshToken: string | null = 'rt-1', scope: string | null = 'openid email https://www.googleapis.com/auth/calendar') =>
    vi.spyOn(GoogleOAuth.prototype, 'exchange').mockResolvedValue({ sub: 'g-123', email, emailVerified: true, name: 'Jo', refreshToken, scope });

  it('start asks for sign-in scopes and binds the state to a cookie', async () => {
    const { app } = mkApp(g);
    const res = await app.request('/api/auth/google/start');
    expect(new URL(res.headers.get('location')!).searchParams.get('include_granted_scopes')).toBe('true');
    expect(new URL(res.headers.get('location')!).searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.appdata');
    expect(res.headers.get('set-cookie')).toMatch(/cal_oauth_state=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+.*HttpOnly.*SameSite=Lax/i);
  });

  it('callback keeps the granted scope, so a missing Drive permission can be told from a granted one', async () => {
    const drive = 'https://www.googleapis.com/auth/drive.appdata';
    const signIn = async (scope: string | null) => {
      const { app, dir } = mkApp({ ...g, ALLOWED_EMAILS: 'jo@example.com' });
      mockGoogle('jo@example.com', 'rt-1', scope);
      const { state, cookie } = await startFlow(app);
      await app.request(`/api/auth/google/callback?code=c&state=${state}`, { headers: { cookie } });
      return { hasScope: hasDriveScope(dir, 'g-123') };
    };
    expect((await signIn(`openid email https://www.googleapis.com/auth/calendar ${drive}`)).hasScope).toBe(true);
    // the person unticked the Drive box on the consent screen, or the token is from before backups existed
    expect((await signIn('openid email https://www.googleapis.com/auth/calendar')).hasScope).toBe(false);
    expect((await signIn(null)).hasScope).toBe(false);
  });

  it('callback rejects an invalid state or a state without the matching cookie', async () => {
    const { app } = mkApp({ ...g, ALLOWED_EMAILS: 'jo@example.com' });
    expect((await app.request('/api/auth/google/callback?code=c&state=nope')).status).toBe(400);
    expect((await app.request('/api/auth/google/callback')).status).toBe(400);
    const { state } = await startFlow(app);
    expect((await app.request(`/api/auth/google/callback?code=c&state=${state}`)).status).toBe(400);
  });

  it('callback stores the token per person (mode 600), starts a Secure session and redirects', async () => {
    const { app, dir } = mkApp({ ...g, ALLOWED_EMAILS: 'JO@example.com' });
    mockGoogle('jo@Example.com');
    const { state, cookie } = await startFlow(app);
    const res = await app.request(`/api/auth/google/callback?code=c&state=${state}`, { headers: { cookie } });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const file = path.join(dir, 'users', 'g-123', 'google-token.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ refresh_token: 'rt-1', scope: 'openid email https://www.googleapis.com/auth/calendar' });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const set = res.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!;
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Secure/i);
    expect(set).toMatch(/SameSite=Lax/i);
    const me = await app.request('/api/auth/me', { headers: { cookie: set.split(';')[0]! } });
    expect(await me.json()).toEqual({ email: 'jo@example.com', name: 'Jo' });
    // a state whose payload was changed no longer matches its signature
    const forged = `${Buffer.from('{"n":"x","app":true,"exp":9999999999999}').toString('base64url')}.${state.split('.')[1]}`;
    expect((await app.request(`/api/auth/google/callback?code=c&state=${forged}`, { headers: { cookie: `cal_oauth_state=${forged}` } })).status).toBe(400);
  });

  it('callback turns away an address that is not allowed and keeps no token', async () => {
    const { app, dir } = mkApp({ ...g, ALLOWED_EMAILS: 'jo@example.com' });
    mockGoogle('stranger@example.com');
    const { state, cookie } = await startFlow(app);
    const res = await app.request(`/api/auth/google/callback?code=c&state=${state}`, { headers: { cookie } });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/signin?error=private');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('cal_session='))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'users'))).toBe(false);
  });

  it('migrates the old single-user token to the first person who signs in', async () => {
    const { app, dir } = mkApp({ ...g, ALLOWED_EMAILS: 'jo@example.com' });
    fs.writeFileSync(path.join(dir, 'google-token.json'), JSON.stringify({ refresh_token: 'old' }));
    mockGoogle('jo@example.com', null);
    const { state, cookie } = await startFlow(app);
    expect((await app.request(`/api/auth/google/callback?code=c&state=${state}`, { headers: { cookie } })).status).toBe(302);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'users', 'g-123', 'google-token.json'), 'utf8'))).toEqual({ refresh_token: 'old' });
    expect(fs.existsSync(path.join(dir, 'google-token.json'))).toBe(false);
  });
});

describe('insufficient scope', () => {
  it('maps Google 403 scope reasons to CalendarPermissionMissingError, other 403s stay unavailable', async () => {
    const { CalendarPermissionMissingError } = await import('../src/providers/CalendarProvider.js');
    const e = (data: unknown) => Object.assign(new Error('x'), { response: { status: 403, data: { error: data } } });
    expect(mapGoogleError(e({ errors: [{ reason: 'insufficientPermissions' }] }))).toBeInstanceOf(CalendarPermissionMissingError);
    expect(mapGoogleError(e({ details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] }))).toBeInstanceOf(CalendarPermissionMissingError);
    expect(mapGoogleError(e({ errors: [{ reason: 'rateLimitExceeded' }] }))).toBeInstanceOf(ProviderUnavailableError);
  });

  it('tells a permission 403 (forbidden) from quota 403s, which stay merely unavailable', () => {
    const e = (reason: string) => Object.assign(new Error('x'), { response: { status: 403, data: { error: { errors: [{ reason }] } } } });
    for (const reason of ['forbidden', 'requiredAccessLevel', 'writerAccess']) expect(mapGoogleError(e(reason))).toBeInstanceOf(ProviderForbiddenError);
    for (const reason of ['quotaExceeded', 'dailyLimitExceeded', 'calendarUsageLimitsExceeded']) {
      const m = mapGoogleError(e(reason));
      expect(m).toBeInstanceOf(ProviderUnavailableError);
      expect(m).not.toBeInstanceOf(ProviderForbiddenError);
    }
  });
});
