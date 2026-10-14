import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Clock } from '../src/lib/clock.js';
import { mockSub } from '../src/auth/people.js';
import { DriveError, type DriveClient } from '../src/providers/DriveClient.js';
import { MockDrive } from '../src/providers/mock/MockDrive.js';
import { GoogleDrive, MULTIPART_LIMIT } from '../src/providers/google/GoogleDrive.js';
import {
  BACKUP_KEEP, BackupFormatError, backupName, bundle, contentHash, debounceDelay, isRestorable, selectExpired, unbundle,
} from '../src/services/backup.js';
import { makeApp, type TestApp } from './helpers.js';

const SUB = 'abc-1';
const files = { 'users/abc-1/prefs.json': '{"a":1}', 'users/abc-1/themes/t1.json': '{"id":"t1"}' };

describe('bundle helpers', () => {
  it('round-trips a bundle and names it with the sub and a UTC timestamp', () => {
    const b = bundle(files, { sub: SUB, createdMs: Date.UTC(2026, 9, 12, 8, 0, 0, 123), appVersion: '1.2.3' });
    expect(b).toMatchObject({ schema: 1, created: '2026-10-12T08:00:00.123Z', appVersion: '1.2.3', sub: SUB });
    expect(unbundle(JSON.stringify(b), SUB, [])).toEqual(b);
    expect(backupName(SUB, Date.UTC(2026, 9, 12, 8, 0, 0, 123))).toBe('backup-abc-1-20261012T080000123Z.json');
  });

  it.each([
    ['not json', 'nope'],
    ['an unknown schema', JSON.stringify({ schema: 2, created: '2026-10-12T08:00:00Z', sub: SUB, files: {} })],
    ['another person', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: 'other', files: {} })],
    ['no files', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: SUB })],
    ['a non-text file', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: SUB, files: { 'users/abc-1/x': 5 } })],
    ['a path that escapes', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: SUB, files: { 'users/abc-1/../../x': 'x' } })],
    ['the token file', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: SUB, files: { 'users/abc-1/google-token.json': 'x' } })],
    ['another person\'s folder', JSON.stringify({ schema: 1, created: '2026-10-12T08:00:00Z', sub: SUB, files: { 'users/other/prefs.json': 'x' } })],
  ])('refuses %s', (_n, text) => {
    expect(() => unbundle(text, SUB, [])).toThrow(BackupFormatError);
  });

  it('allows registered prefixes only', () => {
    expect(isRestorable('shared/lists/a.json', SUB, ['shared'])).toBe(true);
    expect(isRestorable('shared/lists/a.json', SUB, [])).toBe(false);
    expect(isRestorable('settings.json', SUB, ['shared'])).toBe(false);
  });

  it('hashes the content independent of key order', () => {
    expect(contentHash({ a: '1', b: '2' })).toBe(contentHash({ b: '2', a: '1' }));
    expect(contentHash({ a: '1' })).not.toBe(contentHash({ a: '2' }));
  });
});

describe('retention', () => {
  const f = (i: number, t = `2026-10-${String(i).padStart(2, '0')}T08:00:00Z`) => ({ id: `id${i}`, name: `n${i}`, createdTime: t });
  it('keeps the newest N and expires the rest, oldest last', () => {
    const all = [1, 5, 3, 9, 2, 8, 4, 7, 6, 10].map((i) => f(i));
    expect(BACKUP_KEEP).toBe(7);
    expect(selectExpired(all, 7).map((x) => x.id)).toEqual(['id3', 'id2', 'id1']);
    expect(selectExpired(all, 20)).toEqual([]);
  });
  it('breaks ties between equal times by id', () => {
    const same = ['2026-10-01T08:00:00Z'];
    expect(selectExpired([f(1, same[0]), f(2, same[0]), f(3, same[0])], 2).map((x) => x.id)).toEqual(['id1']);
  });
});

