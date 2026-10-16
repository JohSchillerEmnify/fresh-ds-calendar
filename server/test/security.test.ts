/** Server security hardening (ARCHITECTURE "Security hardening", audit docs/SECURITY-AUDIT-2026-10-16.md): one test group per audit item. */
import { createECDH, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { validateTheme } from '@calendar/shared';
import { assertSafeToStart, loadConfig } from '../src/config.js';
import { StateStore } from '../src/auth/oauth.js';
import { Clock } from '../src/lib/clock.js';
import { DriveError, type DriveClient } from '../src/providers/DriveClient.js';
import { BackupService, MAX_BACKUP_FILE_BYTES } from '../src/services/backupService.js';
import { PushService, SEND_TIMEOUT_MS, isPushEndpointAllowed, webPushSender, type PushSender, type PushTarget } from '../src/services/push.js';
import { registerSharedListsBackup } from '../src/services/sharedListsBackup.js';
import { themeFitsSize, vetRestoredFile } from '../src/services/themeStore.js';
import { makeApp, type TestApp } from './helpers.js';

const minimalTheme = (extra: object = {}) => ({ schema: 'calendar-theme/2', name: 'X', ...extra });

/** The OAuth round trip through the test double; returns the redirect target and the session cookie. */
async function signIn(t: TestApp, email: string) {
  await t.json('POST', '/api/__test/oauth/account', { email });
  const start = await t.req('GET', '/api/auth/google/start');
  const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
  const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
  const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
  return { location: cb.headers.get('location'), session: cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))?.split(';')[0] ?? null };
}

