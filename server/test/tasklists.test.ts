import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

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

  it('accepts an empty or blank title when there is an item; stores items as the Google summary', async () => {
    for (const title of ['', '   ']) {
      const r = await t.json('POST', '/api/tasklists', { title, date: '2026-10-12', items: [{ title: 'Milk' }, { title: ' ' }, { title: 'Eggs' }] });
      expect(r.status).toBe(201);
      expect(r.body.title).toBe('');
      const g = await raw(r.body.id);
      expect(g.summary).toBe('Milk, Eggs');
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
    expect((await raw(a.id)).summary).toBe('Milk');
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