describe('debounce arithmetic', () => {
  const o = { debounceMs: 120_000, minIntervalMs: 300_000 };
  it('waits two quiet minutes after the last change', () => {
    expect(debounceDelay({ ...o, now: 1_000, lastChange: 1_000, lastRun: null })).toBe(120_000);
    expect(debounceDelay({ ...o, now: 61_000, lastChange: 1_000, lastRun: null })).toBe(60_000);
  });
  it('never backs up within five minutes of the previous backup', () => {
    expect(debounceDelay({ ...o, now: 1_000, lastChange: 1_000, lastRun: 0 })).toBe(299_000);
    expect(debounceDelay({ ...o, now: 600_000, lastChange: 400_000, lastRun: 0 })).toBe(0);
  });
});

/** The contract both Drive clients must keep. */
async function contract(drive: DriveClient) {
  const a = await drive.create('backup-x-1.json', '{"n":1}');
  const b = await drive.create('backup-x-2.json', '{"n":2}');
  await drive.create('other.json', 'x');
  expect(a.id).not.toBe(b.id);
  expect((await drive.list('backup-x-')).map((f) => f.name).sort()).toEqual(['backup-x-1.json', 'backup-x-2.json']);
  expect(await drive.get(a.id)).toBe('{"n":1}');
  await drive.delete(a.id);
  await drive.delete(a.id);
  expect((await drive.list('backup-x-')).map((f) => f.id)).toEqual([b.id]);
  await expect(drive.get(a.id)).rejects.toBeInstanceOf(DriveError);
}