describe('M1 push: allow-list, timeout and a hanging endpoint', () => {
  const T0 = Date.parse('2026-10-12T10:00:00+02:00');
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sec-push-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('a hanging endpoint does not block another subscription', async () => {
    const clock = new Clock();
    clock.set(T0);
    const sent: string[] = [];
    const sender: PushSender = {
      send: (t) => (t.endpoint.endsWith('/hang') ? new Promise<void>(() => undefined) : Promise.resolve().then(() => { sent.push(t.endpoint); })),
    };
    const svc = new PushService({ dataDir: dir, clock, sender, vapidPublicKey: 'k', budgetMs: 50 });
    const keys = { p256dh: 'p', auth: 'a' };
    svc.subscribe('jo', { endpoint: 'https://push.example/hang', keys });
    svc.subscribe('anna', { endpoint: 'https://push.example/ok', keys });
    svc.setPlan('jo', 'https://push.example/hang', [{ at: T0, title: 'T', body: 'b', key: 'k1' }]);
    svc.setPlan('anna', 'https://push.example/ok', [{ at: T0, title: 'T', body: 'b', key: 'k2' }]);
    expect(await svc.tick()).toBe(1);
    expect(sent).toEqual(['https://push.example/ok']);
    // the hanging one stays subscribed and unsent, so the next tick tries it again
    expect(svc.all().map((s) => s.sub).sort()).toEqual(['anna', 'jo']);
  });

  it('skips a person taken off the allow-list', async () => {
    const clock = new Clock();
    clock.set(T0);
    const sent: string[] = [];
    const svc = new PushService({ dataDir: dir, clock, sender: { send: async (t) => { sent.push(t.endpoint); } }, vapidPublicKey: 'k', isPermitted: (s) => s !== 'gone' });
    const keys = { p256dh: 'p', auth: 'a' };
    for (const sub of ['gone', 'stays']) {
      svc.subscribe(sub, { endpoint: `https://push.example/${sub}`, keys });
      svc.setPlan(sub, `https://push.example/${sub}`, [{ at: T0, title: 'T', body: 'b', key: sub }]);
    }
    await svc.tick();
    expect(sent).toEqual(['https://push.example/stays']);
  });

  it.each([
    ['https://fcm.googleapis.com/fcm/send/abc', true],
    ['https://updates.push.services.mozilla.com/wpush/v2/abc', true],
    ['https://web.push.apple.com/abc', true],
    ['https://wns2-par02p.notify.windows.com/?token=abc', true],
    ['https://fcm.googleapis.com:443/fcm/send/abc', true],
    ['http://fcm.googleapis.com/fcm/send/abc', false],
    ['https://fcm.googleapis.com:8443/x', false],
    ['https://127.0.0.1/x', false],
    ['https://169.254.169.254/latest/meta-data', false],
    ['https://[::1]/x', false],
    ['https://app:3000/x', false],
    ['https://localhost/x', false],
    ['https://evil.example/x', false],
    ['https://fcm.googleapis.com.evil.example/x', false],
    ['https://evilpush.services.mozilla.com.example/x', false],
    ['https://user:pw@fcm.googleapis.com/x', false],
    ['https://push.example.test/x', false],
    ['not a url', false],
  ])('endpoint %s allowed=%s', (endpoint, ok) => {
    expect(isPushEndpointAllowed(endpoint)).toBe(ok);
  });

  it('accepts the e2e push host in TEST_MODE only', async () => {
    expect(isPushEndpointAllowed('https://push.example.test/e2e', true)).toBe(true);
    expect(isPushEndpointAllowed('https://push.example.test/e2e', false)).toBe(false);
    const keys = { p256dh: 'p', auth: 'a' };
    const test = makeApp();
    const prod = makeApp({ TEST_MODE: 'false' });
    try {
      expect((await test.req('POST', '/api/push/subscriptions', { endpoint: 'https://push.example.test/e2e', keys })).status).toBe(204);
      expect((await prod.req('POST', '/api/push/subscriptions', { endpoint: 'https://push.example.test/e2e', keys })).status).toBe(400);
    } finally { test.cleanup(); prod.cleanup(); }
  });

  it('a non-allowlisted endpoint gets 400', async () => {
    const t = makeApp();
    try {
      for (const endpoint of ['https://127.0.0.1/x', 'https://169.254.169.254/x', 'https://app:3000/x', 'https://evil.example/x']) {
        const r = await t.json('POST', '/api/push/subscriptions', { endpoint, keys: { p256dh: 'p', auth: 'a' } });
        expect(r.status, endpoint).toBe(400);
        expect(r.body.error.details[0].field).toBe('endpoint');
      }
      expect((await t.json('GET', '/api/__test/push-subscriptions')).body.subscriptions).toEqual([]);
    } finally { t.cleanup(); }
  });

  describe('the real sender', () => {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const target = (endpoint: string): PushTarget => ({ endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } });
    const vapid = webpush.generateVAPIDKeys();

    it('gives up after the timeout and rejects', async () => {
      const hang: typeof fetch = (_u, init) => new Promise((_res, rej) => init!.signal!.addEventListener('abort', () => rej(init!.signal!.reason)));
      const sender = webPushSender(vapid, 'mailto:a@example.org', { fetchFn: hang, timeoutMs: 30 });
      await expect(sender.send(target('https://fcm.googleapis.com/fcm/send/x'), '{"title":"t"}')).rejects.toThrow();
      expect(SEND_TIMEOUT_MS).toBe(10_000);
    });

    it('refuses a host outside the allow-list without calling it, as gone (410) so the subscription is dropped', async () => {
      let called = false;
      const sender = webPushSender(vapid, 'mailto:a@example.org', { fetchFn: (async () => { called = true; return new Response(null, { status: 201 }); }) as typeof fetch });
      await expect(sender.send(target('https://169.254.169.254/x'), '{}')).rejects.toMatchObject({ statusCode: 410 });
      expect(called).toBe(false);
    });

    it('does not follow redirects, and a refusal carries the push service status', async () => {
      let init: RequestInit | undefined;
      const sender = webPushSender(vapid, 'mailto:a@example.org', { fetchFn: (async (_u: unknown, i?: RequestInit) => { init = i; return new Response(null, { status: 404 }); }) as typeof fetch });
      await expect(sender.send(target('https://fcm.googleapis.com/fcm/send/x'), '{"title":"t"}')).rejects.toMatchObject({ statusCode: 404 });
      expect(init?.redirect).toBe('manual');
    });
  });
});

