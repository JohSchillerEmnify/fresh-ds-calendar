import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';
import { PreconditionFailedError } from '../src/providers/CalendarProvider.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const mk = async (extra: object = {}) =>
  (await t.json('POST', '/api/tasklists', { title: 'Chores', date: '2026-10-12', items: [{ title: 'Vacuum' }, { title: 'Laundry', done: true }], ...extra })).body;
const raw = async (id: string) => (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: any) => e.id === id);

describe('task lists CRUD', () => {
  it('creates with defaults and maps to a Google all-day event', async () => {
    const r = await t.json('POST', '/api/tasklists', { title: ' Chores ', date: '2026-10-12', items: [{ title: 'Vacuum' }, { title: '  ' }, { title: 'Laundry', done: true }] });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ kind: 'tasklist', title: 'Chores', date: '2026-10-12', time: null, doneCount: 1, totalCount: 2, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5' });
    expect(r.body.items[0].id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    const g = await raw(r.body.id);
    expect(g.start).toEqual({ date: '2026-10-12' });
    expect(g.end).toEqual({ date: '2026-10-13' });
    expect(g.description).toBe('☐ Vacuum\n☑ Laundry');
    expect(g.extendedProperties.private).toMatchObject({ kind: 'tasklist', tlv: '1' });
    expect(JSON.parse(g.extendedProperties.private.items)).toEqual([{ id: r.body.items[0].id, t: 'Vacuum', d: 0 }, { id: r.body.items[1].id, t: 'Laundry', d: 1 }]);
    expect(g.colorId).toBeUndefined();
  });

  it('timed lists last estimate minutes (default 30) in Berlin time', async () => {
    const a = await mk({ time: '09:15' });
    expect(a.time).toBe('09:15');
    let g = await raw(a.id);
    expect(g.start).toMatchObject({ dateTime: '2026-10-12T09:15:00+02:00', timeZone: 'Europe/Berlin' });
    expect(g.end.dateTime).toBe('2026-10-12T09:45:00+02:00');
    const b = await mk({ time: '09:15', estimateMinutes: 90 });
    g = await raw(b.id);
    expect(g.end.dateTime).toBe('2026-10-12T10:45:00+02:00');
    expect(g.extendedProperties.private.estimate).toBe('90');
    const p = await t.json('PATCH', `/api/tasklists/${b.id}`, { time: null, estimateMinutes: null });
    expect(p.body).toMatchObject({ time: null, estimateMinutes: null });
    g = await raw(b.id);
    expect(g.start).toEqual({ date: '2026-10-12' });
    expect(g.extendedProperties.private.estimate).toBeUndefined();
  });

  it('timed list across DST end (2026-10-25 02:30 happens twice) round-trips', async () => {
    const a = await mk({ date: '2026-10-25', time: '10:00', estimateMinutes: 60 });
    expect(a).toMatchObject({ date: '2026-10-25', time: '10:00' });
    expect((await raw(a.id)).start.dateTime).toBe('2026-10-25T10:00:00+01:00');
  });

  it('stores category, tags and colorId (nearest Google color)', async () => {
    const r = await mk({ categoryId: 'shopping', tags: ['Weekly', 'food'] });
    expect(r).toMatchObject({ categoryId: 'shopping', tags: ['Weekly', 'food'], color: '#0b8043' });
    const g = await raw(r.id);
    expect(g.colorId).toBe('10');
    expect(g.extendedProperties.private.categoryId).toBe('shopping');
    expect(JSON.parse(g.extendedProperties.private.tags)).toEqual(['Weekly', 'food']);
    const p = await t.json('PATCH', `/api/tasklists/${r.id}`, { categoryId: null, tags: [] });
    expect(p.body).toMatchObject({ categoryId: null, tags: [], color: '#039be5' });
    const g2 = await raw(r.id);
    expect(g2.colorId).toBeUndefined();
    expect(g2.extendedProperties.private.categoryId).toBeUndefined();
    expect(g2.extendedProperties.private.tags).toBeUndefined();
  });

  it('a custom category color maps to the nearest Google colorId', async () => {
    const c = await t.json('POST', '/api/categories', { name: 'Reds', color: '#C43E00' });
    const id = c.body.categories.at(-1).id;
    expect(c.body.categories.at(-1).googleColorId).toBe('6');
    const r = await mk({ categoryId: id });
    expect(r.color).toBe('#c43e00');
    expect((await raw(r.id)).colorId).toBe('6');
  });

  it('unknown category -> 400; deleted category -> null in API but kept in Google', async () => {
    expect((await t.json('POST', '/api/tasklists', { title: 'x', date: '2026-10-12', categoryId: 'nope' })).status).toBe(400);
    const r = await mk({ categoryId: 'home' });
    await t.json('DELETE', '/api/categories/home');
    const g = await t.json('GET', `/api/tasklists/${r.id}`);
    expect(g.body.categoryId).toBeNull();
    expect(g.body.color).toBe('#039be5');
    expect((await raw(r.id)).extendedProperties.private.categoryId).toBe('home');
    // item ops still work with the stale category
    expect((await t.json('POST', `/api/tasklists/${r.id}/items`, { title: 'more' })).status).toBe(201);
  });

  it('validates fields', async () => {
    const bad: object[] = [
      { title: '', date: '2026-10-12' }, { title: 'a' }, { title: 'a', date: '2026-02-30' }, { title: 'a', date: '2026-10-12', time: '25:00' },
      { title: 'a', date: '2026-10-12', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, { title: 'a', date: '2026-10-12', tags: ['a,b'] },
      { title: 'a', date: '2026-10-12', tags: ['Tag', 'tag'] }, { title: 'a', date: '2026-10-12', estimateMinutes: 3 },
      { title: 'a', date: '2026-10-12', estimateMinutes: 721 }, { title: 'a', date: '2026-10-12', recurrence: 'yearly' },
      { title: 'a', date: '2026-10-12', extra: 1 }, { title: 'a', date: '2026-10-12', items: Array.from({ length: 201 }, () => ({ title: 'i' })) },
    ];
    for (const b of bad) expect((await t.json('POST', '/api/tasklists', b)).status, JSON.stringify(b).slice(0, 60)).toBe(400);
    const u = await t.json('POST', '/api/tasklists', { title: 'a', date: '2026-10-12', extra: 1 });
    expect(u.body.error.message).toBe('Unknown field');
    expect((await t.json('POST', '/api/tasklists', { date: '2026-10-12' })).body.error.message).toBe('Title is required');
  });

  it('accepts an empty or blank title when there is an item; leaves the Google summary empty', async () => {
    for (const title of ['', '   ']) {
      const r = await t.json('POST', '/api/tasklists', { title, date: '2026-10-12', items: [{ title: 'Milk' }, { title: ' ' }, { title: 'Eggs' }] });
      expect(r.status).toBe(201);
      expect(r.body.title).toBe('');
      const g = await raw(r.body.id);
      expect(g.summary).toBe('');
      expect(g.extendedProperties.private.untitled).toBe('1');
      expect((await t.json('GET', `/api/tasklists/${r.body.id}`)).body.title).toBe('');
    }
  });

  it('needs a title or an item (create, PATCH and deleting the last item)', async () => {
    for (const b of [{ title: '', date: '2026-10-12' }, { title: '  ', date: '2026-10-12', items: [{ title: ' ' }] }]) {
      const r = await t.json('POST', '/api/tasklists', b);
      expect(r.status).toBe(400);
      expect(r.body.error.message).toBe('Add a title or an item');
    }
    const a = await mk({ items: [{ title: 'Milk' }] });
    const p = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: '', items: [] });
    expect(p.status).toBe(400);
    expect(p.body.error.message).toBe('Add a title or an item');
    const u = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: '' });
    expect(u.status).toBe(200);
    expect(u.body.title).toBe('');
    expect((await raw(a.id)).summary).toBe('');
    const d = await t.json('DELETE', `/api/tasklists/${a.id}/items/${u.body.items[0].id}`);
    expect(d.status).toBe(400);
    expect(d.body.error.message).toBe('Add a title or an item');
    const named = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: 'Shop' });
    expect(named.body.title).toBe('Shop');
    const g = await raw(a.id);
    expect(g.summary).toBe('Shop');
    expect(g.extendedProperties.private.untitled).toBeUndefined();
  });

  it('rejects over-large lists', async () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ title: `${i}`.padEnd(200, 'x') }));
    const r = await t.json('POST', '/api/tasklists', { title: 'big', date: '2026-10-12', items });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('Task list is too large');
  });

  it('detail edits use If-Match; stale -> 412 (PATCH and DELETE)', async () => {
    const a = await mk();
    const ok = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: 'New' }, { 'If-Match': a.etag });
    expect(ok.body.title).toBe('New');
    const stale = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: 'Newer' }, { 'If-Match': a.etag });
    expect(stale.status).toBe(412);
    expect((await t.req('DELETE', `/api/tasklists/${a.id}`, undefined, { 'If-Match': a.etag })).status).toBe(412);
    expect((await t.req('DELETE', `/api/tasklists/${a.id}`, undefined, { 'If-Match': ok.body.etag })).status).toBe(204);
    expect((await t.json('GET', `/api/tasklists/${a.id}`)).status).toBe(404);
  });

  it('PATCH items replaces the list (keeps given ids, drops blanks)', async () => {
    const a = await mk();
    const keep = a.items[0].id;
    const p = await t.json('PATCH', `/api/tasklists/${a.id}`, { items: [{ id: keep, title: 'Vacuum', done: true }, { title: 'New', done: false }, { title: ' ', done: false }] });
    expect(p.body.items.map((i: any) => [i.id === keep, i.title, i.done])).toEqual([[true, 'Vacuum', true], [false, 'New', false]]);
    expect(p.body.doneCount).toBe(1);
  });
});

