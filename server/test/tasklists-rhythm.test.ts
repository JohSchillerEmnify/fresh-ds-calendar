/** Changing how a repeating list repeats (feature tasklist-repeating): `PATCH /api/tasklists/:id?scope=following|all` with `recurrence`. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
// today is 2026-10-12
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const create = async (extra: object = {}) =>
  (await t.json('POST', '/api/tasklists', { title: 'Clean', date: '2026-10-12', recurrence: 'weekly', items: [{ title: 'Sink' }, { title: 'Floor' }], ...extra })).body;
const lists = async (to = '2026-11-02') => (await t.json('GET', `/api/items?from=2026-10-12&to=${to}`)).body.items.filter((i: any) => i.kind === 'tasklist');
const dates = async (to?: string) => (await lists(to)).map((i: any) => i.date);
const on = async (date: string) => (await lists()).find((i: any) => i.date === date);
const tick = async (date: string, n = 0) => { const w = await on(date); await t.json('PATCH', `/api/tasklists/${w.id}/items/${w.items[n].id}`, { done: true }); };
const remote = async () => (await t.json('GET', '/api/__test/remote/events')).body.items.filter((e: any) => e.status !== 'cancelled');
const change = (id: string, scope: string, recurrence: string | null) => t.json('PATCH', `/api/tasklists/${id}?scope=${scope}`, { recurrence });

describe('this and all following lists', () => {
  it('splits from week 2: the old series ends with it, a daily series starts after it, earlier lists stay', async () => {
    const a = await create();
    const week2 = await on('2026-10-19');
    const r = await change(week2.id, 'following', 'daily');
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(week2.id);
    expect(await dates('2026-10-23')).toEqual(['2026-10-12', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
    const masters = (await remote()).filter((e: any) => e.recurrence);
    const old = masters.find((e: any) => e.id === a.seriesId);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261019');
    const fresh = masters.find((e: any) => e.id !== a.seriesId);
    expect(fresh.recurrence).toEqual(['RRULE:FREQ=DAILY']);
    expect(fresh.start).toEqual({ date: '2026-10-20' });
    expect(fresh.extendedProperties.private.series).toBe(a.seriesId);
    expect(fresh.extendedProperties.private.since).toBe('2026-10-12');
    expect((await lists('2026-10-23')).every((l: any) => l.seriesKey === a.seriesId)).toBe(true);
  });

  it('keeps single lists before the point (and the shown one), drops those after it', async () => {
    await create();
    await tick('2026-10-12', 0);
    await tick('2026-10-19', 1);
    await tick('2026-10-26', 0);
    const week2 = await on('2026-10-19');
    await change(week2.id, 'following', 'daily');
    expect((await on('2026-10-12')).doneCount).toBe(1);
    expect((await on('2026-10-19')).doneCount).toBe(1);
    expect((await on('2026-10-26')).doneCount).toBe(0);
    // no leftover exception of the old series after its end
    expect((await remote()).filter((e: any) => e.recurringEventId && e.start.date > '2026-10-19' && e.extendedProperties?.private?.series === undefined)).toEqual([]);
  });

  it('a series split earlier: the later part goes, the new rhythm takes over', async () => {
    await create({ items: [{ title: 'Sink' }] });
    const week2 = await on('2026-10-19');
    await t.json('PATCH', `/api/tasklists/${week2.id}?scope=following`, { title: 'Bathroom' });
    const week3 = await on('2026-10-26');
    expect(week3.title).toBe('Bathroom');
    await change(week2.id, 'following', 'monthly');
    expect(await dates('2026-12-01')).toEqual(['2026-10-12', '2026-10-19', '2026-11-19']);
    expect((await remote()).filter((e: any) => e.recurrence && !e.recurringEventId)).toHaveLength(2);
    expect((await on('2026-10-19')).title).toBe('Bathroom');
  });

  it('from the first list of a series the rhythm is replaced in place', async () => {
    const a = await create();
    const first = await on('2026-10-12');
    expect((await change(first.id, 'following', 'daily')).status).toBe(200);
    expect(await dates('2026-10-15')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect((await remote()).filter((e: any) => e.recurrence).map((e: any) => [e.id, e.recurrence])).toEqual([[a.seriesId, ['RRULE:FREQ=DAILY']]]);
  });

  it('from the first list, single lists after it go back to what the series says (their day stays)', async () => {
    await create();
    await tick('2026-10-19', 0);
    await change((await on('2026-10-12')).id, 'following', 'daily');
    expect((await on('2026-10-19')).doneCount).toBe(0);
    expect(await dates('2026-10-21')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  });

  it('turns a COUNT rule into an UNTIL at the split', async () => {
    const a = await create();
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY;COUNT=6'] });
    const week3 = await on('2026-10-26');
    expect((await change(week3.id, 'following', 'daily')).status).toBe(200);
    const old = (await remote()).find((e: any) => e.id === a.seriesId);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261026');
    expect(await dates('2026-10-29')).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-10-27', '2026-10-28']);
  });

  it('ending: the shown list becomes a list of its own, later ones are gone, earlier ones stay', async () => {
    await create();
    await tick('2026-10-19', 0);
    const week2 = await on('2026-10-19');
    const r = await change(week2.id, 'following', null);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: '2026-10-19', recurrence: null, doneCount: 1 });
    expect(r.body.seriesId).toBeUndefined();
    expect(await dates()).toEqual(['2026-10-12', '2026-10-19']);
  });

  it('refuses: a shared or non-repeating list, an unchanged rhythm is a no-op, a body with more than the rhythm', async () => {
    const one = (await t.json('POST', '/api/tasklists', { title: 'One', date: '2026-10-14' })).body;
    expect((await change(one.id, 'following', 'daily')).status).toBe(400);
    await create();
    const w = await on('2026-10-19');
    expect((await t.json('PATCH', `/api/tasklists/${w.id}?scope=following`, { recurrence: 'daily', title: 'X' })).status).toBe(400);
    expect((await change(w.id, 'following', 'weekly')).status).toBe(200);
    expect((await lists()).filter((l: any) => l.title === 'Clean').map((l: any) => l.date)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    expect((await t.json('PATCH', `/api/tasklists/${w.id}`, { recurrence: 'daily' })).status).toBe(400);
    expect((await t.json('PATCH', `/api/tasklists/${w.id}/items/${w.items[0].id}?scope=all`, { title: 'X' })).status).toBe(400);
  });
});

describe('all lists', () => {
  it('replaces the rule of the whole list, also of its parts; single lists from today on are dropped, earlier ones kept', async () => {
    const a = await create();
    await tick('2026-10-12', 0);
    const week2 = await on('2026-10-19');
    await t.json('PATCH', `/api/tasklists/${week2.id}?scope=following`, { title: 'Bathroom' });
    await tick('2026-10-26', 1);
    const week3 = await on('2026-10-26');
    const r = await change(week3.id, 'all', 'daily');
    expect(r.status).toBe(200);
    expect(await dates('2026-10-16')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    // 2026-10-12 is today, so its tick is dropped too
    const masters = (await remote()).filter((e: any) => e.recurrence && !e.recurringEventId);
    expect(masters).toHaveLength(1);
    expect(masters[0].id).toBe(a.seriesId);
    expect(masters[0].recurrence).toEqual(['RRULE:FREQ=DAILY']);
    expect((await on('2026-10-26'))?.title).toBe('Clean');
    expect((await on('2026-10-26')).doneCount).toBe(0);
    expect((await on('2026-10-12')).doneCount).toBe(0);
  });

  it('keeps single lists dated before today', async () => {
    await create();
    await tick('2026-10-12', 0);
    await t.json('POST', '/api/__test/clock', { now: '2026-10-20T08:00:00+02:00' });
    const w = await on('2026-10-26');
    await change(w.id, 'all', 'daily');
    expect((await on('2026-10-12')).doneCount).toBe(1);
    expect(await dates('2026-10-16')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('refuses to end the whole list from a later one', async () => {
    await create();
    const w = await on('2026-10-19');
    expect((await change(w.id, 'all', null)).status).toBe(400);
  });
});