describe('M2 request size and the theme validator', () => {
  it('an oversized body gets 413 (themes get a larger limit)', async () => {
    const t = makeApp();
    try {
      const big = await t.json('POST', '/api/events', { title: 'x'.repeat(300_000) });
      expect(big.status).toBe(413);
      expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      // by the declared length too, before anything is read
      expect((await t.json('POST', '/api/events', { title: 'x' }, { 'content-length': '999999' })).status).toBe(413);
      // 300 KB is over the 256 KB limit of other calls but within the 400 KB of a theme (and is then refused as unknown field, not as too large)
      expect((await t.json('POST', '/api/themes', { theme: minimalTheme(), pad: 'y'.repeat(300_000) })).status).toBe(400);
      expect((await t.json('POST', '/api/themes', { theme: minimalTheme(), pad: 'y'.repeat(500_000) })).status).toBe(413);
    } finally { t.cleanup(); }
  });

  it('constructor and __proto__ keys are rejected by the theme validator', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const doc = JSON.parse(`{"schema":"calendar-theme/2","name":"X","${key}":{"huge":"x"}}`);
      const r = validateTheme(doc);
      expect(r.ok, key).toBe(false);
    }
    const nested = validateTheme(JSON.parse('{"schema":"calendar-theme/2","name":"X","colors":{"constructor":"x"}}'));
    expect(nested.ok).toBe(false);
    expect(validateTheme(minimalTheme()).ok).toBe(true);
  });

  it('POST /api/themes refuses the __proto__ theme', async () => {
    const t = makeApp();
    try {
      const raw = `{"theme":{"schema":"calendar-theme/2","name":"X","__proto__":{"a":"${'x'.repeat(1000)}"}}}`;
      const res = await t.app.request('/api/themes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
      expect(res.status).toBe(400);
      expect((await t.json('GET', '/api/themes')).body.themes).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('checks the stored size of a theme server-side', () => {
    expect(themeFitsSize(minimalTheme())).toBe(true);
    expect(themeFitsSize({ name: 'x'.repeat(300 * 1024) })).toBe(false);
  });
});

describe('M3 revocation', () => {
  it('a removed email gets 401 on the next request and loses every session', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      const jo1 = await signIn(t, 'jo@example.com');
      const jo2 = await signIn(t, 'jo@example.com');
      const anna = await signIn(t, 'anna@example.com');
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo1.session! })).status).toBe(200);
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['anna@example.com'] });
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo1.session! })).status).toBe(401);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo2.session! })).status).toBe(401);
      expect((await t.json('GET', '/api/auth/me', undefined, { cookie: jo2.session! })).status).toBe(401);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: anna.session! })).status).toBe(200);
      // put back on the list, the old session is gone for good
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo1.session! })).status).toBe(401);
    } finally { t.cleanup(); }
  });

  it('signout-all ends all sessions of the person and nobody else\'s', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      const jo1 = await signIn(t, 'jo@example.com');
      const jo2 = await signIn(t, 'jo@example.com');
      const anna = await signIn(t, 'anna@example.com');
      expect((await t.req('POST', '/api/auth/signout-all')).status).toBe(401);
      await t.req('POST', '/api/push/subscriptions', { endpoint: 'https://push.example.test/phone', keys: { p256dh: 'p', auth: 'a' } }, { cookie: jo1.session! });
      expect((await t.req('POST', '/api/auth/signout-all', { endpoint: 'https://push.example.test/phone' }, { cookie: jo1.session! })).status).toBe(204);
      expect((await t.json('GET', '/api/__test/push-subscriptions')).body.subscriptions).toEqual([]);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo1.session! })).status).toBe(401);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: jo2.session! })).status).toBe(401);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: anna.session! })).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('a removed person sees no shared lists, is not backed up and gets no pushes', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'anna@example.com'] });
      const { shared, auth } = t.app.ctx;
      const jo = t.app.ctx.people.all().find((p) => p.email === 'jo@example.com')!;
      expect(shared.permitted(jo.sub)).toBe(true);
      auth.allowedEmails = ['anna@example.com'];
      expect(shared.permitted(jo.sub)).toBe(false);
      expect(shared.visibleTo(jo.sub)).toEqual([]);
      expect(() => shared.access(jo.sub, 'shared:whatever')).toThrow();
      // unknown people (never signed in) are not judged
      expect(shared.permitted('nobody-1')).toBe(true);
    } finally { t.cleanup(); }
  });

  it('the daily backup check skips a person who is no longer permitted', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sec-bk-'));
    try {
      fs.mkdirSync(path.join(dir, 'users', 'gone'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'users', 'gone', 'prefs.json'), '{}');
      let drives = 0;
      const svc = new BackupService({
        dataDir: dir, clock: new Clock(), appVersion: 't', isOn: () => true, hasPermission: () => true, isPermitted: () => false,
        driveFor: () => { drives++; return null; },
      });
      expect(await svc.tick()).toBe(0);
      expect(drives).toBe(0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('M4 sign-out clears push', () => {
  it('signout deletes this browser\'s push subscription and only that one', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const jo = await signIn(t, 'jo@example.com');
      const h = { cookie: jo.session! };
      const keys = { p256dh: 'p', auth: 'a' };
      await t.req('POST', '/api/push/subscriptions', { endpoint: 'https://push.example.test/phone', keys }, h);
      await t.req('POST', '/api/push/subscriptions', { endpoint: 'https://push.example.test/laptop', keys }, h);
      expect((await t.json('GET', '/api/__test/push-subscriptions')).body.subscriptions).toHaveLength(2);
      expect((await t.req('POST', '/api/auth/signout', { endpoint: 'https://push.example.test/phone' }, h)).status).toBe(204);
      expect((await t.json('GET', '/api/__test/push-subscriptions')).body.subscriptions.map((s: any) => s.endpoint)).toEqual(['https://push.example.test/laptop']);
      expect((await t.json('GET', '/api/settings', undefined, h)).status).toBe(401);
    } finally { t.cleanup(); }
  });

  it('signout still works without a body or with a bad endpoint', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const a = await signIn(t, 'jo@example.com');
      expect((await t.req('POST', '/api/auth/signout', undefined, { cookie: a.session! })).status).toBe(204);
      const b = await signIn(t, 'jo@example.com');
      expect((await t.req('POST', '/api/auth/signout', { endpoint: 42 }, { cookie: b.session! })).status).toBe(204);
      expect((await t.json('GET', '/api/settings', undefined, { cookie: b.session! })).status).toBe(401);
    } finally { t.cleanup(); }
  });
});