describe('item operations', () => {
  it('adds, ticks, renames, removes and reorders', async () => {
    const a = await mk();
    const add = await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'Dust', index: 0 });
    expect(add.status).toBe(201);
    expect(add.body.items.map((i: any) => i.title)).toEqual(['Dust', 'Vacuum', 'Laundry']);
    const dust = add.body.items[0].id;
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${dust}`, { done: true });
    expect(tick.body.doneCount).toBe(2);
    const ren = await t.json('PATCH', `/api/tasklists/${a.id}/items/${dust}`, { title: 'Dust shelves' });
    expect(ren.body.items[0]).toMatchObject({ title: 'Dust shelves', done: true });
    const ids = ren.body.items.map((i: any) => i.id).reverse();
    const ord = await t.json('PUT', `/api/tasklists/${a.id}/items/order`, { itemIds: ids });
    expect(ord.body.items.map((i: any) => i.id)).toEqual(ids);
    const del = await t.json('DELETE', `/api/tasklists/${a.id}/items/${dust}`);
    expect(del.status).toBe(200);
    expect(del.body.totalCount).toBe(2);
    expect((await raw(a.id)).description).toBe('☑ Laundry\n☐ Vacuum');
  });

  it('errors: blank title, unknown item, bad permutation, 200 item limit', async () => {
    const a = await mk();
    expect((await t.json('POST', `/api/tasklists/${a.id}/items`, { title: '  ' })).status).toBe(400);
    expect((await t.json('PATCH', `/api/tasklists/${a.id}/items/nope`, { done: true })).status).toBe(404);
    expect((await t.json('DELETE', `/api/tasklists/${a.id}/items/nope`)).status).toBe(404);
    expect((await t.json('PUT', `/api/tasklists/${a.id}/items/order`, { itemIds: [a.items[0].id] })).status).toBe(400);
    expect((await t.json('PUT', `/api/tasklists/${a.id}/items/order`, { itemIds: [a.items[0].id, a.items[0].id] })).status).toBe(400);
    expect((await t.json('POST', '/api/tasklists/zzz/items', { title: 'x' })).status).toBe(404);
    const full = await mk({ items: Array.from({ length: 200 }, (_, i) => ({ title: `i${i}` })) });
    expect((await t.json('POST', `/api/tasklists/${full.id}/items`, { title: 'one more' })).status).toBe(400);
  });

  it('merges concurrent remote ticks (item ops do not need If-Match)', async () => {
    const a = await mk();
    // Google app ticks "Vacuum" remotely
    const g = await raw(a.id);
    const items = JSON.parse(g.extendedProperties.private.items);
    items[0].d = 1;
    await t.json('PATCH', `/api/__test/remote/events/${a.id}`, { extendedProperties: { private: { items: JSON.stringify(items) } } });
    const r = await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'New' });
    expect(r.body.items.map((i: any) => [i.title, i.done])).toEqual([['Vacuum', true], ['Laundry', true], ['New', false]]);
  });

  it('retries on a provider-side 412 up to 3 times', async () => {
    const a = await mk();
    const mock = t.app.ctx.mock!;
    const orig = mock.patchEvent.bind(mock);
    let n = 0;
    mock.patchEvent = async (c, id, p, o) => {
      if (n++ < 2) await mock.remote.patch(c, id, { summary: `remote ${n}` });
      return orig(c, id, p, o);
    };
    const r = await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'x' });
    expect(r.status).toBe(201);
    expect(n).toBe(3);
    n = -10;
    mock.patchEvent = async (c, id, p, o) => { await mock.remote.patch(c, id, { summary: 'again' }); return orig(c, id, p, o); };
    const fail = await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'y' });
    expect(fail.status).toBe(412);
    mock.patchEvent = orig;
  });
});

describe('chunking, description fallback, recurrence', () => {
  it('chunks items above 1024 chars and reads them back; removes stale chunks when shrinking', async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ title: `Item number ${i} with padding text`.padEnd(60, '.') }));
    const a = await mk({ items });
    const p = (await raw(a.id)).extendedProperties.private;
    expect(Number(p.itemsChunks)).toBeGreaterThan(1);
    expect(p.items.length).toBe(1000);
    expect(p.items_1).toBeDefined();
    expect(a.items).toHaveLength(40);
    expect((await t.json('GET', `/api/tasklists/${a.id}`)).body.items.map((i: any) => i.title)).toEqual(items.map((i) => i.title));
    await t.json('PATCH', `/api/tasklists/${a.id}`, { items: [{ title: 'only', done: false }] });
    const p2 = (await raw(a.id)).extendedProperties.private;
    expect(p2.itemsChunks).toBeUndefined();
    expect(p2.items_1).toBeUndefined();
    expect(JSON.parse(p2.items)).toHaveLength(1);
  });

  it('exactly 1024 chars stays in one property; 1025 chunks', async () => {
    const { encodeItems } = await import('../src/services/taskCodec.js');
    const mkItems = (len: number) => {
      const base = [{ id: 'abcdefgh', title: '', done: false }];
      const overhead = JSON.stringify([{ id: 'abcdefgh', t: '', d: 0 }]).length;
      base[0]!.title = 'x'.repeat(len - overhead);
      return base;
    };
    expect(encodeItems(mkItems(1024)).itemsChunks).toBeNull();
    expect(Object.keys(encodeItems(mkItems(1025))).sort()).toEqual(['items', 'itemsChunks', 'items_1'].sort());
  });

  it('parses a list created in Google with only a description', async () => {
    const { id: calendarId } = (await t.json('GET', '/api/__test/tasks-calendar')).body;
    const g = await t.json('POST', '/api/__test/remote/events', {
      calendarId,
      summary: 'Made in Google', description: '☐ Milk\n☑ Eggs\n[ ] Bread\n[x] Jam\nplain line\n\n', start: { date: '2026-10-13' }, end: { date: '2026-10-14' },
      extendedProperties: { private: { kind: 'tasklist' } },
    });
    expect(g.status).toBe(201);
    const l = await t.json('GET', `/api/tasklists/${g.body.id}`);
    expect(l.body.items.map((i: any) => [i.title, i.done])).toEqual([['Milk', false], ['Eggs', true], ['Bread', false], ['Jam', true], ['plain line', false]]);
    const again = await t.json('GET', `/api/tasklists/${g.body.id}`);
    expect(again.body.items.map((i: any) => i.id)).toEqual(l.body.items.map((i: any) => i.id)); // stable ids
    const tick = await t.json('PATCH', `/api/tasklists/${g.body.id}/items/${l.body.items[0].id}`, { done: true });
    expect(tick.body.doneCount).toBe(3);
    const priv = (await raw(g.body.id)).extendedProperties.private;
    expect(priv.items).toBeDefined(); // first app write stores proper items
    expect(priv.tlv).toBe('1');
  });

  it('daily recurrence: instances have their own ids and ticks', async () => {
    const a = await mk({ recurrence: 'daily', items: [{ title: 'Meds' }] });
    expect(a.recurrence).toBe('daily');
    const r = await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-15');
    expect(r.body.items).toHaveLength(3);
    const ids = r.body.items.map((i: any) => i.id);
    expect(new Set(ids).size).toBe(3);
    const second = r.body.items[1];
    expect(second.date).toBe('2026-10-13');
    const tick = await t.json('PATCH', `/api/tasklists/${second.id}/items/${second.items[0].id}`, { done: true });
    expect(tick.body.doneCount).toBe(1);
    const r2 = await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-15');
    expect(r2.body.items.map((i: any) => i.doneCount)).toEqual([0, 1, 0]);
    expect(r2.body.items.map((i: any) => i.recurrence)).toEqual(['daily', 'daily', 'daily']);
  });

  it('weekly and monthly recurrence step correctly', async () => {
    await mk({ recurrence: 'weekly' });
    await mk({ recurrence: 'monthly', date: '2026-01-31', title: 'Month end' });
    const w = await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-30');
    expect(w.body.items.filter((i: any) => i.title === 'Chores').map((i: any) => i.date)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    const m = await t.json('GET', '/api/items?from=2026-02-01&to=2026-04-01');
    expect(m.body.items.filter((i: any) => i.title === 'Month end').map((i: any) => i.date)).toEqual(['2026-02-28', '2026-03-31']);
  });
});

describe('recurring task lists: an item change splits off the occurrence', () => {
  const create = (extra: object = {}) => mk({ title: 'Clean', date: '2026-10-14', recurrence: 'weekly', items: [{ title: 'Sink' }, { title: 'Floor' }], ...extra });
  /** The series itself (the master), as `GET /api/tasklists/:id` hands it out. */
  const weekly = async (extra: object = {}) => {
    await create(extra);
    const master = (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: any) => e.summary === 'Clean' && e.recurrence);
    return (await t.json('GET', `/api/tasklists/${master.id}`)).body;
  };
  const weeks = async () => (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-26')).body.items
    .filter((i: any) => i.title === 'Clean').map((i: any) => [i.date, i.items.map((x: any) => `${x.title}:${x.done ? 1 : 0}`).join(',')]);

  it('a tick sent to the series (its first week) makes the first week its own; the master and the other weeks stay unticked', async () => {
    const a = await weekly();
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect(tick.status).toBe(200);
    expect(tick.body).toMatchObject({ date: '2026-10-14', doneCount: 1, recurrence: 'weekly' });
    expect(tick.body.id).not.toBe(a.id);
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:1,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
    const master = await raw(a.id);
    expect(JSON.parse(master.extendedProperties.private.items).map((i: any) => i.d)).toEqual([0, 0]);
    const exception = await raw(tick.body.id);
    expect(exception.recurringEventId).toBe(a.id);
  });

  it('unticking the split-off first week again keeps it its own and leaves the other weeks alone', async () => {
    const a = await weekly();
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    const untick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: false });
    expect(untick.body.id).toBe(tick.body.id);
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:0,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
    expect((await raw(tick.body.id)).recurringEventId).toBe(a.id);
  });

  it('renaming, adding, removing and reordering items on the series id change only the first week', async () => {
    const a = await weekly();
    const [sink, floor] = a.items;
    await t.json('PATCH', `/api/tasklists/${a.id}/items/${sink.id}`, { title: 'Basin' });
    await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'Mirror' });
    await t.json('DELETE', `/api/tasklists/${a.id}/items/${floor.id}`);
    const cur = (await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items[0];
    await t.json('PUT', `/api/tasklists/${a.id}/items/order`, { itemIds: [...cur.items].reverse().map((i: any) => i.id) });
    expect(await weeks()).toEqual([['2026-10-14', 'Mirror:0,Basin:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
  });

  it('a timed weekly list splits off its first week too', async () => {
    const a = await weekly({ time: '09:00' });
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect(tick.body).toMatchObject({ date: '2026-10-14', time: '09:00', doneCount: 1 });
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:1,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
  });

  it('editing the list itself through the series id still changes every week', async () => {
    const a = await weekly();
    const r = await t.json('PATCH', `/api/tasklists/${a.id}`, { title: 'Clean', items: [{ title: 'Tub', done: false }] });
    expect(r.body.id).toBe(a.id);
    expect(await weeks()).toEqual([['2026-10-14', 'Tub:0'], ['2026-10-21', 'Tub:0']]);
  });

  it('creating a repeating list answers with its first occurrence, the id every range read shows', async () => {
    const a = await create();
    const listed = (await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items[0];
    expect(a).toMatchObject({ id: listed.id, date: '2026-10-14', recurrence: 'weekly', totalCount: 2 });
    expect((await raw(a.id))).toBeUndefined(); // still a plain instance of the series, not an exception
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:0,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect(tick.body.id).toBe(a.id);
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:1,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0']]);
  });

  it('with the first week deleted, an item change through the series answers 404 and changes nothing', async () => {
    const a = await weekly();
    const first = (await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15')).body.items[0];
    expect((await t.req('DELETE', `/api/tasklists/${first.id}`)).status).toBe(204);
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect(tick.status).toBe(404);
    expect(await weeks()).toEqual([['2026-10-21', 'Sink:0,Floor:0']]);
  });

  it('an occurrence names its series (seriesId); the create answer too, a one-off list has none', async () => {
    const a = await create();
    const master = await weekly();
    expect(a.seriesId).toBe(master.id);
    expect(master.seriesId).toBeUndefined();
    const listed = (await t.json('GET', '/api/items?from=2026-10-19&to=2026-10-26')).body.items.find((i: any) => i.title === 'Clean');
    expect(listed.seriesId).toBe(master.id);
    expect((await mk()).seriesId).toBeUndefined();
  });

  it('deleting the series removes every week, also one that was split off', async () => {
    const a = await create();
    await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect((await t.req('DELETE', `/api/tasklists/${a.seriesId}`)).status).toBe(204);
    expect(await weeks()).toEqual([]);
  });

  it('the split-off week keeps the title, category, door tag and reminders of the series', async () => {
    const a = await create({ categoryId: 'shopping', tags: ['door'], reminders: { useDefault: false, minutes: [15] } });
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    const kept = { title: 'Clean', categoryId: 'shopping', tags: ['door'], reminders: { useDefault: false, minutes: [15] }, recurrence: 'weekly' };
    expect(tick.body).toMatchObject(kept);
    const stored = await raw(a.id);
    expect(stored).toMatchObject({ recurringEventId: a.seriesId, originalStartTime: { date: '2026-10-14' } });
    const listed = (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-26')).body.items.filter((i: any) => i.title === 'Clean');
    for (const l of listed) expect(l).toMatchObject(kept);
  });

  it('a timed weekly list: occurrences have Google ids (_YYYYMMDDTHHMMSSZ) and one week ticks on its own', async () => {
    await create({ time: '09:00' });
    const second = (await t.json('GET', '/api/items?from=2026-10-21&to=2026-10-22')).body.items[0];
    expect(second.id).toMatch(/_20261021T070000Z$/); // 09:00 Berlin summer time
    expect((await t.json('GET', `/api/tasklists/${second.id}`)).body).toMatchObject({ date: '2026-10-21', time: '09:00' });
    const tick = await t.json('PATCH', `/api/tasklists/${second.id}/items/${second.items[1].id}`, { done: true });
    expect(tick.body).toMatchObject({ id: second.id, date: '2026-10-21', time: '09:00', doneCount: 1 });
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:0,Floor:0'], ['2026-10-21', 'Sink:0,Floor:1']]);
  });

  it('two ticks on the same week at once both land (the second retries after the 412)', async () => {
    const a = await create();
    const [x, y] = a.items;
    const [r1, r2] = await Promise.all([
      t.json('PATCH', `/api/tasklists/${a.id}/items/${x.id}`, { done: true }),
      t.json('PATCH', `/api/tasklists/${a.id}/items/${y.id}`, { done: true }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await weeks()).toEqual([['2026-10-14', 'Sink:1,Floor:1'], ['2026-10-21', 'Sink:0,Floor:0']]);
  });

  it('an item change on a one-off list is not affected', async () => {
    const a = await mk();
    const tick = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}`, { done: true });
    expect(tick.body.id).toBe(a.id);
  });
});