describe('MockDrive', () => {
  it('keeps the Drive contract, one folder per person, persisted in mock-drive.json', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-drive-'));
    try {
      const file = path.join(dir, 'mock-drive.json');
      const drive = new MockDrive(file, new Clock());
      await contract(drive.forPerson('p1'));
      expect(await drive.forPerson('p2').list('')).toEqual([]);
      expect(new MockDrive(file, new Clock()).filesOf('p1')).toHaveLength(2);
      drive.down = true;
      await expect(drive.forPerson('p1').list('')).rejects.toBeInstanceOf(DriveError);
      drive.reset();
      expect(fs.existsSync(file)).toBe(false);
      expect(drive.down).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('GoogleDrive request shapes', () => {
  /** A fake Google: records requests and plays a tiny appDataFolder. */
  function fake() {
    const calls: { url: string; init: RequestInit }[] = [];
    const store = new Map<string, { name: string; content: string }>();
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const u = new URL(url);
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (u.pathname === '/upload/drive/v3/files') {
        const body = String(init.body);
        const meta = JSON.parse(body.split('\r\n\r\n')[1]!.split('\r\n')[0]!);
        const content = body.split('\r\n\r\n')[2]!.split('\r\n--')[0]!;
        const id = `g${store.size + 1}`;
        store.set(id, { name: meta.name, content });
        return json({ id, name: meta.name, createdTime: '2026-10-12T08:00:00.000Z' });
      }
      const id = decodeURIComponent(u.pathname.split('/').pop()!);
      if (u.pathname === '/drive/v3/files') return json({ files: [...store].map(([i, f]) => ({ id: i, name: f.name, createdTime: '2026-10-12T08:00:00.000Z' })) });
      if (!store.has(id)) return new Response(JSON.stringify({ error: { message: 'File not found' } }), { status: 404 });
      if (init.method === 'DELETE') { store.delete(id); return new Response(null, { status: 204 }); }
      return new Response(store.get(id)!.content, { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, drive: new GoogleDrive({ getAccessToken: async () => ({ token: 'tok' }) } as never, fetchFn) };
  }

  it('keeps the Drive contract', async () => {
    await contract(fake().drive);
  });

  it('uploads multipart into the appDataFolder and lists that space, with the bearer token', async () => {
    const { calls, drive } = fake();
    await drive.create('backup-x-1.json', '{"n":1}');
    await drive.list('backup-x-');
    const up = calls[0]!;
    expect(up.url).toContain('uploadType=multipart');
    expect((up.init.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    expect((up.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(String(up.init.body)).toContain('"parents":["appDataFolder"]');
    expect(calls[1]!.url).toContain('spaces=appDataFolder');
  });

  it('refuses a bundle over the multipart limit and reports Google errors with their status', async () => {
    const { drive } = fake();
    await expect(drive.create('big.json', 'x'.repeat(MULTIPART_LIMIT))).rejects.toThrow(/5 MB/);
    await expect(drive.get('nope')).rejects.toMatchObject({ status: 404 });
  });
});

/** Signs a person in through the fake consent; returns the session cookie. */
async function signIn(t: TestApp, email: string, driveScope = true): Promise<string> {
  await t.json('POST', '/api/__test/oauth/account', { email, driveScope });
  const start = await t.req('GET', '/api/auth/google/start');
  const cookie = start.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
  const consent = await t.req('GET', start.headers.get('location')!, undefined, { cookie });
  const cb = await t.req('GET', consent.headers.get('location')!, undefined, { cookie });
  return cb.headers.getSetCookie().find((c) => c.startsWith('cal_session='))!.split(';')[0]!;
}

describe('backups over HTTP (TEST_MODE, MockDrive)', () => {
  const JO = 'jo@example.com';
  async function setup() {
    const t = makeApp();
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, 'anna@example.com'] });
    await t.json('POST', '/api/__test/clock', { now: '2026-10-12T08:00:00+02:00' });
    return t;
  }
  const drive = async (t: TestApp, email = JO) => (await t.json('GET', `/api/__test/backup/drive?owner=${email}`)).body.files as { id: string; name: string }[];

  it('is unavailable while sign-in is off', async () => {
    const t = makeApp();
    try {
      expect((await t.json('GET', '/api/backup')).body).toMatchObject({ available: false });
      expect((await t.json('POST', '/api/backup')).status).toBe(404);
    } finally { t.cleanup(); }
  });

  it('backs up now, shows the time, keeps only the last 7 versions and never stores the token', async () => {
    const t = await setup();
    try {
      const jo = await signIn(t, JO);
      const h = { cookie: jo };
      expect((await t.json('GET', '/api/backup', undefined, h)).body).toMatchObject({ available: true, permission: 'granted', state: 'never', keep: 7 });
      // nothing to save yet: a person without data is not backed up, so an empty bundle cannot evict good ones
      expect((await t.json('POST', '/api/backup', undefined, h)).body.state).toBe('never');
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      const r = await t.json('POST', '/api/backup', undefined, h);
      expect(r.body).toMatchObject({ state: 'ok', lastBackupAt: '2026-10-12T06:00:00.000Z' });
      const [f] = await drive(t);
      expect(f!.name).toMatch(/^backup-mock-[0-9a-f]{16}-20261012T060000000Z\.json$/);
      const stored = JSON.parse(await t.app.ctx.mockDrive!.forPerson(mockSub(JO)).get(f!.id));
      expect(Object.keys(stored.files).filter((k) => !k.startsWith('server/'))).toEqual([`users/${mockSub(JO)}/prefs.json`]);
      for (let i = 0; i < 9; i++) await t.json('POST', '/api/backup', undefined, h);
      expect(await drive(t)).toHaveLength(7);
    } finally { t.cleanup(); }
  });

  it('backs up after the quiet period, skips an unchanged state and runs a forced daily backup', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      expect(await drive(t)).toHaveLength(0);
      expect((await t.json('POST', '/api/__test/backup/flush')).body.ran).toBe(1);
      expect(await drive(t)).toHaveLength(1);
      // a write that changes no server data creates no new version
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      expect((await t.json('POST', '/api/__test/backup/flush')).body.ran).toBe(0);
      // not due yet: the daily check does nothing; a day later it makes a version without any change
      expect((await t.json('POST', '/api/__test/backup/tick')).body.ran).toBe(0);
      await t.json('POST', '/api/__test/clock', { now: '2026-10-13T08:30:00+02:00' });
      expect((await t.json('POST', '/api/__test/backup/tick')).body.ran).toBe(1);
      expect(await drive(t)).toHaveLength(2);
    } finally { t.cleanup(); }
  });

  it('shows a failed backup with its reason, keeps saving, and retries at the next daily check', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      await t.json('POST', '/api/__test/backup/drive-down', { down: true });
      const r = await t.json('POST', '/api/backup', undefined, h);
      expect(r.status).toBe(502);
      expect(r.body.error.code).toBe('BACKUP_FAILED');
      expect((await t.json('GET', '/api/backup', undefined, h)).body).toMatchObject({ state: 'failed', error: expect.stringContaining('unavailable') });
      // saving is unaffected, also by the automatic run that fails in the background
      expect((await t.json('PATCH', '/api/prefs', { supportCat: 'off' }, h)).status).toBe(200);
      expect((await t.json('POST', '/api/__test/backup/flush')).body.ran).toBe(0);
      await t.json('POST', '/api/__test/backup/drive-down', { down: false });
      expect((await t.json('POST', '/api/__test/backup/tick')).body.ran).toBe(1);
      expect((await t.json('GET', '/api/backup', undefined, h)).body).toMatchObject({ state: 'ok', error: null });
    } finally { t.cleanup(); }
  });

  it('needs the Drive permission: offers it, refuses and never touches Drive without it', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, 'anna@example.com', false) };
      expect((await t.json('GET', '/api/backup', undefined, h)).body).toMatchObject({ permission: 'missing', state: 'off' });
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      expect((await t.json('POST', '/api/__test/backup/flush')).body.ran).toBe(0);
      const r = await t.json('POST', '/api/backup', undefined, h);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('DRIVE_PERMISSION_REQUIRED');
      expect((await t.json('POST', '/api/backup/restore', undefined, h)).status).toBe(403);
      expect(await drive(t, 'anna@example.com')).toHaveLength(0);
      // signing in again with the permission turns backups on
      const again = { cookie: await signIn(t, 'anna@example.com') };
      expect((await t.json('GET', '/api/backup', undefined, again)).body.permission).toBe('granted');
    } finally { t.cleanup(); }
  });

  it('restores theme and canvas at sign-in on a server that lost the data', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }, h);
      await t.json('PUT', '/api/canvas', { areas: [{ id: 'a1', name: 'Garden', color: '#1a73e8', x: 10, y: 20, w: 320, h: 240 }] }, h);
      await t.json('POST', '/api/backup', undefined, h);
      await t.json('POST', '/api/__test/backup/wipe', { owner: JO });
      expect((await t.json('GET', '/api/canvas', undefined, h)).status).toBe(401);
      const h2 = { cookie: await signIn(t, JO) };
      expect((await t.json('GET', '/api/canvas', undefined, h2)).body.areas.map((a: any) => a.name)).toEqual(['Garden']);
      expect((await t.json('GET', '/api/prefs/theme', undefined, h2)).body.preset).toBe('Neon');
      // no new backup is needed for what was just restored
      expect((await t.json('GET', '/api/backup', undefined, h2)).body.state).toBe('ok');
    } finally { t.cleanup(); }
  });

  it('does not restore at sign-in when the server still has the data, and a failed restore at sign-in never blocks it', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }, h);
      await t.json('POST', '/api/backup', undefined, h);
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Winter' }, h);
      const h2 = { cookie: await signIn(t, JO) };
      expect((await t.json('GET', '/api/prefs/theme', undefined, h2)).body.preset).toBe('Winter');
      await t.json('POST', '/api/__test/backup/wipe', { owner: JO });
      await t.json('POST', '/api/__test/backup/drive-down', { down: true });
      const h3 = { cookie: await signIn(t, JO) };
      expect((await t.json('GET', '/api/auth/me', undefined, h3)).body.email).toBe(JO);
      // a restore that could not run leaves the old version in place: new data becomes one more version, nothing is replaced
      await t.json('PATCH', '/api/prefs', { supportCat: 'off' }, h3);
      await t.json('POST', '/api/__test/backup/drive-down', { down: false });
      await t.json('POST', '/api/__test/backup/flush');
      expect((await drive(t)).length).toBe(2);
    } finally { t.cleanup(); }
  });

  it('restores an older state by button, with a safety backup first, and can undo it', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      const theme = async () => (await t.json('GET', '/api/prefs/theme', undefined, h)).body.preset;
      expect((await t.json('POST', '/api/backup/restore', undefined, h)).body.error.code).toBe('NO_BACKUP');
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }, h);
      await t.json('POST', '/api/backup', undefined, h);
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Winter' }, h);
      expect((await t.json('POST', '/api/backup/restore', undefined, h)).status).toBe(200);
      expect(await theme()).toBe('Neon');
      expect(await drive(t)).toHaveLength(2);
      // the safety backup holds the state before the restore, so a second restore brings "Winter" back
      await t.json('POST', '/api/backup/restore', undefined, h);
      expect(await theme()).toBe('Winter');
      // the token stays
      expect(fs.existsSync(path.join(t.dir, 'users', mockSub(JO), 'google-token.json'))).toBe(true);
    } finally { t.cleanup(); }
  });

  it('aborts the restore when the safety backup fails', async () => {
    const t = await setup();
    try {
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }, h);
      await t.json('POST', '/api/backup', undefined, h);
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Winter' }, h);
      // list works, create does not: simulate with a drive whose create fails
      const real = t.app.ctx.mockDrive!.forPerson(mockSub(JO));
      const flaky: DriveClient = { ...real, create: async () => { throw new DriveError('boom', 500); } };
      (t.app.ctx.backup as any).d.driveFor = () => flaky;
      const r = await t.json('POST', '/api/backup/restore', undefined, h);
      expect(r.status).toBe(502);
      expect((await t.json('GET', '/api/prefs/theme', undefined, h)).body.preset).toBe('Winter');
    } finally { t.cleanup(); }
  });

  it('includes files of registered sources and restores only below their prefix', async () => {
    const t = await setup();
    try {
      const sub = mockSub(JO);
      t.app.ctx.backup.registerSource({ prefix: 'extra', collect: () => ({ 'extra/l1.json': '{"id":"l1"}', 'elsewhere.json': 'x' }) });
      const h = { cookie: await signIn(t, JO) };
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
      await t.json('POST', '/api/backup', undefined, h);
      const [f] = await drive(t);
      const stored = JSON.parse(await t.app.ctx.mockDrive!.forPerson(sub).get(f!.id));
      expect(Object.keys(stored.files).filter((k) => !k.startsWith('server/')).sort()).toEqual(['extra/l1.json', `users/${sub}/prefs.json`]);
      await t.json('POST', '/api/backup/restore', undefined, h);
      expect(fs.readFileSync(path.join(t.dir, 'extra', 'l1.json'), 'utf8')).toBe('{"id":"l1"}');
      expect(fs.existsSync(path.join(t.dir, 'elsewhere.json'))).toBe(false);
      expect(() => t.app.ctx.backup.registerSource({ prefix: 'users', collect: () => ({}) })).toThrow();
    } finally { t.cleanup(); }
  });
});