describe('M5 stateless OAuth state', () => {
  it('a state we signed is accepted, with its app flag', () => {
    const s = new StateStore(() => 1_000, 'secret');
    expect(s.consume(s.create(false))).toEqual({ app: false });
    expect(s.consume(s.create(true))).toEqual({ app: true });
  });

  it('a forged OAuth state is rejected', () => {
    const s = new StateStore(() => 1_000, 'secret');
    const good = s.create(false);
    const [payload, sig] = good.split('.') as [string, string];
    const forgedPayload = Buffer.from('{"n":"x","app":true,"exp":99999999}').toString('base64url');
    expect(s.consume(`${forgedPayload}.${sig}`)).toBeNull();
    expect(s.consume(`${payload}.${sig.slice(0, -2)}AA`)).toBeNull();
    expect(s.consume('nope')).toBeNull();
    expect(s.consume(`${payload}.${sig}.extra`)).toBeNull();
    expect(s.consume('')).toBeNull();
    // signed with another key
    expect(new StateStore(() => 1_000, 'other').consume(good)).toBeNull();
  });

  it('an expired OAuth state is rejected (10 minutes)', () => {
    let now = 1_000;
    const s = new StateStore(() => now, 'secret');
    const state = s.create();
    now += 10 * 60_000;
    expect(s.consume(state)).toEqual({ app: false });
    now += 1;
    expect(s.consume(state)).toBeNull();
  });

  it('flooding start does not lock a pending sign-in out', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      await t.json('POST', '/api/__test/oauth/account', { email: 'jo@example.com' });
      const start = await t.req('GET', '/api/auth/google/start');
      const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
      for (let i = 0; i < 200; i++) await t.req('GET', '/api/auth/google/start');
      const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
      const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
      expect(cb.headers.get('location')).toBe('/');
    } finally { t.cleanup(); }
  });

  it('the callback rejects a forged state with 400, and the app=1 flow still hands out an exchange code', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      await t.json('POST', '/api/__test/oauth/account', { email: 'jo@example.com' });
      const forged = `${Buffer.from('{"n":"x","app":true,"exp":99999999999999}').toString('base64url')}.AAAA`;
      expect((await t.req('GET', `/api/auth/google/callback?code=fake:x&state=${forged}`, undefined, { cookie: `cal_oauth_state=${forged}` })).status).toBe(400);
      const challenge = createHash('sha256').update('dGVzdC12ZXJpZmllci0wMTIzNDU2Nzg5MDEyMzQ1Njc4OQ').digest('base64url');
      const start = await t.req('GET', `/api/auth/google/start?app=1&challenge=${challenge}`);
      const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
      const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
      const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
      expect(cb.status).toBe(302);
      expect(cb.headers.get('location')).toMatch(/^intent:\/\/auth\?code=[A-Za-z0-9_-]+#Intent;/);
      expect(cb.headers.getSetCookie().some((c) => c.startsWith('cal_session='))).toBe(false);
    } finally { t.cleanup(); }
  });

  it('a refused code answers 400 and logs no error object', async () => {
    const t = makeApp();
    const logged: unknown[][] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { logged.push(a); };
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com'] });
      const start = await t.req('GET', '/api/auth/google/start');
      const state = new URL(start.headers.get('location')!, 'http://x').searchParams.get('state')!;
      const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
      const res = await t.req('GET', `/api/auth/google/callback?code=garbage&state=${encodeURIComponent(state)}`, undefined, { cookie });
      expect(res.status).toBe(400);
      expect(logged).toEqual([]);
    } finally { console.error = orig; t.cleanup(); }
  });
});