describe('open task lists (carry-over)', () => {
  it('returns lists with open items in [today-days, today], ordered', async () => {
    await mk({ title: 'Old', date: '2026-10-05', items: [{ title: 'a' }] });
    await mk({ title: 'Too old', date: '2026-08-01', items: [{ title: 'a' }] });
    await mk({ title: 'Done', date: '2026-10-08', items: [{ title: 'a', done: true }] });
    await mk({ title: 'Empty', date: '2026-10-08', items: [] });
    await mk({ title: 'Future', date: '2026-10-13', items: [{ title: 'a' }] });
    await mk({ title: 'Timed', date: '2026-10-12', time: '09:00', items: [{ title: 'a' }] });
    await mk({ title: 'Untimed', date: '2026-10-12', items: [{ title: 'a' }] });
    await mk({ title: 'Aaa', date: '2026-10-12', items: [{ title: 'a' }] });
    const r = await t.json('GET', '/api/tasklists/open?today=2026-10-12');
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Old', 'Aaa', 'Untimed', 'Timed']);
    const wide = await t.json('GET', '/api/tasklists/open?today=2026-10-12&days=90');
    expect(wide.body.items.map((i: any) => i.title)).toContain('Too old');
    const narrow = await t.json('GET', '/api/tasklists/open?today=2026-10-12&days=2');
    expect(narrow.body.items.map((i: any) => i.title)).toEqual(['Aaa', 'Untimed', 'Timed']);
    expect((await t.json('GET', '/api/tasklists/open?today=2026-10-12&days=91')).status).toBe(400);
    expect((await t.json('GET', '/api/tasklists/open?today=bad')).status).toBe(400);
    const def = await t.json('GET', '/api/tasklists/open'); // defaults to the app clock's today
    expect(def.status).toBe(200);
  });
});

