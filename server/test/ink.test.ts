import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const stroke = (n = 3) => ({ p: Array.from({ length: n }, (_, i) => [i * 0.5, 0.4 + i * 0.01, 0.5]), c: '#ff0000' });
const mk = async () => (await t.json('POST', '/api/tasklists', { title: 'Groceries', date: '2026-10-14', items: [{ title: 'Text item' }] })).body;
const raw = async (id: string) => (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: { id: string }) => e.id === id);

describe('ink items', () => {
  it('adds an ink item from strokes: no title, ink flag, placeholder in the Google description', async () => {
    const l = await mk();
    const r = await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] });
    expect(r.status).toBe(201);
    expect(r.body.items).toHaveLength(2);
    expect(r.body.items[1]).toMatchObject({ title: '', done: false, ink: true });
    expect(r.body.totalCount).toBe(2);
    expect((await raw(l.id)).description).toBe('☐ Text item\n☐ Handwritten item');
    const ink = (await t.json('GET', '/api/ink')).body;
    expect(ink.lists[l.id][r.body.items[1].id]).toEqual([stroke()]);
  });

  it('replaces the strokes of an ink item with PUT and keeps the item', async () => {
    const l = await mk();
    const id = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] })).body.items[1].id;
    const r = await t.json('PUT', `/api/tasklists/${l.id}/items/${id}/ink`, { strokes: [stroke(), stroke(4)] });
    expect(r.status).toBe(200);
    expect((await t.json('GET', '/api/ink')).body.lists[l.id][id]).toHaveLength(2);
    const empty = await t.json('PUT', `/api/tasklists/${l.id}/items/${id}/ink`, { strokes: [] });
    expect(empty.status).toBe(200);
    expect((await t.json('GET', `/api/tasklists/${l.id}`)).body.items).toHaveLength(2);
  });

  it('refuses ink for a text item and for an unknown item', async () => {
    const l = await mk();
    expect((await t.json('PUT', `/api/tasklists/${l.id}/items/${l.items[0].id}/ink`, { strokes: [stroke()] })).status).toBe(400);
    expect((await t.json('PUT', `/api/tasklists/${l.id}/items/nope/ink`, { strokes: [stroke()] })).status).toBe(404);
  });

  it('refuses malformed strokes', async () => {
    const l = await mk();
    for (const strokes of [[{ p: [[1, 2]] }], [{ p: [['a', 1, 1]] }], 'x', [{ p: [[1, 2, 3, 4]] }], [{ p: [[1, 2, 3]], c: 'red' }], [{ p: [] }]]) {
      expect((await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes })).status).toBe(400);
    }
  });

  it('says the list is full beyond about 200 KB of ink', async () => {
    const l = await mk();
    const big = Array.from({ length: 20 }, () => stroke(400));
    let status = 201;
    for (let i = 0; i < 40 && status === 201; i++) status = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: big })).status;
    expect(status).toBe(413);
  });

  it('removes the ink with its item and with its list', async () => {
    const l = await mk();
    const a = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] })).body.items[1].id;
    const b = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] })).body.items[2].id;
    await t.json('DELETE', `/api/tasklists/${l.id}/items/${a}`);
    expect(Object.keys((await t.json('GET', '/api/ink')).body.lists[l.id])).toEqual([b]);
    await t.req('DELETE', `/api/tasklists/${l.id}`);
    expect((await t.json('GET', '/api/ink')).body.lists[l.id]).toBeUndefined();
  });

  it('serves the ink as a device file in the changes feed', async () => {
    const l = await mk();
    await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] });
    const ch = (await t.json('GET', '/api/changes')).body;
    expect(ch.files.ink.lists[l.id]).toBeDefined();
  });
});

describe('ink items in a new list', () => {
  it('creates a list from ink items alone and stores the strokes under the new ids', async () => {
    const r = await t.json('POST', '/api/tasklists', { title: '', date: null, items: [{ title: '', strokes: [stroke()] }, { title: 'Text' }, { title: '', strokes: [stroke(4)] }] });
    expect(r.status).toBe(201);
    expect(r.body.items.map((i: { ink?: true; title: string }) => [i.ink ?? false, i.title])).toEqual([[true, ''], [false, 'Text'], [true, '']]);
    const doc = (await t.json('GET', '/api/ink')).body.lists[r.body.id];
    expect(doc[r.body.items[0].id]).toEqual([stroke()]);
    expect(doc[r.body.items[2].id]).toEqual([stroke(4)]);
    expect(doc[r.body.items[1].id]).toBeUndefined();
  });
});