describe('M7 fail closed', () => {
  const cfg = (env: Record<string, string>) => loadConfig({ DATA_DIR: '/x', ...env });

  it('mock mode refuses to start with an https PUBLIC_URL', () => {
    expect(() => assertSafeToStart(cfg({ PUBLIC_URL: 'https://cal.example' }), {})).toThrow(/without sign-in/);
    expect(() => assertSafeToStart(cfg({ PROVIDER: 'mock', PUBLIC_URL: 'https://cal.example' }), {})).toThrow();
  });

  it('mock mode refuses to start in production, and a missing PROVIDER counts as mock', () => {
    expect(() => assertSafeToStart(cfg({}), { NODE_ENV: 'production' })).toThrow();
  });

  it('starts when asked to, on http, in development, or with Google', () => {
    expect(() => assertSafeToStart(cfg({ PUBLIC_URL: 'https://cal.example' }), { ALLOW_INSECURE_MOCK: '1' })).not.toThrow();
    expect(() => assertSafeToStart(cfg({}), { NODE_ENV: 'production', ALLOW_INSECURE_MOCK: '1' })).not.toThrow();
    expect(() => assertSafeToStart(cfg({ PUBLIC_URL: 'http://localhost:3000' }), {})).not.toThrow();
    expect(() => assertSafeToStart(cfg({}), {})).not.toThrow();
    expect(() => assertSafeToStart(cfg({ PROVIDER: 'google', PUBLIC_URL: 'https://cal.example' }), { NODE_ENV: 'production' })).not.toThrow();
  });
});