describe('summary', () => {
  it('counts per day, multi-day items on each day, density buckets', async () => {
    await t.json('POST', '/api/events', { title: 'Trip', allDay: true, start: '2026-10-12', end: '2026-10-15' });
    for (let i = 0; i < 3; i++) await t.json('POST', '/api/events', { title: `e${i}`, allDay: false, start: '2026-10-13T10:00:00+02:00', end: '2026-10-13T11:00:00+02:00' });
    await mk({ date: '2026-10-13', items: [{ title: 'a' }] });
    await mk({ title: 'done', date: '2026-10-14', items: [{ title: 'a', done: true }] });
    await t.json('POST', '/api/events', { title: 'Late', allDay: false, start: '2026-10-14T22:00:00+02:00', end: '2026-10-15T00:00:00+02:00' });
    const r = await t.json('GET', '/api/summary?from=2026-10-11&to=2026-10-16');
    expect(r.body.days).toEqual({
      '2026-10-12': { events: 1, tasklists: 0, openTasklists: 0, density: 1 },
      '2026-10-13': { events: 4, tasklists: 1, openTasklists: 1, density: 3 },
      '2026-10-14': { events: 2, tasklists: 1, openTasklists: 0, density: 2 },
    });
    expect((await t.json('GET', '/api/summary?from=2026-01-01&to=2027-12-01')).status).toBe(400);
    const big = await t.json('GET', '/api/summary?from=2026-01-01&to=2026-12-31');
    expect(big.status).toBe(200);
  });
});

