import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { claimLegacyToken, isAllowed, mockSub, parseEmails, userDir, userTokenFile } from '../src/auth/people.js';
import { ExchangeStore } from '../src/auth/appExchange.js';
import { EXTEND_EVERY_MS, SESSION_TTL_MS, SessionStore } from '../src/auth/sessions.js';
import { makeApp } from './helpers.js';

describe('allow-list', () => {
  it('matches case-insensitively and ignores blanks', () => {
    expect(isAllowed('Jo@Example.com', ['jo@example.com'])).toBe(true);
    expect(isAllowed('stranger@example.com', ['jo@example.com'])).toBe(false);
    expect(isAllowed('', [''])).toBe(false);
    expect(parseEmails(' Jo@Example.com, anna@example.com ,,jo@example.com')).toEqual(['jo@example.com', 'anna@example.com']);
  });
});

describe('per-person paths', () => {
  it('keeps each person under users/<sub>/ and refuses ids that could escape', () => {
    expect(userTokenFile('/d', 'abc-1')).toBe(path.join('/d', 'users', 'abc-1', 'google-token.json'));
    expect(() => userDir('/d', '../x')).toThrow();
    expect(() => userDir('/d', '')).toThrow();
    expect(mockSub('Jo@Example.com')).toBe(mockSub('jo@example.com'));
    expect(mockSub('jo@example.com')).not.toBe(mockSub('anna@example.com'));
  });

  it('hands the legacy token to the first person only', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-people-'));
    try {
      fs.writeFileSync(path.join(dir, 'google-token.json'), JSON.stringify({ refresh_token: 'old' }));
      expect(claimLegacyToken(dir, 'first')).toBe('old');
      expect(fs.existsSync(path.join(dir, 'google-token.json'))).toBe(false);
      fs.writeFileSync(path.join(dir, 'google-token.json'), JSON.stringify({ refresh_token: 'again' }));
      expect(claimLegacyToken(dir, 'second')).toBeNull();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('SessionStore', () => {
  const mk = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sess-'));
    const file = path.join(dir, 'sessions.json');
    let now = 1_000_000;
    return { dir, file, tick: (ms: number) => { now += ms; }, store: () => new SessionStore(file, () => now) };
  };

  it('expires after 90 days and is deleted on sign-out', () => {
    const t = mk();
    try {
      const s = t.store();
      const id = s.create({ sub: 'a', email: 'jo@example.com' });
      expect(id.length).toBeGreaterThanOrEqual(43); // 256 bit, base64url
      expect(s.get(id)?.session).toMatchObject({ sub: 'a', email: 'jo@example.com' });
      t.tick(SESSION_TTL_MS + 1);
      expect(s.get(id)).toBeNull();
      const id2 = s.create({ sub: 'a', email: 'jo@example.com' });
      s.delete(id2);
      expect(s.get(id2)).toBeNull();
      expect(s.get(undefined)).toBeNull();
    } finally { fs.rmSync(t.dir, { recursive: true, force: true }); }
  });

  it('extends on use at most once an hour', () => {
    const t = mk();
    try {
      const s = t.store();
      const id = s.create({ sub: 'a', email: 'jo@example.com' });
      t.tick(EXTEND_EVERY_MS - 1);
      expect(s.get(id)?.extended).toBe(false);
      t.tick(1);
      const hit = s.get(id)!;
      expect(hit.extended).toBe(true);
      expect(hit.session.expiresAt).toBe(1_000_000 + EXTEND_EVERY_MS + SESSION_TTL_MS);
      expect(s.get(id)?.extended).toBe(false);
    } finally { fs.rmSync(t.dir, { recursive: true, force: true }); }
  });

  it('survives a restart (sessions.json, mode 600)', () => {
    const t = mk();
    try {
      const id = t.store().create({ sub: 'a', email: 'jo@example.com' });
      expect(t.store().get(id)?.session.sub).toBe('a');
      expect(fs.statSync(t.file).mode & 0o777).toBe(0o600);
    } finally { fs.rmSync(t.dir, { recursive: true, force: true }); }
  });
});

describe('sign-in over HTTP (TEST_MODE double)', () => {
  const day = { start: { dateTime: '2026-10-14T09:00:00+02:00' }, end: { dateTime: '2026-10-14T10:00:00+02:00' } };
  const items = '/api/items?from=2026-10-12&to=2026-10-19';

  /** Runs the whole round trip through start -> fake consent -> callback; returns the cookie header (or null). */
  async function signIn(t: ReturnType<typeof makeApp>, email: string) {
    await t.json('POST', '/api/__test/oauth/account', { email });
    const start = await t.req('GET', '/api/auth/google/start');
    const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
    const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
    const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
    const session = cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))?.split(';')[0] ?? null;
    return { location: cb.headers.get('location'), session };
  }

  it('is off by default and turned on (and back off by reset) through the test endpoint', async () => {
    const t = makeApp();
    try {
      expect((await t.json('GET', '/api/settings')).status).toBe(200);
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      expect((await t.json('GET', '/api/settings')).body.error.code).toBe('UNAUTHENTICATED');
      expect((await t.json('GET', '/api/health')).status).toBe(200);
      expect((await t.json('GET', '/api/auth/me')).status).toBe(401);
      await t.json('POST', '/api/__test/reset');
      expect((await t.json('GET', '/api/settings')).status).toBe(200);
      expect((await t.json('GET', '/api/auth/me')).body).toEqual({ email: null, name: null });
    } finally { t.cleanup(); }
  });

  it('lets an allowed person in and shows only their own calendar', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      await t.json('POST', '/api/__test/remote/events', { owner: 'jo@example.com', summary: 'Dentist', ...day });
      await t.json('POST', '/api/__test/remote/events', { owner: 'anna@example.com', summary: 'Yoga', ...day });
      const jo = await signIn(t, 'Jo@Example.com');
      expect(jo.location).toBe('/');
      const mine = await t.json('GET', items, undefined, { cookie: jo.session! });
      expect(mine.body.items.map((i: any) => i.title)).toEqual(['Dentist']);
      expect((await t.json('GET', '/api/auth/me', undefined, { cookie: jo.session! })).body.email).toBe('jo@example.com');
      const anna = await signIn(t, 'anna@example.com');
      expect((await t.json('GET', items, undefined, { cookie: anna.session! })).body.items.map((i: any) => i.title)).toEqual(['Yoga']);
      // sign-out ends that session only
      expect((await t.req('POST', '/api/auth/signout', undefined, { cookie: jo.session! })).status).toBe(204);
      expect((await t.json('GET', items, undefined, { cookie: jo.session! })).status).toBe(401);
      expect((await t.json('GET', items, undefined, { cookie: anna.session! })).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('turns away an address that is not allowed', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const r = await signIn(t, 'stranger@example.com');
      expect(r.location).toBe('/signin?error=private');
      expect(r.session).toBeNull();
      expect(fs.existsSync(path.join(t.dir, 'users'))).toBe(false);
    } finally { t.cleanup(); }
  });

  it('answers 401 GOOGLE_REAUTH for a person whose Google access was revoked', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      const jo = await signIn(t, 'jo@example.com');
      const anna = await signIn(t, 'anna@example.com');
      await t.json('POST', '/api/__test/oauth/revoke', { email: 'jo@example.com' });
      const r = await t.json('GET', items, undefined, { cookie: jo.session! });
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('GOOGLE_REAUTH');
      expect((await t.json('GET', items, undefined, { cookie: anna.session! })).status).toBe(200);
    } finally { t.cleanup(); }
  });
});