describe('shared lists (real store)', () => {
  const JO = 'jo@example.com', ANNA = 'anna@example.com';
  const titles = async (t: TestApp, h: { cookie: string }) => ((await t.json('GET', '/api/tasklists/all-open?today=2026-10-12', undefined, h)).body.items as any[]).map((l) => l.title);

  it('backs up the owner\'s list, records only ids for a member, and a restore brings the list back through the store', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
      const jo = { cookie: await signIn(t, JO) }, anna = { cookie: await signIn(t, ANNA) };
      const own = (await t.json('POST', '/api/tasklists', { title: 'Groceries', date: null, items: [{ title: 'Milk' }] }, jo)).body;
      expect((await t.json('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) }, jo)).status).toBe(200);
      await t.json('POST', '/api/backup', undefined, jo);
      await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, anna);
      await t.json('POST', '/api/backup', undefined, anna);
      const bundleOf = async (email: string) => {
        const [f] = (await t.json('GET', `/api/__test/backup/drive?owner=${email}`)).body.files;
        return JSON.parse(await t.app.ctx.mockDrive!.forPerson(mockSub(email)).get(f.id)).files as Record<string, string>;
      };
      const ownerFiles = Object.keys(await bundleOf(JO)).filter((k) => k.startsWith('shared/'));
      expect(ownerFiles).toHaveLength(1);
      expect(ownerFiles[0]).toMatch(/^shared\/lists\/[A-Za-z0-9_-]+\.json$/);
      const memberFiles = await bundleOf(ANNA);
      expect(Object.keys(memberFiles).filter((k) => k.startsWith('shared/lists/'))).toEqual([]);
      expect(JSON.parse(memberFiles[`shared/memberships/${mockSub(ANNA)}.json`]!).listIds).toHaveLength(1);
      // the list is lost on disk and in the store's cache; restoring Jo recreates it, and Anna sees it again
      fs.rmSync(path.join(t.dir, 'shared', 'lists'), { recursive: true });
      t.app.ctx.shared.reload();
      expect(await titles(t, jo)).toEqual([]);
      await t.json('POST', '/api/backup/restore', undefined, jo);
      expect(await titles(t, jo)).toEqual(['Groceries']);
      expect(await titles(t, anna)).toEqual(['Groceries']);
    } finally { t.cleanup(); }
  });
});