describe('recurring task lists: a change for this and all following ones (scope=following)', () => {
  const create = (extra: object = {}) => mk({ title: 'Clean', date: '2026-10-14', recurrence: 'weekly', items: [{ title: 'Sink' }, { title: 'Floor' }], ...extra });
  const all = async () => (await t.json('GET', '/api/items?from=2026-10-12&to=2026-11-09')).body.items.filter((i: any) => i.kind === 'tasklist');
  const weeks = async () => (await all()).map((i: any) => [i.date, i.title, i.items.map((x: any) => `${x.title}:${x.done ? 1 : 0}`).join(',')]);
  const week = async (date: string) => (await all()).find((i: any) => i.date === date);
  const tick = async (date: string, n: number) => { const w = await week(date); await t.json('PATCH', `/api/tasklists/${w.id}/items/${w.items[n].id}`, { done: true }); };
  const remote = async () => (await t.json('GET', '/api/__test/remote/events')).body.items;

  it('adds an item from the shown one on: later ones keep their ticks, earlier ones stay as they were', async () => {
    const a = await create();
    await tick('2026-10-14', 0);
    await tick('2026-10-28', 1);
    const second = await week('2026-10-21');
    const r = await t.json('POST', `/api/tasklists/${second.id}/items?scope=following`, { title: 'Mirror' });
    expect(r.status).toBe(201);
    expect(r.body.id).toBe(second.id);
    expect(r.body.items.map((i: any) => i.title)).toEqual(['Sink', 'Floor', 'Mirror']);
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:1,Floor:0'], ['2026-10-21', 'Clean', 'Sink:0,Floor:0,Mirror:0'],
      ['2026-10-28', 'Clean', 'Sink:0,Floor:1,Mirror:0'], ['2026-11-04', 'Clean', 'Sink:0,Floor:0,Mirror:0'],
    ]);
    // Google's split: the old series ends with the shown one, a new one starts at the next and names the first series
    const masters = (await remote()).filter((e: any) => e.recurrence && e.status !== 'cancelled');
    expect(masters).toHaveLength(2);
    const old = masters.find((e: any) => e.id === a.seriesId);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261021');
    const fresh = masters.find((e: any) => e.id !== a.seriesId);
    expect(fresh.start).toEqual({ date: '2026-10-28' });
    expect(fresh.extendedProperties.private.series).toBe(a.seriesId);
    // one key for every part of the list; one item id for the added item
    const lists = await all();
    expect(new Set(lists.map((l: any) => l.seriesKey))).toEqual(new Set([a.seriesId]));
    expect(new Set(lists.filter((l: any) => l.items[2]).map((l: any) => l.items[2].id)).size).toBe(1);
  });

  it('renames the shown one and every later one, a later ticked one too (its ticks stay)', async () => {
    await create();
    await tick('2026-10-28', 1);
    const second = await week('2026-10-21');
    const r = await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: second.id, title: 'Bathroom' });
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:0'], ['2026-10-21', 'Bathroom', 'Sink:0,Floor:0'],
      ['2026-10-28', 'Bathroom', 'Sink:0,Floor:1'], ['2026-11-04', 'Bathroom', 'Sink:0,Floor:0'],
    ]);
  });

  it('from the first one nothing is split: the series and every exception change, ticks stay', async () => {
    const a = await create();
    await tick('2026-10-28', 0);
    const r = await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}?scope=following`, { title: 'Basin' });
    expect(r.status).toBe(200);
    expect(r.body.items[0]).toMatchObject({ title: 'Basin', done: false });
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Basin:0,Floor:0'], ['2026-10-21', 'Clean', 'Basin:0,Floor:0'],
      ['2026-10-28', 'Clean', 'Basin:1,Floor:0'], ['2026-11-04', 'Clean', 'Basin:0,Floor:0'],
    ]);
    expect((await remote()).filter((e: any) => e.recurrence && e.status !== 'cancelled')).toHaveLength(1);
    // the plain weeks follow the series: no new exceptions
    expect((await raw((await week('2026-10-21')).id))).toBeUndefined();
  });

  it('removes an item from the shown one on', async () => {
    const a = await create();
    await tick('2026-10-14', 1);
    const third = await week('2026-10-28');
    const r = await t.json('DELETE', `/api/tasklists/${third.id}/items/${a.items[1].id}?scope=following`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(third.id);
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:1'], ['2026-10-21', 'Clean', 'Sink:0,Floor:0'],
      ['2026-10-28', 'Clean', 'Sink:0'], ['2026-11-04', 'Clean', 'Sink:0'],
    ]);
  });

  it('a later one that was deleted stays deleted after the split', async () => {
    await create();
    expect((await t.req('DELETE', `/api/tasklists/${(await week('2026-11-04')).id}`)).status).toBe(204);
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'Bathroom' });
    expect((await weeks()).map((w: any) => w.slice(0, 2))).toEqual([['2026-10-14', 'Clean'], ['2026-10-21', 'Bathroom'], ['2026-10-28', 'Bathroom']]);
  });

  it('a timed weekly list splits the same way and keeps its time', async () => {
    await create({ time: '09:00' });
    await tick('2026-10-28', 0);
    const second = await week('2026-10-21');
    const r = await t.json('POST', `/api/tasklists/${second.id}/items?scope=following`, { title: 'Mirror' });
    expect(r.body).toMatchObject({ id: second.id, time: '09:00', totalCount: 3 });
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:0'], ['2026-10-21', 'Clean', 'Sink:0,Floor:0,Mirror:0'],
      ['2026-10-28', 'Clean', 'Sink:1,Floor:0,Mirror:0'], ['2026-11-04', 'Clean', 'Sink:0,Floor:0,Mirror:0'],
    ]);
    expect((await all()).every((l: any) => l.time === '09:00')).toBe(true);
    const old = (await remote()).find((e: any) => e.recurrence && e.status !== 'cancelled' && !e.extendedProperties.private.series);
    expect(old.recurrence[0]).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261021T070000Z');
  });

  it('a second split names the first series too; deleting the first series removes every part', async () => {
    const a = await create();
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'B' });
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-28')).id}?scope=following`, { title: 'C' });
    expect((await weeks()).map((w: any) => w[1])).toEqual(['Clean', 'B', 'C', 'C']);
    expect(new Set((await all()).map((l: any) => l.seriesKey))).toEqual(new Set([a.seriesId]));
    expect((await t.req('DELETE', `/api/tasklists/${a.seriesId}`)).status).toBe(204);
    expect(await weeks()).toEqual([]);
  });

  it('a later change of the old series does not bring its ended weeks back', async () => {
    const a = await create();
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'B' });
    await t.json('PATCH', `/api/tasklists/${a.seriesId}`, { tags: ['door'] });
    expect((await weeks()).map((w: any) => [w[0], w[1]])).toEqual([['2026-10-14', 'Clean'], ['2026-10-21', 'B'], ['2026-10-28', 'B'], ['2026-11-04', 'B']]);
  });

  it('an item only one list has is changed only there', async () => {
    await create();
    const second = await week('2026-10-21');
    const added = await t.json('POST', `/api/tasklists/${second.id}/items`, { title: 'Towels' });
    const towels = added.body.items[2];
    const r = await t.json('PATCH', `/api/tasklists/${second.id}/items/${towels.id}?scope=following`, { title: 'Fresh towels' });
    expect(r.status).toBe(200);
    expect((await weeks()).map((w: any) => w[2])).toEqual(['Sink:0,Floor:0', 'Sink:0,Floor:0,Fresh towels:0', 'Sink:0,Floor:0', 'Sink:0,Floor:0']);
  });

  it('without scope (or scope=this) only the given one changes', async () => {
    await create();
    const second = await week('2026-10-21');
    await t.json('POST', `/api/tasklists/${second.id}/items?scope=this`, { title: 'Mirror' });
    await t.json('PATCH', `/api/tasklists/${second.id}`, { title: 'Bathroom' });
    expect((await weeks()).map((w: any) => w[1])).toEqual(['Clean', 'Bathroom', 'Clean', 'Clean']);
  });

  it('refuses scope=following on a list that does not repeat, with other fields than the title, with done, and an unknown scope', async () => {
    const one = await mk();
    const r1 = await t.json('POST', `/api/tasklists/${one.id}/items?scope=following`, { title: 'X' });
    expect(r1.status).toBe(400);
    expect(r1.body.error.message).toBe('This list does not repeat');
    expect(r1.body.error.details[0].field).toBe('scope');
    const a = await create();
    expect((await t.json('PATCH', `/api/tasklists/${a.id}?scope=following`, { title: 'B', date: '2026-10-15' })).status).toBe(400);
    expect((await t.json('PATCH', `/api/tasklists/${a.id}/items/${a.items[0].id}?scope=following`, { done: true })).status).toBe(400);
    expect((await t.json('POST', `/api/tasklists/${a.id}/items?scope=all`, { title: 'X' })).status).toBe(400);
    expect((await weeks()).map((w: any) => w[2])).toEqual(['Vacuum:0,Laundry:1', 'Sink:0,Floor:0', 'Sink:0,Floor:0', 'Sink:0,Floor:0', 'Sink:0,Floor:0']);
  });

  it('a second change on the same list reaches the later part made by the first one', async () => {
    await create();
    const second = await week('2026-10-21');
    await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    const r = await t.json('POST', `/api/tasklists/${second.id}/items?scope=following`, { title: 'Mirror' });
    expect(r.status).toBe(201);
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:0'], ['2026-10-21', 'Bathroom', 'Sink:0,Floor:0,Mirror:0'],
      ['2026-10-28', 'Bathroom', 'Sink:0,Floor:0,Mirror:0'], ['2026-11-04', 'Bathroom', 'Sink:0,Floor:0,Mirror:0'],
    ]);
  });

  it('a change before an earlier split does not repeat the later weeks: the new part ends where the next one starts', async () => {
    await create();
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-28')).id}?scope=following`, { title: 'B' });
    await tick('2026-11-04', 0);
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'C' });
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:0'], ['2026-10-21', 'C', 'Sink:0,Floor:0'],
      ['2026-10-28', 'C', 'Sink:0,Floor:0'], ['2026-11-04', 'C', 'Sink:1,Floor:0'],
    ]);
    const far = (await t.json('GET', '/api/items?from=2027-01-04&to=2027-01-11')).body.items.filter((i: any) => i.kind === 'tasklist');
    expect(far.map((l: any) => [l.date, l.title])).toEqual([['2027-01-06', 'C']]);
  });

  it('a later one that was moved far away is carried over with its tick, not lost', async () => {
    await create();
    await tick('2026-10-28', 0);
    const third = await week('2026-10-28');
    expect((await t.json('PATCH', `/api/tasklists/${third.id}`, { date: '2027-01-21' })).status).toBe(200);
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'Bathroom' });
    const moved = (await t.json('GET', '/api/items?from=2027-01-18&to=2027-01-25')).body.items.filter((i: any) => i.kind === 'tasklist');
    expect(moved.map((l: any) => [l.date, l.title, l.doneCount])).toEqual([['2027-01-20', 'Bathroom', 0], ['2027-01-21', 'Bathroom', 1]]);
    expect((await weeks()).map((w: any) => [w[0], w[1]])).toEqual([['2026-10-14', 'Clean'], ['2026-10-21', 'Bathroom'], ['2026-11-04', 'Bathroom']]);
  });

  it('a retry after a split that did not finish (old series not ended yet) reuses the new series', async () => {
    const a = await create();
    const second = await week('2026-10-21');
    await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    // as if ending the old series had failed
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY'] });
    const r = await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    expect(r.status).toBe(200);
    expect((await remote()).filter((e: any) => e.recurrence && e.status !== 'cancelled')).toHaveLength(2);
    expect((await weeks()).map((w: any) => [w[0], w[1]])).toEqual([['2026-10-14', 'Clean'], ['2026-10-21', 'Bathroom'], ['2026-10-28', 'Bathroom'], ['2026-11-04', 'Bathroom']]);
  });

  it('a retry after an unfinished split keeps the ticks of a week it already carried over', async () => {
    const a = await create();
    await tick('2026-10-28', 0);
    const second = await week('2026-10-21');
    await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY'] });
    expect((await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' })).status).toBe(200);
    expect(await weeks()).toEqual([
      ['2026-10-14', 'Clean', 'Sink:0,Floor:0'], ['2026-10-21', 'Bathroom', 'Sink:0,Floor:0'],
      ['2026-10-28', 'Bathroom', 'Sink:1,Floor:0'], ['2026-11-04', 'Bathroom', 'Sink:0,Floor:0'],
    ]);
  });

  it('a second pass inside one request (the old series changed meanwhile: 412) keeps the carried ticks', async () => {
    await create();
    await tick('2026-10-28', 0);
    // the mock's write path (looked up on each call): the first write that ends a series answers 412 once
    type Write = (cal: string, id: string, patch: { recurrence?: string[] }, o?: unknown) => unknown;
    const proto = MockGoogleProvider.prototype as unknown as { doPatch: Write };
    const orig = proto.doPatch;
    let failed = false;
    const spy = vi.spyOn(proto, 'doPatch').mockImplementation(function (this: unknown, cal, id, patch, o) {
      if (!failed && patch.recurrence?.some((l) => l.includes('UNTIL='))) { failed = true; throw new PreconditionFailedError('Precondition Failed'); }
      return orig.call(this, cal, id, patch, o);
    });
    try {
      expect((await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'Bathroom' })).status).toBe(200);
    } finally { spy.mockRestore(); }
    expect(failed).toBe(true);
    expect((await weeks()).map((w: any) => w[2])).toEqual(['Sink:0,Floor:0', 'Sink:0,Floor:0', 'Sink:1,Floor:0', 'Sink:0,Floor:0']);
  });

  it('a carried week that a lagging list read does not show yet is not taken for a plain one and deleted', async () => {
    const a = await create();
    await tick('2026-10-28', 0);
    const second = await week('2026-10-21');
    await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY'] });
    const fresh = (await remote()).find((e: any) => e.recurrence && e.id !== a.seriesId && e.status !== 'cancelled');
    // Google's list lags: reads without singleEvents do not show the new series' exceptions yet
    type Read = (p: { singleEvents?: boolean }) => { items: { recurringEventId?: string }[] };
    const proto = MockGoogleProvider.prototype as unknown as { readEvents: Read };
    const orig = proto.readEvents;
    const spy = vi.spyOn(proto, 'readEvents').mockImplementation(function (this: unknown, p) {
      const r = orig.call(this, p);
      return p.singleEvents === false ? { ...r, items: r.items.filter((e) => e.recurringEventId !== fresh.id) } : r;
    });
    try {
      expect((await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' })).status).toBe(200);
    } finally { spy.mockRestore(); }
    expect((await weeks()).map((w: any) => [w[0], w[2]])).toEqual([
      ['2026-10-14', 'Sink:0,Floor:0'], ['2026-10-21', 'Sink:0,Floor:0'], ['2026-10-28', 'Sink:1,Floor:0'], ['2026-11-04', 'Sink:0,Floor:0'],
    ]);
  });

  it('a split left half done whose new week the person deleted: the retry answers 409 and keeps the old week with its tick', async () => {
    const a = await create();
    await tick('2026-10-28', 0);
    const second = await week('2026-10-21');
    const oldWeek = (await remote()).find((e: any) => e.recurringEventId === a.seriesId && e.originalStartTime?.date === '2026-10-28');
    await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    // as if ending the old series and deleting its carried week had failed, and the person then deleted the new week
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY'] });
    await t.json('PATCH', `/api/__test/remote/events/${oldWeek.id}`, { status: 'confirmed' });
    const carried = (await weeks()).length;
    expect(carried).toBe(6); // 10-28 and 11-04 twice now: the old series runs on next to the new one
    const shown = (await all()).filter((l: any) => l.date === '2026-10-28' && l.seriesId !== a.seriesId)[0];
    expect((await t.req('DELETE', `/api/tasklists/${shown.id}`)).status).toBe(204);
    const r = await t.json('PATCH', `/api/tasklists/${second.id}?scope=following`, { title: 'Bathroom' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'CONFLICT', message: 'This list shows twice on 2026-10-28; delete the other copy, then try again' });
    expect((await all()).filter((l: any) => l.date === '2026-10-28').map((l: any) => l.items.map((x: any) => `${x.title}:${x.done ? 1 : 0}`).join(','))).toEqual(['Sink:1,Floor:0']);
  });

  it('an added item with an id from the client is not added twice when the request is repeated', async () => {
    await create();
    const second = await week('2026-10-21');
    for (let i = 0; i < 2; i++) expect((await t.json('POST', `/api/tasklists/${second.id}/items?scope=following`, { id: 'mirror01', title: 'Mirror' })).status).toBe(201);
    expect((await weeks()).map((w: any) => w[2])).toEqual(['Sink:0,Floor:0', 'Sink:0,Floor:0,Mirror:0', 'Sink:0,Floor:0,Mirror:0', 'Sink:0,Floor:0,Mirror:0']);
    expect((await weeks()).length).toBe(4);
  });

  it('the new series gets only the RRULE and EXDATE lines (an RDATE before it would add a stray date)', async () => {
    const a = await create();
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY', 'RDATE;VALUE=DATE:20261016', 'EXDATE;VALUE=DATE:20270106'] });
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'B' });
    const fresh = (await remote()).find((e: any) => e.recurrence && e.id !== a.seriesId && e.status !== 'cancelled');
    expect(fresh.recurrence).toEqual(['RRULE:FREQ=WEEKLY', 'EXDATE;VALUE=DATE:20270106']);
  });

  it('ending the old series keeps its other recurrence lines and rewrites only the RRULE', async () => {
    const a = await create();
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['EXDATE;VALUE=DATE:20270106', 'RRULE:UNTIL=20271231;FREQ=WEEKLY;WKST=MO'] });
    await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'B' });
    const old = (await remote()).find((e: any) => e.id === a.seriesId);
    expect(old.recurrence).toEqual(['EXDATE;VALUE=DATE:20270106', 'RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261021']);
    const fresh = (await remote()).find((e: any) => e.recurrence && e.id !== a.seriesId && e.status !== 'cancelled');
    expect(fresh.recurrence).toEqual(['EXDATE;VALUE=DATE:20270106', 'RRULE:UNTIL=20271231;FREQ=WEEKLY;WKST=MO']);
    // a later plain write of the old series keeps its rule
    await t.json('PATCH', `/api/tasklists/${a.seriesId}`, { tags: ['door'] });
    expect((await remote()).find((e: any) => e.id === a.seriesId).recurrence).toEqual(['EXDATE;VALUE=DATE:20270106', 'RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261021']);
  });

  it('a rule that ends after a number of times (COUNT) is not split: 400, nothing changes', async () => {
    const a = await create();
    await t.json('PATCH', `/api/__test/remote/events/${a.seriesId}`, { recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'] });
    const r = await t.json('PATCH', `/api/tasklists/${(await week('2026-10-21')).id}?scope=following`, { title: 'B' });
    expect(r.status).toBe(400);
    expect((await weeks()).map((w: any) => w[1])).toEqual(['Clean', 'Clean', 'Clean', 'Clean']);
  });

  it('an unknown item answers 404 and changes nothing', async () => {
    await create();
    const second = await week('2026-10-21');
    expect((await t.json('DELETE', `/api/tasklists/${second.id}/items/nope?scope=following`)).status).toBe(404);
    expect((await remote()).filter((e: any) => e.recurrence)).toHaveLength(1);
  });
});