describe('M10 restore and backup hygiene', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-sec-restore-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const source = () => {
    let src: { restore?: (sub: string, files: Record<string, string>) => void } | undefined;
    registerSharedListsBackup({ registerSource: (s: never) => { src = s; } } as never, { reload() { /* not needed */ } } as never, dir);
    return src!;
  };
  const list = (id: string, owner: string) => JSON.stringify({ version: 1, id, rev: 1, owner, members: [], data: {} });
  const file = (id: string) => path.join(dir, 'shared', 'lists', `${id}.json`);

  it('restore refuses a foreign-owned list and keeps the existing one', () => {
    fs.mkdirSync(path.join(dir, 'shared', 'lists'), { recursive: true });
    fs.writeFileSync(file('abc'), list('abc', 'victim'));
    source().restore!('attacker', { 'shared/lists/abc.json': list('abc', 'attacker') });
    expect(JSON.parse(fs.readFileSync(file('abc'), 'utf8')).owner).toBe('victim');
  });

  it('restore requires the file name to match the list id and the owner to be the restoring person', () => {
    const s = source();
    s.restore!('me', { 'shared/lists/one.json': list('other-id', 'me'), 'shared/lists/two.json': list('two', 'someone-else') });
    expect(fs.existsSync(file('one'))).toBe(false);
    expect(fs.existsSync(file('two'))).toBe(false);
    s.restore!('me', { 'shared/lists/three.json': list('three', 'me') });
    expect(JSON.parse(fs.readFileSync(file('three'), 'utf8')).owner).toBe('me');
  });

  it('restore overwrites a list the person owns', () => {
    const s = source();
    s.restore!('me', { 'shared/lists/mine.json': list('mine', 'me') });
    s.restore!('me', { 'shared/lists/mine.json': JSON.stringify({ ...JSON.parse(list('mine', 'me')), rev: 5 }) });
    expect(JSON.parse(fs.readFileSync(file('mine'), 'utf8')).rev).toBe(5);
  });

  it('restored themes are re-sanitised: script removed, invalid or mismatched files skipped, other files untouched', async () => {
    const rel = 'users/me/themes/t1.json';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="4"/></svg>';
    const out = await vetRestoredFile(rel, JSON.stringify({ id: 't1', created: 5, doc: minimalTheme(), picture: { light: svg } }));
    const stored = JSON.parse(out!);
    expect(stored.picture.light).not.toContain('script');
    expect(stored.picture.light).toContain('circle');
    expect(await vetRestoredFile(rel, JSON.stringify({ id: 't2', doc: minimalTheme() }))).toBeNull();
    expect(await vetRestoredFile(rel, JSON.stringify({ id: 't1', doc: { schema: 'calendar-theme/2', name: 'X', constructor: { a: 1 } } }))).toBeNull();
    expect(await vetRestoredFile(rel, 'not json')).toBeNull();
    expect(await vetRestoredFile('users/me/prefs.json', 'whatever')).toBe('whatever');
  });

  it('a backup carries only the person\'s own entries of people.json and the category share rules', () => {
    const t = makeApp();
    try {
      fs.mkdirSync(path.join(t.dir, 'shared'), { recursive: true });
      fs.writeFileSync(path.join(t.dir, 'people.json'), JSON.stringify({ me: { email: 'me@example.com' }, other: { email: 'other@example.com' } }));
      fs.writeFileSync(path.join(t.dir, 'shared', 'category-shares.json'), JSON.stringify({ me: { c1: 'other' }, other: { c2: 'me' } }));
      const files = t.app.ctx.backup.collect('me');
      expect(JSON.parse(files['server/people.json']!)).toEqual({ me: { email: 'me@example.com' } });
      expect(JSON.parse(files['server/shared/category-shares.json']!)).toEqual({ me: { c1: 'other' } });
      expect(JSON.stringify(files)).not.toContain('other@example.com');
      // a person without an entry carries none
      expect(JSON.parse(t.app.ctx.backup.collect('nobody')['server/people.json']!)).toEqual({});
    } finally { t.cleanup(); }
  });

  it('backup collect skips oversized files', () => {
    const t = makeApp();
    try {
      fs.mkdirSync(path.join(t.dir, 'users', 'me'), { recursive: true });
      fs.writeFileSync(path.join(t.dir, 'users', 'me', 'small.json'), '{}');
      fs.writeFileSync(path.join(t.dir, 'users', 'me', 'big.json'), 'x'.repeat(MAX_BACKUP_FILE_BYTES + 1));
      const files = t.app.ctx.backup.collect('me');
      expect(Object.keys(files)).toContain('users/me/small.json');
      expect(Object.keys(files)).not.toContain('users/me/big.json');
    } finally { t.cleanup(); }
  });

  it('a backup error reaches the person as a generic message, and the log names a hash, not the sub', async () => {
    const fail = (e: Error): DriveClient => ({ list: async () => [], create: async () => { throw e; }, get: async () => '', delete: async () => undefined });
    fs.mkdirSync(path.join(dir, 'users', 'raw-sub-123'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'users', 'raw-sub-123', 'prefs.json'), '{}');
    const logs: string[] = [];
    const mk = (e: Error) => new BackupService({ dataDir: dir, clock: new Clock(), appVersion: 't', isOn: () => true, hasPermission: () => true, driveFor: () => fail(e), log: (m) => logs.push(m) });
    const internal = mk(new Error("ENOENT: no such file or directory, open '/data/users/raw-sub-123/x.json'"));
    await expect(internal.backupNow('raw-sub-123')).rejects.toMatchObject({ code: 'FAILED', message: 'The backup failed' });
    expect(internal.status('raw-sub-123').error).toBe('The backup failed');
    expect(logs.join('\n')).toContain('ENOENT');
    expect(logs.join('\n')).not.toContain('raw-sub-123 ');
    expect(logs.join('\n')).not.toMatch(/backup failed for raw-sub-123/);
    // Drive's own answer is safe text and stays
    const drive = mk(new DriveError('Google Drive answered 503', 503));
    await expect(drive.backupNow('raw-sub-123')).rejects.toMatchObject({ message: 'Google Drive answered 503' });
  });
});