describe('server-wide files', () => {
  const JO = 'jo@example.com';
  const cats = async (t: TestApp, h: { cookie: string }) => ((await t.json('GET', '/api/settings', undefined, h)).body.categories as any[]).map((c) => c.name);

  async function backedUp() {
    const t = makeApp();
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, 'anna@example.com'] });
    const h = { cookie: await signIn(t, JO) };
    await t.json('PATCH', '/api/prefs', { supportCat: 'always' }, h);
    await t.json('POST', '/api/categories', { name: 'Garden', color: '#1a73e8' }, h);
    await t.json('POST', '/api/backup', undefined, h);
    return { t, h };
  }

  it('puts settings, motivation, people and share rules into the bundle under server/', async () => {
    const { t, h } = await backedUp();
    try {
      await t.json('POST', '/api/streak/checkin', undefined, h);
      await t.json('POST', '/api/backup', undefined, h);
      const [f] = (await t.json('GET', `/api/__test/backup/drive?owner=${JO}`)).body.files;
      const files = JSON.parse(await t.app.ctx.mockDrive!.forPerson(mockSub(JO)).get(f.id)).files;
      expect(Object.keys(files).filter((k) => k.startsWith('server/')).sort()).toEqual(['server/motivation.json', 'server/people.json', 'server/settings.json']);
    } finally { t.cleanup(); }
  });

  it('restores them onto a fresh server', async () => {
    const { t, h } = await backedUp();
    try {
      // a fresh server: settings back to the defaults and nobody else known yet
      t.app.ctx.settings.reset();
      t.app.ctx.people.reset();
      await t.json('POST', '/api/__test/backup/wipe', { owner: JO });
      const h2 = { cookie: await signIn(t, JO) };
      expect(await cats(t, h2)).toContain('Garden');
      void h;
    } finally { t.cleanup(); }
  });

  it('never overwrites server-wide files that are in use', async () => {
    const { t, h } = await backedUp();
    try {
      await t.json('POST', '/api/categories', { name: 'Kids', color: '#0b8043' }, h);
      await t.json('POST', '/api/backup', undefined, h);
      await t.json('POST', '/api/categories', { name: 'Later', color: '#d93025' }, h);
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }, h);
      await t.json('POST', '/api/backup/restore', undefined, h);
      expect(await cats(t, h)).toContain('Later');
    } finally { t.cleanup(); }
  });
});
