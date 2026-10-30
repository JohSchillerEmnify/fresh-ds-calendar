/** Idempotency-Key replay and the refuse-next-write test hook (ADR 0031, API.md). */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const list = { title: 'Chores', date: '2026-10-12', items: [{ title: 'Vacuum' }] };
const count = async () => (await t.json('GET', '/api/__test/remote/events')).body.items.length;

describe('Idempotency-Key', () => {
  it('answers a resend with the first result and writes nothing twice', async () => {
    const h = { 'Idempotency-Key': 'k1' };
    const a = await t.json('POST', '/api/tasklists', list, h);
    const b = await t.json('POST', '/api/tasklists', list, h);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(await count()).toBe(1);
  });

  it('does not replay a delete twice', async () => {
    const made = (await t.json('POST', '/api/tasklists', list)).body;
    const h = { 'Idempotency-Key': 'k-del' };
    expect((await t.json('DELETE', `/api/tasklists/${made.id}`, undefined, h)).status).toBe(204);
    expect((await t.json('DELETE', `/api/tasklists/${made.id}`, undefined, h)).status).toBe(204);
  });

  it('answers two equal requests sent at once with one write', async () => {
    const h = { 'Idempotency-Key': 'k-par' };
    const [a, b] = await Promise.all([t.json('POST', '/api/tasklists', list, h), t.json('POST', '/api/tasklists', list, h)]);
    expect(b.body).toEqual(a.body);
    expect(await count()).toBe(1);
  });

  it('refuses a key reused for another method or path with 422', async () => {
    const h = { 'Idempotency-Key': 'k2' };
    await t.json('POST', '/api/tasklists', list, h);
    const r = await t.json('POST', '/api/events', { title: 'x', start: '2026-10-12T10:00:00+02:00', end: '2026-10-12T11:00:00+02:00' }, h);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('keeps keys apart per person', async () => {
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['a@example.test', 'b@example.test'] });
    const h = async (email: string) => ({ 'Idempotency-Key': 'same', cookie: await sessionCookie(t, email) });
    const a = await t.json('POST', '/api/tasklists', list, await h('a@example.test'));
    const b = await t.json('POST', '/api/tasklists', { ...list, title: 'Other' }, await h('b@example.test'));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.id).not.toBe(a.body.id);
  });

  it('does not keep a failed answer: the resend is tried again', async () => {
    const h = { 'Idempotency-Key': 'k3' };
    expect((await t.json('PATCH', '/api/tasklists/nope', { title: 'x' }, h)).status).toBe(404);
    const made = (await t.json('POST', '/api/tasklists', list, { 'Idempotency-Key': 'k3b' })).body;
    expect(made.id).toBeTruthy();
    expect((await t.json('PATCH', '/api/tasklists/nope', { title: 'x' }, h)).status).toBe(404);
  });

  it('forgets a key after 24 hours', async () => {
    const h = { 'Idempotency-Key': 'k4' };
    await t.json('POST', '/api/tasklists', list, h);
    await freeze(t, '2026-10-13T08:00:01+02:00');
    await t.json('POST', '/api/tasklists', list, h);
    expect(await count()).toBe(2);
  });

  it('rejects a key longer than 64 characters', async () => {
    const r = await t.json('POST', '/api/tasklists', list, { 'Idempotency-Key': 'x'.repeat(65) });
    expect(r.status).toBe(400);
  });

  it('leaves writes without the header alone', async () => {
    await t.json('POST', '/api/tasklists', list);
    await t.json('POST', '/api/tasklists', list);
    expect(await count()).toBe(2);
  });
});

describe('Idempotency-Key across a restart', () => {
  it('answers the first result again after the server was restarted, and writes nothing', async () => {
    const h = { 'Idempotency-Key': 'durable-1', 'content-type': 'application/json' };
    const first = await t.json('POST', '/api/tasklists', list, h);
    const config = { ...loadConfig({ TEST_MODE: 'true', DATA_DIR: t.dir }), webDist: null };
    const again = buildApp(config);
    try {
      await again.request('/api/__test/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: '2026-10-12T08:00:00+02:00' }) });
      const res = await again.request('/api/tasklists', { method: 'POST', headers: h, body: JSON.stringify(list) });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(first.body);
      // the new process starts with an empty mock calendar: nothing was written again
      expect((await (await again.request('/api/__test/remote/events')).json()).items).toEqual([]);
    } finally { again.close(); }
  });

  it('forgets a stored key after 24 hours', async () => {
    const h = { 'Idempotency-Key': 'durable-2', 'content-type': 'application/json' };
    await t.json('POST', '/api/tasklists', list, h);
    const config = { ...loadConfig({ TEST_MODE: 'true', DATA_DIR: t.dir }), webDist: null };
    const again = buildApp(config);
    try {
      await again.request('/api/__test/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: '2026-10-13T08:00:01+02:00' }) });
      await again.request('/api/tasklists', { method: 'POST', headers: h, body: JSON.stringify(list) });
      expect((await (await again.request('/api/__test/remote/events')).json()).items).toHaveLength(1);
    } finally { again.close(); }
  });
});

describe('POST /api/__test/refuse-next-write', () => {
  it('refuses the next event or task list write with 400 and then goes on', async () => {
    expect((await t.json('POST', '/api/__test/refuse-next-write', {})).body).toEqual({ status: 400 });
    const r = await t.json('POST', '/api/tasklists', list);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(await count()).toBe(0);
    expect((await t.json('POST', '/api/tasklists', list)).status).toBe(201);
  });

  it('can answer 404', async () => {
    await t.json('POST', '/api/__test/refuse-next-write', { status: 404 });
    const r = await t.json('POST', '/api/tasklists', list);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });

  it('is not used up by a read', async () => {
    await t.json('POST', '/api/__test/refuse-next-write', {});
    await t.json('GET', '/api/items?from=2026-10-01&to=2026-10-31');
    expect((await t.json('POST', '/api/tasklists', list)).status).toBe(400);
  });
});