describe('CSRF: Origin and Content-Type', () => {
  it('a non-GET request without an allowed Origin gets 403', async () => {
    const t = makeApp({ PUBLIC_URL: 'https://cal.example', ALLOWED_ORIGINS: 'https://other.example' });
    try {
      const evil = await t.json('POST', '/api/streak/checkin', undefined, { origin: 'https://evil.example' });
      expect(evil.status).toBe(403);
      expect(evil.body.error.code).toBe('FORBIDDEN');
      expect((await t.json('PATCH', '/api/settings', { sounds: false }, { origin: 'null' })).status).toBe(403);
      expect((await t.json('DELETE', '/api/themes/x', undefined, { origin: 'https://cal.example.evil.example' })).status).toBe(403);
      expect((await t.json('POST', '/api/streak/checkin', undefined, { origin: 'https://cal.example' })).status).toBe(200);
      expect((await t.json('POST', '/api/streak/checkin', undefined, { origin: 'https://other.example' })).status).toBe(200);
      // no Origin: the Android widget's native fetch
      expect((await t.json('POST', '/api/streak/checkin')).status).toBe(200);
      // reads are never blocked by it
      expect((await t.json('GET', '/api/settings', undefined, { origin: 'https://evil.example' })).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('without a public URL the page\'s own origin is allowed, a foreign one is not', async () => {
    const t = makeApp();
    try {
      expect((await t.json('POST', '/api/streak/checkin', undefined, { origin: 'http://localhost' })).status).toBe(200);
      expect((await t.json('POST', '/api/streak/checkin', undefined, { origin: 'http://evil.example' })).status).toBe(403);
    } finally { t.cleanup(); }
  });

  it('a body that is not declared as JSON gets 415, JSON with a charset and no body pass', async () => {
    const t = makeApp();
    try {
      const text = await t.app.request('/api/settings', { method: 'PATCH', headers: { 'content-type': 'text/plain' }, body: '{"sounds":false}' });
      expect(text.status).toBe(415);
      const form = await t.app.request('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'sounds=false' });
      expect(form.status).toBe(415);
      const untyped = await t.app.request('/api/settings', { method: 'PATCH', headers: { 'content-length': '16' }, body: new Blob(['{"sounds":false}']) });
      expect(untyped.status).toBe(415);
      const ok = await t.app.request('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json; charset=utf-8' }, body: '{"sounds":false}' });
      expect(ok.status).toBe(200);
      expect((await t.json('POST', '/api/streak/checkin')).status).toBe(200);
    } finally { t.cleanup(); }
  });
});
