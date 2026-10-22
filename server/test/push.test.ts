import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../src/lib/clock.js';
import { CATCH_UP_MS, PushService, loadVapid, type PushSender, type PushTarget } from '../src/services/push.js';
import { makeApp } from './helpers.js';

const T0 = Date.parse('2026-10-12T10:00:00+02:00');
const MIN = 60_000;
const target = (n = 1): PushTarget => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });
const entry = (key: string, at: number) => ({ key, at, title: `T ${key}`, body: '10:40' });

let dir: string;
let clock: Clock;
let calls: Array<{ endpoint: string; payload: any }>;
let fail: number | null;
let svc: PushService;
const sender: PushSender = {
  async send(t, payload) {
    if (fail !== null) throw Object.assign(new Error('push failed'), { statusCode: fail });
    calls.push({ endpoint: t.endpoint, payload: JSON.parse(payload) });
  },
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-push-'));
  clock = new Clock();
  clock.set(T0);
  calls = [];
  fail = null;
  svc = new PushService({ dataDir: dir, clock, sender, vapidPublicKey: 'k' });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('PushService scheduler', () => {
  it('sends a planned push at its time, not before', async () => {
    svc.subscribe('local', target());
    svc.setPlan('local', target().endpoint, [entry('a', T0 + 10 * MIN)]);
    expect(await svc.tick()).toBe(0);
    clock.set(T0 + 10 * MIN);
    expect(await svc.tick()).toBe(1);
    expect(calls[0]).toEqual({ endpoint: target().endpoint, payload: { title: 'T a', body: '10:40', key: 'a' } });
  });

  it('carries the kind of a planned push into its payload (the service worker picks the icon by it)', async () => {
    svc.subscribe('local', target());
    svc.setPlan('local', target().endpoint, [{ ...entry('a', T0), kind: 'tasklist' }]);
    expect(await svc.tick()).toBe(1);
    expect(calls[0]!.payload).toEqual({ title: 'T a', body: '10:40', key: 'a', kind: 'tasklist' });
  });

  it('catches up a push up to 10 minutes late, but not later', async () => {
    svc.subscribe('local', target());
    svc.setPlan('local', target().endpoint, [entry('late', T0), entry('too-late', T0 - 1)]);
    clock.set(T0 + CATCH_UP_MS);
    await svc.tick();
    expect(calls.map((c) => c.payload.key)).toEqual(['late']);
  });

  it('never sends a key twice, also not after the plan was sent again', async () => {
    svc.subscribe('local', target());
    svc.setPlan('local', target().endpoint, [entry('a', T0)]);
    await svc.tick();
    await svc.tick();
    svc.setPlan('local', target().endpoint, [entry('a', T0), entry('b', T0 + MIN)]);
    await svc.tick();
    clock.set(T0 + MIN);
    await svc.tick();
    expect(calls.map((c) => c.payload.key)).toEqual(['a', 'b']);
  });

  it('a new plan replaces the old one of that browser only', async () => {
    svc.subscribe('local', target(1));
    svc.subscribe('local', target(2));
    svc.setPlan('local', target(1).endpoint, [entry('old', T0 + MIN)]);
    svc.setPlan('local', target(2).endpoint, [entry('other', T0 + MIN)]);
    svc.setPlan('local', target(1).endpoint, [entry('new', T0 + MIN)]);
    clock.set(T0 + MIN);
    await svc.tick();
    expect(calls.map((c) => `${c.endpoint.slice(-1)}:${c.payload.key}`).sort()).toEqual(['1:new', '2:other']);
  });

  it('refuses a plan for a browser that is not subscribed', () => {
    expect(svc.setPlan('local', target().endpoint, [entry('a', T0)])).toBe(false);
  });

  it('removes the subscription when the push service answers 410 or 404', async () => {
    for (const code of [410, 404]) {
      svc.subscribe('local', target());
      svc.setPlan('local', target().endpoint, [entry(`g${code}`, T0)]);
      fail = code;
      await svc.tick();
      expect(svc.all()).toEqual([]);
      expect(fs.existsSync(path.join(dir, 'users', 'local', 'push.json'))).toBe(false);
    }
  });

  it('keeps the subscription and retries within the window after another error', async () => {
    svc.subscribe('local', target());
    svc.setPlan('local', target().endpoint, [entry('a', T0)]);
    fail = 500;
    expect(await svc.tick()).toBe(0);
    expect(svc.all()).toHaveLength(1);
    fail = null;
    clock.set(T0 + 2 * MIN);
    expect(await svc.tick()).toBe(1);
  });

  it('unsubscribe removes it', () => {
    svc.subscribe('local', target());
    expect(svc.unsubscribe('local', target().endpoint)).toBe(true);
    expect(svc.unsubscribe('local', target().endpoint)).toBe(false);
  });
});

describe('VAPID keys', () => {
  it('are generated once into vapid.json and reused', () => {
    const a = loadVapid(dir, {});
    expect(loadVapid(dir, {})).toEqual(a);
    expect(fs.existsSync(path.join(dir, 'vapid.json'))).toBe(true);
  });
  it('come from the environment when set', () => {
    expect(loadVapid(dir, { VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' })).toEqual({ publicKey: 'x', privateKey: 'y' });
    expect(fs.existsSync(path.join(dir, 'vapid.json'))).toBe(false);
  });
});

describe('push API', () => {
  it('subscribes, takes a plan, and sends it when the test clock reaches it', async () => {
    const t = makeApp();
    try {
      const key = await t.json('GET', '/api/push/key');
      expect(key.body.key).toMatch(/^[A-Za-z0-9_-]{80,}$/);
      const sub = { endpoint: 'https://push.example.test/e2e', keys: { p256dh: 'p', auth: 'a' } };
      expect((await t.req('POST', '/api/push/subscriptions', sub)).status).toBe(204);
      const at = Date.parse('2026-10-12T10:10:00+02:00');
      expect((await t.req('PUT', '/api/reminders/plan', { endpoint: sub.endpoint, plan: [{ at, title: 'Dentist', body: '10:40 – 11:30', key: 'reminder:x', kind: 'event' }] })).status).toBe(204);
      expect((await t.req('PUT', '/api/reminders/plan', { endpoint: sub.endpoint, plan: [{ at, title: 'X', body: '', key: 'k', kind: 'weather' }] })).status).toBe(400);
      expect((await t.req('PUT', '/api/reminders/plan', { endpoint: 'https://other.example.test/x', plan: [] })).status).toBe(404);
      await t.req('POST', '/api/__test/clock', { now: '2026-10-12T10:00:00+02:00' });
      expect((await t.json('GET', '/api/__test/pushes')).body.pushes).toEqual([]);
      await t.req('POST', '/api/__test/clock', { now: '2026-10-12T10:10:00+02:00' });
      expect((await t.json('GET', '/api/__test/pushes')).body.pushes.map((p: any) => [p.title, p.body, p.kind])).toEqual([['Dentist', '10:40 – 11:30', 'event']]);
      expect((await t.req('DELETE', '/api/push/subscriptions', { endpoint: sub.endpoint })).status).toBe(204);
      expect((await t.json('GET', '/api/__test/push-subscriptions')).body.subscriptions).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('rejects a non-https endpoint', async () => {
    const t = makeApp();
    try {
      expect((await t.req('POST', '/api/push/subscriptions', { endpoint: 'http://push.example.test/1', keys: { p256dh: 'p', auth: 'a' } })).status).toBe(400);
    } finally { t.cleanup(); }
  });
});