describe('calendar permission (granular consent)', () => {
  const items = '/api/items?from=2026-10-12&to=2026-10-19';

  /** The OAuth round trip as in the sign-in tests; returns the redirect target and the session cookie. */
  async function signIn(t: ReturnType<typeof makeApp>, email: string) {
    await t.json('POST', '/api/__test/oauth/account', { email });
    const start = await t.req('GET', '/api/auth/google/start');
    const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
    const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
    const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
    return { location: cb.headers.get('location'), session: cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))?.split(';')[0] ?? null };
  }

  it('signs in without the calendar scope, says so, and a re-grant fixes it without a restart', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['anna@example.com'] });
      await t.json('POST', '/api/__test/oauth/calendar-access', { granted: false });
      const first = await signIn(t, 'anna@example.com');
      expect(first.location).toBe('/?calendar=missing');
      expect(first.session).not.toBeNull();
      const token = JSON.parse(fs.readFileSync(userTokenFile(t.dir, mockSub('anna@example.com')), 'utf8'));
      expect(token.scope).toBe('openid email https://www.googleapis.com/auth/drive.appdata'); // the Drive scope was granted, the calendar one not
      const denied = await t.json('GET', items, undefined, { cookie: first.session! });
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('CALENDAR_PERMISSION_MISSING');

      await t.json('POST', '/api/__test/oauth/calendar-access', { granted: true });
      const second = await signIn(t, 'anna@example.com');
      expect(second.location).toBe('/');
      expect(JSON.parse(fs.readFileSync(userTokenFile(t.dir, mockSub('anna@example.com')), 'utf8')).scope).toContain('auth/calendar');
      expect((await t.json('GET', items, undefined, { cookie: second.session! })).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('drops the cached per-person provider after sign-in and sign-out so a new token is picked up', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-forget-'));
    try {
      const { buildApp } = await import('../src/app.js');
      const { loadConfig } = await import('../src/config.js');
      const { MockGoogleProvider } = await import('../src/providers/mock/MockGoogleProvider.js');
      const built: string[] = [];
      const config = { ...loadConfig({ TEST_MODE: 'true', DATA_DIR: dir }), webDist: null };
      const app = buildApp(config, { personProvider: (sub) => { built.push(sub); return new MockGoogleProvider({ dataDir: null, tz: config.tz, clock: app.ctx.clock }); } });
      const sub = mockSub('anna@example.com');
      app.ctx.calendarFor(sub); // no auth yet: shared calendar, nothing built
      app.ctx.auth.on = true;
      app.ctx.calendarFor(sub);
      app.ctx.calendarFor(sub);
      expect(built).toEqual([sub]);
      app.ctx.forgetPerson(sub);
      app.ctx.calendarFor(sub);
      expect(built).toEqual([sub, sub]);
      app.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('app sign-in (Android app, one-time exchange code)', () => {
  const items = '/api/items?from=2026-10-12&to=2026-10-19';

  /** The round trip in the "system browser" (own cookie jar) with `app=1`; returns its callback response. */
  async function appRoundTrip(t: ReturnType<typeof makeApp>, email: string) {
    await t.json('POST', '/api/__test/oauth/account', { email });
    const start = await t.req('GET', '/api/auth/google/start?app=1');
    const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
    const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
    const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
    const html = await cb.text();
    const link = /id="open-app" href="([^"]+)"/.exec(html)?.[1] ?? null;
    return { cb, html, link, code: link ? new URL(link).searchParams.get('code') : null };
  }

  it('hands the session to the app through a one-time code, not to the browser', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const r = await appRoundTrip(t, 'jo@example.com');
      expect(r.cb.status).toBe(200);
      expect(r.link).toMatch(/^lan\.mordor\.calendar:\/\/auth\?code=[A-Za-z0-9_-]{22,}$/); // >= 128 bit
      expect(r.cb.headers.getSetCookie().some((c) => c.startsWith('cal_session='))).toBe(false);
      expect(r.cb.headers.get('cache-control')).toBe('no-store');
      // the WebView redeems it: session cookie + redirect to the app
      const ex = await t.req('GET', `/api/auth/app-exchange?code=${r.code}`);
      expect(ex.status).toBe(302);
      expect(ex.headers.get('location')).toBe('/');
      const session = ex.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!.split(';')[0]!;
      expect((await t.json('GET', '/api/auth/me', undefined, { cookie: session })).body.email).toBe('jo@example.com');
      expect((await t.json('GET', items, undefined, { cookie: session })).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('works once only, and unknown codes get a friendly page', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const r = await appRoundTrip(t, 'jo@example.com');
      expect((await t.req('GET', `/api/auth/app-exchange?code=${r.code}`)).status).toBe(302);
      const again = await t.req('GET', `/api/auth/app-exchange?code=${r.code}`);
      expect(again.status).toBe(400);
      expect(again.headers.getSetCookie()).toEqual([]);
      expect(await again.text()).toContain('/signin');
      expect((await t.req('GET', '/api/auth/app-exchange?code=nope')).status).toBe(400);
      expect((await t.req('GET', '/api/auth/app-exchange')).status).toBe(400);
    } finally { t.cleanup(); }
  });

  it('expires a code after 60 seconds (ExchangeStore)', () => {
    let now = 1_000_000;
    const store = new ExchangeStore(() => now);
    const a = store.create({ sessionId: 's', redirect: '/' });
    now += 60_000;
    expect(store.consume(a)).toEqual({ sessionId: 's', redirect: '/' });
    const b = store.create({ sessionId: 's', redirect: '/' });
    now += 60_001;
    expect(store.consume(b)).toBeNull();
    expect(store.create({ sessionId: 's', redirect: '/' })).not.toBe(store.create({ sessionId: 's', redirect: '/' }));
  });

  it('mints codes only for app flows: a plain sign-in still sets the cookie and redirects', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      await t.json('POST', '/api/__test/oauth/account', { email: 'jo@example.com' });
      const start = await t.req('GET', '/api/auth/google/start');
      const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
      const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
      const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
      expect(cb.status).toBe(302);
      expect(cb.headers.get('location')).toBe('/');
      expect(cb.headers.getSetCookie().some((c) => c.startsWith('cal_session='))).toBe(true);
      // a session id is not a code
      const session = cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!.split(';')[0]!.split('=')[1]!;
      expect((await t.req('GET', `/api/auth/app-exchange?code=${session}`)).status).toBe(400);
    } finally { t.cleanup(); }
  });

  it('keeps the state check in the app flow (no cookie, no session)', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      await t.json('POST', '/api/__test/oauth/account', { email: 'jo@example.com' });
      const start = await t.req('GET', '/api/auth/google/start?app=1');
      const consent = await t.req('GET', start.headers.get('location')!);
      const cb = await t.json('GET', consent.headers.get('location')!);
      expect(cb.status).toBe(400);
    } finally { t.cleanup(); }
  });

  it('turns away a person who is not allowed without minting a code', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const r = await appRoundTrip(t, 'stranger@example.com');
      expect(r.cb.status).toBe(302);
      expect(r.cb.headers.get('location')).toBe('/signin?error=private');
      expect(r.code).toBeNull();
    } finally { t.cleanup(); }
  });
});
