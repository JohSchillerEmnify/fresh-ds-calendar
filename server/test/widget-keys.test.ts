import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
let jo: string;
let ann: string;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => {
  await t.req('POST', '/api/__test/reset');
  await t.json('POST', '/api/__test/auth', { allowedEmails: ['jo@example.com', 'ann@example.com'] });
  await freeze(t, '2026-10-14T08:00:00+02:00');
  jo = await sessionCookie(t, 'jo@example.com');
  ann = await sessionCookie(t, 'ann@example.com');
});

const as = (cookie: string) => ({ cookie });
const bearer = (key: string) => ({ authorization: `Bearer ${key}` });
const mint = async (cookie: string, name = 'My iPhone') => (await t.json('POST', '/api/widget-keys', { name }, as(cookie))).body as { id: string; key: string; name: string };
const data = (key: string, from = '2026-10-14', to = '2026-10-15') => t.json('GET', `/api/widget/data?from=${from}&to=${to}`, undefined, bearer(key));
const event = (cookie: string, title: string, over: object = {}) => t.json('POST', '/api/events', {
  title, allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', ...over }, as(cookie));

describe('widget keys (/api/widget-keys)', () => {
  it('creates a key once, lists it without the key and revokes it', async () => {
    const k = await t.json('POST', '/api/widget-keys', { name: ' My iPhone ' }, as(jo));
    expect(k.status).toBe(201);
    expect(k.res.headers.get('cache-control')).toBe('no-store');
    expect(k.body).toMatchObject({ name: 'My iPhone', lastUsedAt: null });
    expect(k.body.key).toMatch(/^cwk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);
    const list = await t.json('GET', '/api/widget-keys', undefined, as(jo));
    expect(list.body).toEqual([{ id: k.body.id, name: 'My iPhone', createdAt: expect.any(String), lastUsedAt: null }]);
    expect(JSON.stringify(list.body)).not.toContain(k.body.key.split('_')[2]);
    expect((await t.req('DELETE', `/api/widget-keys/${k.body.id}`, undefined, as(jo))).status).toBe(204);
    expect((await t.json('GET', '/api/widget-keys', undefined, as(jo))).body).toEqual([]);
  });

  it('validates the name and caps the keys at ten per person', async () => {
    expect((await t.json('POST', '/api/widget-keys', { name: '  ' }, as(jo))).status).toBe(400);
    expect((await t.json('POST', '/api/widget-keys', { name: 'x'.repeat(41) }, as(jo))).status).toBe(400);
    for (let i = 0; i < 10; i++) await mint(jo, `Phone ${i}`);
    const r = await t.json('POST', '/api/widget-keys', { name: 'One too many' }, as(jo));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('WIDGET_KEY_LIMIT');
    expect((await t.json('POST', '/api/widget-keys', { name: 'Ann phone' }, as(ann))).status).toBe(201);
  });

  it('keeps keys per person: a foreign id is 404 and the list is only one\'s own', async () => {
    const k = await mint(jo);
    expect((await t.req('DELETE', `/api/widget-keys/${k.id}`, undefined, as(ann))).status).toBe(404);
    expect((await t.json('GET', '/api/widget-keys', undefined, as(ann))).body).toEqual([]);
    expect((await t.json('GET', '/api/widget-keys', undefined, as(jo))).body).toHaveLength(1);
  });

  it('keeps only a hash of the key in the key file', async () => {
    const k = await mint(jo);
    const file = path.join(t.dir, 'users', mockSub('jo@example.com'), 'widget-keys.json');
    const text = fs.readFileSync(file, 'utf8');
    const secret = k.key.split('_').slice(2).join('_');
    expect(text).not.toContain(secret);
    expect(text).not.toContain(k.key);
    expect(JSON.parse(text).keys[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the widget data (/api/widget/data)', () => {
  it('answers with the key\'s person only and the hidden calendars left out', async () => {
    const key = await mint(jo);
    await event(jo, 'Dentist');
    await event(ann, 'Yoga', { start: '2026-10-14T07:00:00+02:00', end: '2026-10-14T08:00:00+02:00' });
    const r = await data(key.key);
    expect(r.status).toBe(200);
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Dentist']);
    expect(r.body).toMatchObject({ today: '2026-10-14', scriptVersion: expect.any(Number), minEventMinutes: expect.anything(), weekSideBySide: expect.anything() });
    expect(r.body.generatedAt).toMatch(/^2026-10-14T08:00:00/);
    const primary = (await t.json('GET', '/api/calendars', undefined, as(jo))).body.calendars.find((c: any) => c.primary);
    await t.json('PATCH', `/api/calendars/${primary.id}`, { hidden: true }, as(jo));
    expect((await data(key.key)).body.items).toEqual([]);
  });

  it('carries the lock screen circle setting of the key\'s person, start time by default', async () => {
    const key = await mint(jo);
    expect((await data(key.key)).body.widgetCircle).toBe('time');
    await t.json('PATCH', '/api/prefs', { widgetCircle: 'countdown' }, as(jo));
    expect((await data(key.key)).body.widgetCircle).toBe('countdown');
    const other = await mint(ann);
    expect((await data(other.key)).body.widgetCircle).toBe('time');
    expect((await t.json('PATCH', '/api/prefs', { widgetCircle: 'soon' }, as(jo))).status).toBe(400);
  });

  it('refuses an unknown or malformed key and a session without a key', async () => {
    const key = await mint(jo);
    for (const h of [bearer('cwk_AAAAAAAA_' + 'A'.repeat(43)), bearer('nonsense'), {}, as(jo), bearer(key.key.slice(0, -1) + (key.key.endsWith('A') ? 'B' : 'A'))]) {
      const r = await t.json('GET', '/api/widget/data?from=2026-10-14&to=2026-10-15', undefined, h);
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('WIDGET_KEY_INVALID');
    }
  });

  it('says "revoked" for a removed key and "unknown" once the record is 90 days old', async () => {
    const key = await mint(jo);
    await t.req('DELETE', `/api/widget-keys/${key.id}`, undefined, as(jo));
    const r = await data(key.key);
    expect([r.status, r.body.error.code]).toEqual([401, 'WIDGET_KEY_REVOKED']);
    await t.json('POST', '/api/__test/clock', { now: '2027-01-20T08:00:00+01:00' });
    expect((await data(key.key)).body.error.code).toBe('WIDGET_KEY_INVALID');
  });

  it('limits the range to 8 days and answers 400 for a bad one', async () => {
    const key = await mint(jo);
    expect((await data(key.key, '2026-10-14', '2026-10-22')).status).toBe(200);
    expect((await data(key.key, '2026-10-14', '2026-10-23')).status).toBe(400);
    expect((await data(key.key, '2026-10-14', '2026-10-14')).status).toBe(400);
  });

  it('writes the last use once and then at most hourly', async () => {
    const key = await mint(jo);
    await data(key.key);
    const first = (await t.json('GET', '/api/widget-keys', undefined, as(jo))).body[0].lastUsedAt;
    expect(first).toBe('2026-10-14T06:00:00.000Z');
    await t.json('POST', '/api/__test/clock', { now: '2026-10-14T08:30:00+02:00' });
    await data(key.key);
    expect((await t.json('GET', '/api/widget-keys', undefined, as(jo))).body[0].lastUsedAt).toBe(first);
    await t.json('POST', '/api/__test/clock', { now: '2026-10-14T09:30:00+02:00' });
    await data(key.key);
    expect((await t.json('GET', '/api/widget-keys', undefined, as(jo))).body[0].lastUsedAt).toBe('2026-10-14T07:30:00.000Z');
  });

  it('slows a key down after 30 requests a minute with Retry-After', async () => {
    const key = await mint(jo);
    let last = 200;
    let res: Response | undefined;
    for (let i = 0; i < 40; i++) {
      const r = await data(key.key);
      last = r.status;
      if (last === 429) { res = r.res; break; }
    }
    expect(last).toBe(429);
    expect(Number(res!.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('slows a client that keeps presenting wrong keys', async () => {
    let last = 0;
    for (let i = 0; i < 40 && last !== 429; i++) last = (await t.json('GET', '/api/widget/data?from=2026-10-14&to=2026-10-15', undefined, { ...bearer('cwk_AAAAAAAA_' + 'A'.repeat(43)), 'x-forwarded-for': '203.0.113.7' })).status;
    expect(last).toBe(429);
  });
});

describe('what a key may do', () => {
  it('opens the data and the script and nothing else: any other route answers 401', async () => {
    const key = await mint(jo);
    for (const [m, u, b] of [['GET', '/api/prefs'], ['POST', '/api/events', { title: 'x' }], ['GET', '/api/widget-keys'], ['POST', '/api/widget-keys', { name: 'x' }], ['DELETE', `/api/widget-keys/${key.id}`]] as const) {
      const r = await t.json(m, u, b, bearer(key.key));
      expect([m, u, r.status]).toEqual([m, u, 401]);
      expect(r.body.error.code).toBe('UNAUTHENTICATED');
    }
    expect((await data(key.key)).status).toBe(200);
  });

  it('serves the widget script, with no secret in it, to a key only', async () => {
    const key = await mint(jo);
    const r = await t.req('GET', '/api/widget/script', undefined, bearer(key.key));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/javascript');
    expect(r.headers.get('cache-control')).toBe('no-store');
    const text = await r.text();
    expect(text).toMatch(/^\/\/ calendar-widget version=\d+\n/);
    expect(text).not.toContain(key.key);
    expect(text).not.toContain('jo@example.com');
    expect((await t.req('GET', '/api/widget/script', undefined, as(jo))).status).toBe(401);
    expect((await t.req('GET', '/api/widget/script')).status).toBe(401);
    await t.req('DELETE', `/api/widget-keys/${key.id}`, undefined, as(jo));
    expect((await t.json('GET', '/api/widget/script', undefined, bearer(key.key))).body.error.code).toBe('WIDGET_KEY_REVOKED');
  });
});

describe('the backup', () => {
  it('leaves the key file out', async () => {
    const { isExcluded } = await import('../src/services/backup.js');
    expect(isExcluded('users/u1/widget-keys.json', 'u1')).toBe(true);
  });
});
