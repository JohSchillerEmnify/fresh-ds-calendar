/** Changing how a repeating list repeats (feature tasklist-repeating): `PATCH /api/tasklists/:id?scope=following|all` with `recurrence`. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
// today is 2026-10-12
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

interface Row { id: string; kind: string; date: string; title: string; doneCount: number; seriesKey?: string; seriesId?: string; items: { id: string }[] }
interface Raw { id: string; status?: string; recurrence?: string[]; recurringEventId?: string; start: { date?: string }; extendedProperties?: { private?: Record<string, string> } }
const create = async (extra: object = {}) =>
  (await t.json('POST', '/api/tasklists', { title: 'Clean', date: '2026-10-12', recurrence: 'weekly', items: [{ title: 'Sink' }, { title: 'Floor' }], ...extra })).body;
const lists = async (to = '2026-11-02') => (await t.json('GET', `/api/items?from=2026-10-12&to=${to}`)).body.items.filter((i: Row) => i.kind === 'tasklist');
const dates = async (to?: string) => (await lists(to)).map((i: Row) => i.date);
const on = async (date: string) => (await lists()).find((i: Row) => i.date === date);
const tick = async (date: string, n = 0) => { const w = await on(date); await t.json('PATCH', `/api/tasklists/${w.id}/items/${w.items[n].id}`, { done: true }); };
const remote = async () => (await t.json('GET', '/api/__test/remote/events')).body.items.filter((e: Raw) => e.status !== 'cancelled');
const change = (id: string, scope: string, recurrence: string | null) => t.json('PATCH', `/api/tasklists/${id}?scope=${scope}`, { recurrence });

describe('this and all following lists', () => {
  it('splits from week 2: the old series ends before it, a daily series starts at it with its data, earlier lists stay', async () => {
    const a = await create();
    const week2 = await on('2026-10-19');
    const r = await change(week2.id, 'following', 'daily');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: '2026-10-19', recurrence: 'daily' });
    expect(await dates('2026-10-23')).toEqual(['2026-10-12', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
    const masters = (await remote()).filter((e: Raw) => e.recurrence);
    const old = masters.find((e: Raw) => e.id === a.seriesId);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261018');
    const fresh = masters.find((e: Raw) => e.id !== a.seriesId);
    expect(fresh.recurrence).toEqual(['RRULE:FREQ=DAILY']);
    expect(fresh.start).toEqual({ date: '2026-10-19' });
    expect(fresh.extendedProperties.private.series).toBe(a.seriesId);
    expect(fresh.extendedProperties.private.since).toBe('2026-10-12');
    expect((await lists('2026-10-23')).every((l: Row) => l.seriesKey === a.seriesId)).toBe(true);
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
    expect((await remote()).filter((e: Raw) => e.recurringEventId && e.start.date > '2026-10-19' && e.extendedProperties?.private?.series === undefined)).toEqual([]);
  });

  it('a series split earlier: the later part goes, the new rhythm takes over', async () => {
    await create({ items: [{ title: 'Sink' }] });
    const week2 = await on('2026-10-19');
    await t.json('PATCH', `/api/tasklists/${week2.id}?scope=following`, { title: 'Bathroom' });
    const week3 = await on('2026-10-26');
    expect(week3.title).toBe('Bathroom');
    await change(week2.id, 'following', 'monthly');
    expect(await dates('2026-12-01')).toEqual(['2026-10-12', '2026-10-19', '2026-11-19']);
    expect((await remote()).filter((e: Raw) => e.recurrence && !e.recurringEventId)).toHaveLength(2);
    expect((await on('2026-10-19')).title).toBe('Bathroom');
  });

  it('from the first list of a series the rhythm is replaced in place', async () => {
    const a = await create();
    const first = await on('2026-10-12');
    expect((await change(first.id, 'following', 'daily')).status).toBe(200);
    expect(await dates('2026-10-15')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect((await remote()).filter((e: Raw) => e.recurrence).map((e: Raw) => [e.id, e.recurrence])).toEqual([[a.seriesId, ['RRULE:FREQ=DAILY']]]);
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
    const old = (await remote()).find((e: Raw) => e.id === a.seriesId);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261025');
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
    expect((await lists()).filter((l: Row) => l.title === 'Clean').map((l: Row) => l.date)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    expect((await t.json('PATCH', `/api/tasklists/${w.id}`, { recurrence: 'daily' })).status).toBe(400);
    expect((await t.json('PATCH', `/api/tasklists/${w.id}/items/${w.items[0].id}?scope=all`, { done: true })).status).toBe(400);
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
    const masters = (await remote()).filter((e: Raw) => e.recurrence && !e.recurringEventId);
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

describe('review fixes', () => {
  const count = async (date: string) => (await lists()).filter((l: Row) => l.date === date).length;

  it('B1 ending an untouched list shows the shown day once, all-day and timed', async () => {
    await create();
    await change((await on('2026-10-19')).id, 'following', null);
    expect(await count('2026-10-19')).toBe(1);
    await t.req('POST', '/api/__test/reset');
    await freeze(t);
    await create({ time: '09:00' });
    await change((await on('2026-10-19')).id, 'following', null);
    expect(await count('2026-10-19')).toBe(1);
  });

  it('B2 all lists keeps past single lists of earlier-split parts (on the new rhythm or as lists of their own)', async () => {
    await create();
    await t.json('PATCH', `/api/tasklists/${(await on('2026-10-19')).id}?scope=following`, { title: 'Bathroom' });
    await tick('2026-10-26', 0);
    await t.json('POST', '/api/__test/clock', { now: '2026-11-03T08:00:00+01:00' });
    await change((await on('2026-10-26')).id, 'all', 'daily');
    expect(await count('2026-10-26')).toBe(1);
    expect((await on('2026-10-26')).doneCount).toBe(1);
    await t.req('POST', '/api/__test/reset');
    await freeze(t);
    await create();
    await t.json('PATCH', `/api/tasklists/${(await on('2026-10-19')).id}?scope=following`, { title: 'Bathroom' });
    await tick('2026-10-26', 0);
    await t.json('POST', '/api/__test/clock', { now: '2026-11-03T08:00:00+01:00' });
    await change((await on('2026-10-26')).id, 'all', 'monthly');
    expect(await count('2026-10-26')).toBe(1);
    expect((await on('2026-10-26')).doneCount).toBe(1);
    expect((await on('2026-10-26')).title).toBe('Bathroom');
  });

  it('B3 a title and an item added for all lists reach every part, then the rhythm changes', async () => {
    await create();
    const w2 = await on('2026-10-19');
    await t.json('PATCH', `/api/tasklists/${w2.id}?scope=following`, { title: 'Later' });
    expect((await t.json('PATCH', `/api/tasklists/${w2.id}?scope=all`, { title: 'Bathroom' })).status).toBe(200);
    expect((await t.json('POST', `/api/tasklists/${w2.id}/items?scope=all`, { title: 'Mirror' })).status).toBe(201);
    const ls = await lists();
    expect(ls.map((l: Row) => l.title)).toEqual(['Bathroom', 'Bathroom', 'Bathroom']);
    expect(ls.every((l: Row) => l.items.length === 3)).toBe(true);
    await change(w2.id, 'all', 'daily');
    expect((await on('2026-10-20')).title).toBe('Bathroom');
    expect((await on('2026-10-20')).items).toHaveLength(3);
  });

  it('S4 single lists on dates the new rhythm does not produce do not stay (weekly to monthly)', async () => {
    await create();
    await tick('2026-10-19', 0);
    await tick('2026-10-26', 0);
    await t.json('POST', '/api/__test/clock', { now: '2026-10-21T08:00:00+02:00' });
    await change((await on('2026-10-19')).id, 'all', 'monthly');
    expect(await count('2026-10-26')).toBe(0);
    expect(await count('2026-10-19')).toBe(1);
    await t.req('POST', '/api/__test/reset');
    await freeze(t);
    await create();
    await tick('2026-10-26', 0);
    await change((await on('2026-10-12')).id, 'following', 'monthly');
    expect(await count('2026-10-26')).toBe(0);
    expect(await dates('2026-11-20')).toEqual(['2026-10-12', '2026-11-12']);
  });

  it('the same rhythm as the first series is nothing for all lists', async () => {
    await create();
    const w2 = await on('2026-10-19');
    await change(w2.id, 'following', 'daily');
    expect((await change((await on('2026-10-20')).id, 'all', 'daily')).status).toBe(200);
    expect(await count('2026-10-13')).toBe(1);
  });
});

describe('all lists never change a past list', () => {
  const full = async () => (await lists()).map((l: Row & { completedOn?: string | null }) => `${l.date} ${l.title} ${(l.items as { title: string; done: boolean }[]).map((i) => `${i.title}:${i.done ? 1 : 0}`).join(',')} ${l.completedOn ?? '-'}`);
  const seeded = async () => {
    await create();
    for (const i of (await on('2026-10-12')).items) await t.json('PATCH', `/api/tasklists/${(await on('2026-10-12')).id}/items/${i.id}`, { done: true });
    await t.json('POST', '/api/__test/clock', { now: '2026-10-21T08:00:00+02:00' });
    return full();
  };
  const at = async (date: string) => (await lists('2026-11-09')).find((l: Row) => l.date === date);
  const sameBefore = async (was: string[], keep = 2) => expect((await full()).slice(0, keep)).toEqual(was.slice(0, keep));

  it('C1 an item added, renamed or removed for all lists leaves the lists before today as they were', async () => {
    const was = await seeded();
    const w2 = await on('2026-10-19');
    await t.json('POST', `/api/tasklists/${w2.id}/items?scope=all`, { title: 'Mirror' });
    await sameBefore(was);
    expect((await on('2026-10-26')).items.map((i: { title: string }) => i.title)).toEqual(['Sink', 'Floor', 'Mirror']);
    await t.json('PATCH', `/api/tasklists/${w2.id}/items/${w2.items[0].id}?scope=all`, { title: 'Basin' });
    await sameBefore(was);
    expect((await on('2026-10-26')).items[0].title).toBe('Basin');
    await t.json('DELETE', `/api/tasklists/${w2.id}/items/${w2.items[1].id}?scope=all`);
    await sameBefore(was);
    expect((await at('2026-11-02')).items.map((i: { title: string }) => i.title)).toEqual(['Basin', 'Mirror']);
    await t.json('PUT', `/api/tasklists/${w2.id}/items/order?scope=all`, { itemIds: [(await on('2026-10-26')).items[1].id, w2.items[0].id] });
    await sameBefore(was);
    expect((await on('2026-10-26')).items.map((i: { title: string }) => i.title)).toEqual(['Mirror', 'Basin']);
  });

  it('C1 a title for all lists leaves the lists before today alone', async () => {
    const was = await seeded();
    const w4 = await on('2026-10-26');
    const r = await t.json('PATCH', `/api/tasklists/${w4.id}?scope=all`, { title: 'Bathroom' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: '2026-10-26', title: 'Bathroom' });
    await sameBefore(was);
    expect((await on('2026-10-26')).title).toBe('Bathroom');
  });

  it('W3 a delete for all lists that failed half way can be sent again', async () => {
    await seeded();
    const w4 = await at('2026-11-02');
    await t.json('PATCH', `/api/tasklists/${(await on('2026-10-26')).id}/items/${(await on('2026-10-26')).items[0].id}`, { done: true });
    const w2 = await on('2026-10-19');
    type Write = (cal: string, id: string, patch: object, o?: unknown) => unknown;
    const proto = MockGoogleProvider.prototype as unknown as { doPatch: Write };
    const orig = proto.doPatch;
    let n = 0;
    const spy = vi.spyOn(proto, 'doPatch').mockImplementation(function (this: unknown, cal, id, patch, o) {
      if (++n === 2) throw new Error('boom');
      return orig.call(this, cal, id, patch, o);
    });
    const url = `/api/tasklists/${w2.id}/items/${w2.items[1].id}?scope=all`;
    try { expect((await t.json('DELETE', url)).status).toBeGreaterThanOrEqual(500); } finally { spy.mockRestore(); }
    expect((await t.json('DELETE', url)).status).toBe(200);
    expect((await on('2026-10-26')).items.map((i: { title: string }) => i.title)).toEqual(['Sink']);
    expect(w4.items).toHaveLength(2);
    expect((await at('2026-11-02')).items.map((i: { title: string }) => i.title)).toEqual(['Sink']);
  });

  it('W4 a past single list of the first series off the new rhythm becomes a list of its own', async () => {
    await create();
    await tick('2026-10-19', 0);
    await t.json('POST', '/api/__test/clock', { now: '2026-10-21T08:00:00+02:00' });
    await change((await on('2026-10-26')).id, 'all', 'monthly');
    const past = await on('2026-10-19');
    expect(past).toMatchObject({ doneCount: 1 });
    expect(past.seriesId).toBeUndefined();
    expect((await remote()).filter((e: Raw) => e.recurringEventId && e.start.date === '2026-10-19')).toEqual([]);
  });

  it('an answer for a list that left the rhythm is the first list from today on', async () => {
    await create();
    await t.json('POST', '/api/__test/clock', { now: '2026-10-21T08:00:00+02:00' });
    const r = await change((await on('2026-10-19')).id, 'all', 'monthly');
    expect(r.body.date >= '2026-10-21').toBe(true);
  });
});

describe('a rule that ends after a number of times (COUNT)', () => {
  const countSeries = async (time?: string) => {
    const a = await create(time ? { time } : {});
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY;COUNT=6'] });
    return a;
  };
  const titles = async () => (await lists('2026-12-07')).map((l: Row) => `${l.date} ${l.title} ${l.items.length}`);

  it.each(['following', 'all'])('a title and an added item for %s lists work and the series ends where it ended', async (scope) => {
    await countSeries();
    const w2 = await on('2026-10-19');
    expect((await t.json('PATCH', `/api/tasklists/${w2.id}?scope=${scope}`, { title: 'Bathroom' })).status).toBe(200);
    expect((await t.json('POST', `/api/tasklists/${w2.id}/items?scope=${scope}`, { title: 'Mirror' })).status).toBe(201);
    // today is 2026-10-12, so for all lists the first list changes too
    expect(await titles()).toEqual([
      scope === 'all' ? '2026-10-12 Bathroom 3' : '2026-10-12 Clean 2', '2026-10-19 Bathroom 3', '2026-10-26 Bathroom 3', '2026-11-02 Bathroom 3', '2026-11-09 Bathroom 3', '2026-11-16 Bathroom 3',
    ]);
  });

  it('a timed series keeps its last list too', async () => {
    await countSeries('09:00');
    const w2 = await on('2026-10-19');
    expect((await t.json('PATCH', `/api/tasklists/${w2.id}?scope=following`, { title: 'Bathroom' })).status).toBe(200);
    expect((await lists('2026-12-07')).map((l: Row) => l.date)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
  });
});
