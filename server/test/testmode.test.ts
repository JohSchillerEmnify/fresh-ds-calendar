import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('reset', () => {
  it('clears everything and returns calendars, items, settings', async () => {
    await t.json('POST', '/api/events', { title: 'a', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    await t.json('POST', '/api/__test/outage', { down: true });
    await t.json('POST', '/api/__test/config', { pollIntervalMs: 0 });
    await freeze(t);
    await t.json('PATCH', '/api/settings', { sunflowers: 'full' });
    await t.json('PATCH', '/api/prefs', { streak: 'flame', syncIndicator: true, headerLayout: 'one-row' });
    const r = await t.json('POST', '/api/__test/reset');
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
    expect(r.body.calendars).toHaveLength(2);
    expect(r.body.settings.sunflowers).toBe('grow');
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ streak: 'off', syncIndicator: false, headerLayout: 'two-rows' });
    const cfg = (await t.json('GET', '/api/config')).body;
    expect(cfg).toMatchObject({ clockFrozen: false, pollIntervalMs: 30000 });
    expect((await t.json('GET', '/api/health')).body.providerStatus).toBe('ok');
    expect((await t.json('GET', '/api/motivation')).body.plant.growth).toBe(0);
  });

  it('loads fixtures with given ids and leaves no motivation points', async () => {
    const r = await t.json('POST', '/api/__test/reset', {
      fixture: {
        events: [{ id: 'evt01', title: 'Fixture', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', calendarId: 'work' }],
        tasklists: [{ id: 'list1', title: 'Chores', date: '2026-10-12', categoryId: 'home', items: [{ title: 'a', done: true }, { title: 'b' }] }],
      },
    });
    expect(r.body.items.map((i: any) => [i.kind, i.id])).toEqual([['tasklist', 'list1'], ['event', 'evt01']]);
    expect((await t.json('GET', '/api/events/evt01')).body.calendarId).toBe('work');
    expect((await t.json('GET', '/api/tasklists/list1')).body.doneCount).toBe(1);
    expect((await t.json('GET', '/api/motivation')).body.plant.growth).toBe(0);
  });

  it('seed:true loads the demo data; invalid fixtures are 400', async () => {
    const r = await t.json('POST', '/api/__test/reset', { seed: true });
    expect(r.body.items.length).toBeGreaterThan(25);
    expect((await t.json('POST', '/api/__test/reset', { fixture: { events: [{ title: '' }] } })).status).toBe(400);
    expect((await t.json('POST', '/api/__test/reset', { bogus: 1 })).status).toBe(400);
  });
});

describe('clock', () => {
  it('sets, validates and clears', async () => {
    const r = await t.json('POST', '/api/__test/clock', { now: '2026-12-24T18:00:00+01:00' });
    expect(r.body).toEqual({ now: '2026-12-24T17:00:00.000Z', clockFrozen: true });
    expect((await t.json('POST', '/api/__test/clock', { now: 'garbage' })).status).toBe(400);
    expect((await t.json('POST', '/api/__test/clock', { now: null })).body.clockFrozen).toBe(false);
  });
  it('affects "now" only: updated timestamps keep real time', async () => {
    await freeze(t, '2020-01-01T08:00:00+01:00');
    const e = await t.json('POST', '/api/events', { title: 'a', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    expect(Date.parse(e.body.updated)).toBeGreaterThan(Date.parse('2025-01-01'));
  });
});

describe('remote (Google-side) changes', () => {
  it('insert, list with filters, patch (deep merge) and cancel', async () => {
    const ins = await t.json('POST', '/api/__test/remote/events', { summary: 'From Google', start: { dateTime: '2026-10-14T10:00:00+02:00' }, end: { dateTime: '2026-10-14T11:00:00+02:00' }, calendarId: 'work', extendedProperties: { private: { a: '1' } } });
    expect(ins.status).toBe(201);
    expect(ins.body).toMatchObject({ calendarId: 'work', status: 'confirmed', sequence: 0 });
    expect(ins.body.etag).toBeTruthy();
    const items = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15');
    expect(items.body.items[0]).toMatchObject({ kind: 'event', title: 'From Google', calendarId: 'work' });
    expect((await t.json('GET', '/api/__test/remote/events?q=From%20Google')).body.items).toHaveLength(1);
    expect((await t.json('GET', '/api/__test/remote/events?q=nope')).body.items).toHaveLength(0);
    expect((await t.json('GET', '/api/__test/remote/events?calendarId=primary')).body.items).toHaveLength(0);
    const p = await t.json('PATCH', `/api/__test/remote/events/${ins.body.id}`, { extendedProperties: { private: { b: '2' } } });
    expect(p.body.extendedProperties.private).toEqual({ a: '1', b: '2' });
    expect(p.body.etag).not.toBe(ins.body.etag);
    expect((await t.req('DELETE', `/api/__test/remote/events/${ins.body.id}`)).status).toBe(204);
    expect((await t.json('GET', '/api/__test/remote/events')).body.items).toHaveLength(0);
    const cancelled = await t.json('GET', '/api/__test/remote/events?includeCancelled=true');
    expect(cancelled.body.items[0].status).toBe('cancelled');
    expect((await t.json('GET', `/api/events/${ins.body.id}`)).status).toBe(404);
    expect((await t.json('PATCH', '/api/__test/remote/events/zzz', {})).status).toBe(404);
    expect((await t.req('DELETE', '/api/__test/remote/events/zzz')).status).toBe(404);
    expect((await t.json('POST', '/api/__test/remote/events', { summary: 'no times' })).status).toBe(400);
  });

  it('remote endpoints work during an outage', async () => {
    await t.json('POST', '/api/__test/outage', { down: true });
    expect((await t.json('GET', '/api/__test/remote/events')).status).toBe(200);
    expect((await t.json('GET', '/api/__test/memory')).status).toBe(200);
  });
});

describe('rate limit (ADR 0007 through the mock)', () => {
  const range = '/api/items?from=2026-10-12&to=2026-10-19';
  const remote = (summary: string) => t.json('POST', '/api/__test/remote/events', {
    summary, start: { dateTime: '2026-10-14T09:00:00+02:00' }, end: { dateTime: '2026-10-14T10:00:00+02:00' },
  });

  it('serves the last read as stale data, without a banner-worthy error, until the cooldown ends', async () => {
    await remote('Dentist');
    expect((await t.json('GET', range)).body.items.map((i: any) => i.title)).toEqual(['Dentist']);
    expect((await t.json('POST', '/api/__test/rate-limit', { retryAfterSec: 1 })).status).toBe(200);
    await remote('Call mom');
    const r = await t.json('GET', range);
    expect(r.status).toBe(200);
    expect(r.res.headers.get('x-stale')).toBe('1');
    expect(r.body.stale).toBe(true);
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Dentist']);
    const w = await t.json('POST', '/api/events', { title: 'x', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    expect([w.status, w.body.error.code]).toEqual([503, 'RATE_LIMITED']);
    await new Promise((res) => setTimeout(res, 1100));
    const after = await t.json('GET', range);
    expect(after.res.headers.get('x-stale')).toBeNull();
    expect(after.body.items.map((i: any) => i.title).sort()).toEqual(['Call mom', 'Dentist']);
  });

  it('is cleared by a reset', async () => {
    await t.json('GET', range);
    await t.json('POST', '/api/__test/rate-limit', { retryAfterSec: 60 });
    // a real cooldown is running: the read is stale
    expect((await t.json('GET', range)).res.headers.get('x-stale')).toBe('1');
    await t.json('POST', '/api/__test/reset');
    const r = await t.json('GET', range);
    expect([r.status, r.res.headers.get('x-stale')]).toEqual([200, null]);
  });

  it('rejects a bad body', async () => {
    expect((await t.json('POST', '/api/__test/rate-limit', { retryAfterSec: 0 })).status).toBe(400);
  });
});

describe('motivation / outage / memory', () => {
  it('sets history and plant', async () => {
    await freeze(t);
    const r = await t.json('POST', '/api/__test/motivation', { checkIns: ['2026-10-10', '2026-10-11'], plant: { growth: 100, lastWatered: '2026-10-11', todayPoints: 5 } });
    expect(r.body.streak).toEqual({ current: 2, best: 2, lastCheckIn: '2026-10-11', checkedInToday: false });
    expect(r.body.plant).toMatchObject({ growth: 100, stage: 'Small plant', todayPoints: 5, flowers: 2 });
    expect((await t.json('POST', '/api/__test/motivation', { checkIns: ['bad'] })).status).toBe(400);
  });
  it('memory reports numbers (gc optional)', async () => {
    const m = await t.json('GET', '/api/__test/memory?gc=true');
    expect(Object.keys(m.body).sort()).toEqual(['external', 'heapTotal', 'heapUsed', 'rss']);
    expect(m.body.rss).toBeGreaterThan(0);
  });
});

describe('seed and demo reset (mock mode, TEST_MODE off)', () => {
  const dirs: string[] = [];
  afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

  it('seeds ~25 events and ~6 lists relative to now with streak/plant/sunflower history', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-seed-')); dirs.push(dir);
    const app = buildApp({ ...loadConfig({ DATA_DIR: dir }), webDist: null });
    await app.ctx.seed();
    const today = app.ctx.motivation.today();
    const from = new Date(Date.parse(today) - 14 * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.parse(today) + 35 * 86400000).toISOString().slice(0, 10);
    const all = (await (await app.request(`/api/items?from=${from}&to=${to}`)).json()).items;
    const events = all.filter((i: any) => i.kind === 'event');
    const lists = all.filter((i: any) => i.kind === 'tasklist');
    expect(events.length).toBeGreaterThanOrEqual(24);
    expect(lists.length).toBeGreaterThanOrEqual(6);
    expect(events.some((e: any) => e.allDay && e.end > e.start)).toBe(true);
    expect(new Set(lists.map((l: any) => l.categoryId))).toEqual(new Set(['shopping', 'home', 'todo', 'work']));
    expect(lists.some((l: any) => l.doneCount > 0 && l.doneCount < l.totalCount)).toBe(true);
    const open = (await (await app.request(`/api/tasklists/open?today=${today}`)).json()).items;
    expect(open.some((l: any) => l.date < today)).toBe(true); // carried over
    const m = await (await app.request('/api/motivation')).json();
    expect(m.streak.current).toBeGreaterThanOrEqual(5);
    expect(m.streak.checkedInToday).toBe(false);
    expect(m.plant.flowers).toBeGreaterThanOrEqual(3);
    expect(m.plant.mood).toBe('happy');
    // demo reset restores the data after changes
    for (const e of events.slice(0, 5)) await app.request(`/api/events/${e.id}`, { method: 'DELETE' });
    expect((await app.request('/api/demo/reset', { method: 'POST' })).status).toBe(200);
    const after = (await (await app.request(`/api/items?from=${from}&to=${to}`)).json()).items;
    expect(after.length).toBe(all.length);
    app.close();
  });

  it('demo reset works on an empty mock store', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cal-seed-')); dirs.push(dir);
    const app = buildApp({ ...loadConfig({ DATA_DIR: dir }), webDist: null });
    expect((await app.request('/api/demo/reset', { method: 'POST' })).status).toBe(200);
    app.close();
  });

  it('SEED=false and TEST_MODE disable seeding (config)', () => {
    expect(loadConfig({ SEED: 'false' }).seed).toBe(false);
    expect(loadConfig({ TEST_MODE: 'true' }).seed).toBe(false);
    expect(loadConfig({}).seed).toBe(true);
  });
});

describe('CORS and config', () => {
  it('allows only configured origins', async () => {
    const p = makeApp({ PUBLIC_URL: 'http://cal.mordor.local/', ALLOWED_ORIGINS: 'http://localhost:5173' });
    try {
      expect(p.app.ctx.config.allowedOrigins).toEqual(['http://cal.mordor.local', 'http://localhost:5173']);
      const ok = await p.req('GET', '/api/health', undefined, { Origin: 'http://localhost:5173' });
      expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      const bad = await p.req('GET', '/api/health', undefined, { Origin: 'http://evil.example' });
      expect(bad.headers.get('access-control-allow-origin')).toBeNull();
      expect((await p.json('GET', '/api/config')).body.publicUrl).toBe('http://cal.mordor.local');
    } finally { p.cleanup(); }
  });
});

describe('slow server (feature last-known-state)', () => {
  it('delays every /api answer but the test hooks until reset; validates', async () => {
    expect((await t.json('POST', '/api/__test/slow', { ms: 300 })).body).toEqual({ ms: 300 });
    let started = Date.now();
    expect((await t.json('GET', '/api/settings')).status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    started = Date.now();
    await t.json('GET', '/api/__test/pushes');
    expect(Date.now() - started).toBeLessThan(250);
    expect((await t.json('POST', '/api/__test/slow', { ms: -1 })).status).toBe(400);
    await t.json('POST', '/api/__test/reset');
    started = Date.now();
    await t.json('GET', '/api/settings');
    expect(Date.now() - started).toBeLessThan(250);
  });
});
