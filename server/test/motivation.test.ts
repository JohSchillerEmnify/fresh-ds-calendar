import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { plantView, runs } from '../src/services/motivation.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const checkin = () => t.json('POST', '/api/streak/checkin');
const mot = async () => (await t.json('GET', '/api/motivation')).body;
const setToday = (d: string) => t.req('POST', '/api/__test/clock', { now: `${d}T08:00:00+02:00` });
const hist = (...checkIns: string[]) => t.json('POST', '/api/__test/motivation', { checkIns });

describe('streak', () => {
  it('first check-in', async () => {
    const r = await checkin();
    expect(r.body).toMatchObject({ current: 1, best: 1, checkedInToday: true, newToday: true });
    expect(r.body.motivation.streak).toEqual({ current: 1, best: 1, lastCheckIn: '2026-10-12', checkedInToday: true });
  });
  it('is idempotent per day', async () => {
    await checkin();
    const r = await checkin();
    expect(r.body).toMatchObject({ current: 1, newToday: false });
    expect(r.body.motivation.plant.growth).toBe(10);
  });
  it('increments on consecutive days', async () => {
    await hist('2026-10-09', '2026-10-10', '2026-10-11');
    expect((await checkin()).body).toMatchObject({ current: 4, best: 4, newToday: true });
  });
  it('resets quietly after a gap, keeps best', async () => {
    await hist('2026-10-08', '2026-10-09', '2026-10-10');
    expect((await checkin()).body).toMatchObject({ current: 1, best: 3 });
    await hist('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05');
    expect((await mot()).streak.best).toBe(5);
    expect((await checkin()).body).toMatchObject({ current: 1, best: 5 });
  });
  it('same-day history does not count twice', async () => {
    await hist('2026-10-11', '2026-10-12');
    const r = await checkin();
    expect(r.body).toMatchObject({ current: 2, newToday: false });
  });
  it('crosses local midnight by the app clock, incl. Berlin midnight vs UTC', async () => {
    await t.req('POST', '/api/__test/clock', { now: '2026-10-12T23:30:00Z' }); // already 13th in Berlin
    await checkin();
    expect((await mot()).streak.lastCheckIn).toBe('2026-10-13');
    await t.req('POST', '/api/__test/clock', { now: '2026-10-13T21:59:00Z' });
    expect((await checkin()).body.newToday).toBe(false);
    await t.req('POST', '/api/__test/clock', { now: '2026-10-13T22:00:00Z' });
    expect((await checkin()).body).toMatchObject({ newToday: true, current: 2 });
  });
  it('checkedInToday turns false on the next day', async () => {
    await checkin();
    await setToday('2026-10-13');
    expect((await mot()).streak.checkedInToday).toBe(false);
  });
  it('runs() computes current and best', () => {
    expect(runs([])).toEqual({ current: 0, best: 0 });
    expect(runs(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06'])).toEqual({ current: 3, best: 3 });
    expect(runs(['2026-02-27', '2026-02-28', '2026-03-01'])).toEqual({ current: 3, best: 3 });
  });
});

describe('plant points', () => {
  it('check-in +10, create +5, tick +2 (once per item per day)', async () => {
    await checkin();
    expect((await mot()).plant).toMatchObject({ growth: 10, todayPoints: 10, lastWatered: '2026-10-12' });
    const e = await t.json('POST', '/api/events', { title: 'a', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    expect(e.res.headers.get('x-motivation-changed')).toBe('1');
    const l = await t.json('POST', '/api/tasklists', { title: 'l', date: '2026-10-12', items: [{ title: 'a' }, { title: 'b' }] });
    expect(l.res.headers.get('x-motivation-changed')).toBe('1');
    expect((await mot()).plant.growth).toBe(20);
    const id = l.body.items[0].id;
    const tick = await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: true });
    expect(tick.res.headers.get('x-motivation-changed')).toBe('1');
    expect((await mot()).plant.growth).toBe(22);
    await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: false });
    const again = await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: true });
    expect(again.res.headers.get('x-motivation-changed')).toBeNull();
    expect((await mot()).plant.growth).toBe(22);
    // already-done item stays done: no points
    const noop = await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: true });
    expect(noop.res.headers.get('x-motivation-changed')).toBeNull();
  });

  it('caps at 30 per day and resets at local midnight; the next day the same item counts again', async () => {
    const l = await t.json('POST', '/api/tasklists', { title: 'l', date: '2026-10-12', items: Array.from({ length: 6 }, (_, i) => ({ title: `i${i}` })) }); // +5
    for (const it of l.body.items) await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${it.id}`, { done: true }); // +12 => 17
    await checkin(); // +10 => 27
    await t.json('POST', '/api/events', { title: 'a', allDay: true, start: '2026-10-12', end: '2026-10-13' }); // +3 (capped)
    await t.json('POST', '/api/events', { title: 'b', allDay: true, start: '2026-10-12', end: '2026-10-13' }); // +0
    expect((await mot()).plant).toMatchObject({ growth: 30, todayPoints: 30 });
    await setToday('2026-10-13');
    expect((await mot()).plant).toMatchObject({ growth: 30, todayPoints: 0 });
    const id = l.body.items[0].id;
    await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: false });
    await t.json('PATCH', `/api/tasklists/${l.body.id}/items/${id}`, { done: true });
    expect((await mot()).plant).toMatchObject({ growth: 32, todayPoints: 2, lastWatered: '2026-10-13' });
  });

  it('a capped action still waters the plant', async () => {
    await t.json('POST', '/api/__test/motivation', { plant: { growth: 100, lastWatered: '2026-10-01', todayPoints: 30 } });
    const e = await t.json('POST', '/api/events', { title: 'a', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    expect(e.res.headers.get('x-motivation-changed')).toBe('1');
    expect((await mot()).plant).toMatchObject({ growth: 100, lastWatered: '2026-10-12', mood: 'happy' });
  });

  it('failed creates award nothing', async () => {
    await t.json('POST', '/api/events', { title: '', allDay: true, start: '2026-10-12', end: '2026-10-13' });
    expect((await mot()).plant.growth).toBe(0);
  });

  it.each([
    [0, 'Seed', 0, 20], [19, 'Seed', 0, 20], [20, 'Sprout', 1, 60], [59, 'Sprout', 1, 60], [60, 'Small plant', 2, 140],
    [140, 'Leafy', 3, 280], [279, 'Leafy', 3, 280], [280, 'Flowering', 4, null], [5000, 'Flowering', 4, null],
  ])('stage at %i growth is %s', (growth, stage, idx, next) => {
    expect(plantView(growth, 0, '2026-10-12', '2026-10-12')).toMatchObject({ stage, stageIndex: idx, nextStageAt: next });
  });

  it.each([
    ['2026-10-12', 'happy', 100], ['2026-10-11', 'happy', 100], ['2026-10-10', 'thirsty', 75], ['2026-10-09', 'dry', 50],
    ['2026-10-08', 'droopy', 25], ['2026-01-01', 'droopy', 25], [null, 'happy', 100],
  ] as const)('decay: watered %s is %s (%i)', (last, mood, vitality) => {
    const p = plantView(70, 0, last, '2026-10-12');
    expect(p).toMatchObject({ mood, vitality, stage: 'Small plant', growth: 70 });
  });

  it('messages are exact', async () => {
    const msg = async (last: string) => (await t.json('POST', '/api/__test/motivation', { plant: { growth: 70, lastWatered: last } })).body.plant.message;
    expect(await msg('2026-10-12')).toBe('Your plant is happy');
    expect(await msg('2026-10-10')).toBe('Your plant is a little thirsty');
    expect(await msg('2026-10-09')).toBe('Your plant could use some water');
    expect(await msg('2026-10-01')).toBe('Your plant is resting. Anything you do will perk it up.');
  });

  it('decay follows the app clock without losing growth, and perks up when watered', async () => {
    await t.json('POST', '/api/__test/motivation', { plant: { growth: 70, lastWatered: '2026-10-12' } });
    await setToday('2026-10-20');
    expect((await mot()).plant).toMatchObject({ growth: 70, mood: 'droopy', vitality: 25 });
    await checkin();
    expect((await mot()).plant).toMatchObject({ growth: 80, mood: 'happy', vitality: 100 });
  });
});

describe('sunflowers', () => {
  it.each([[0, 0], [39, 0], [40, 1], [200, 5], [959, 23], [1199, 29], [1200, 30], [2000, 30]])('growth %i gives %i flowers', async (growth, flowers) => {
    const r = await t.json('POST', '/api/__test/motivation', { plant: { growth, lastWatered: '2026-10-12' } });
    expect(r.body.plant.flowers).toBe(flowers);
  });
  it('flowers never decrease while the plant rests', async () => {
    await t.json('POST', '/api/__test/motivation', { plant: { growth: 200, lastWatered: '2026-10-01' } });
    expect((await mot()).plant).toMatchObject({ flowers: 5, mood: 'droopy' });
  });
  it('a new flower appears when points cross a multiple of 40', async () => {
    await t.json('POST', '/api/__test/motivation', { plant: { growth: 39, lastWatered: '2026-10-11' } });
    expect((await mot()).plant.flowers).toBe(0);
    await checkin();
    expect((await mot()).plant.flowers).toBe(1);
  });
});

describe('persistence', () => {
  it('survives a restart', async () => {
    await checkin();
    t.app.ctx.motivation; // state is written synchronously
    const { buildApp } = await import('../src/app.js');
    const { loadConfig } = await import('../src/config.js');
    const again = buildApp({ ...loadConfig({ DATA_DIR: t.dir, TEST_MODE: 'false' }), webDist: null });
    const body = await (await again.request('/api/motivation')).json();
    expect(body.plant.growth).toBe(10);
    expect(body.streak.best).toBe(1);
    again.close();
  });
});
