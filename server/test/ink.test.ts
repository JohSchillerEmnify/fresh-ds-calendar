import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

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
    expect(ink.items[r.body.items[1].id]).toEqual([stroke()]);
  });

  it('replaces the strokes of an ink item with PUT and keeps the item', async () => {
    const l = await mk();
    const id = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] })).body.items[1].id;
    const r = await t.json('PUT', `/api/tasklists/${l.id}/items/${id}/ink`, { strokes: [stroke(), stroke(4)] });
    expect(r.status).toBe(200);
    expect((await t.json('GET', '/api/ink')).body.items[id]).toHaveLength(2);
    const empty = await t.json('PUT', `/api/tasklists/${l.id}/items/${id}/ink`, { strokes: [] });
    expect(empty.status).toBe(200);
    expect((await t.json('GET', `/api/tasklists/${l.id}`)).body.items).toHaveLength(2);
  });

  it('merges a change that names where it started from with what another device wrote meanwhile', async () => {
    const l = await mk();
    const first = { ...stroke(), t: 0 };
    const id = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [first] })).body.items[1].id;
    const url = `/api/tasklists/${l.id}/items/${id}/ink`;
    const key = (s: { t?: number; p: number[][] }) => `${s.t ?? 0}|${s.p.length}|${s.p[0]!.join(',')}`;
    // the other device erased the line at 300; this one drew at 200 while offline and arrives later
    await t.json('PUT', url, { strokes: [], base: [key(first)], at: 300 });
    const drawn = { ...stroke(2), t: 200 };
    await t.json('PUT', url, { strokes: [first, drawn], base: [key(first)], at: 200 });
    expect((await t.json('GET', '/api/ink')).body.items[id].filter((x: { p: unknown[] }) => x.p.length)).toEqual([]);
    // a stroke drawn after the erase stays
    const later = { ...stroke(2), t: 400 };
    await t.json('PUT', url, { strokes: [later], base: [], at: 400 });
    expect((await t.json('GET', '/api/ink')).body.items[id].filter((x: { p: unknown[] }) => x.p.length)).toEqual([later]);
  });

  describe('times of a merged change', () => {
    const NOW = Date.parse('2026-10-12T08:00:00+02:00');
    const key = (s: { t?: number; p: number[][] }) => `${s.t ?? 0}|${s.p.length}|${s.p[0]!.join(',')}`;
    const visible = async (id: string) => (await t.json('GET', '/api/ink')).body.items[id].filter((x: { p: unknown[] }) => x.p.length);
    const setup = async () => {
      const l = await mk();
      const first = { ...stroke(), t: NOW - 5000 };
      const id = (await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [first] })).body.items[1].id;
      return { first, id, url: `/api/tasklists/${l.id}/items/${id}/ink` };
    };

    it('refuses a time that is not a whole non-negative number', async () => {
      const { first, url } = await setup();
      for (const at of [-1, 1.5]) expect((await t.json('PUT', url, { strokes: [], base: [key(first)], at })).status).toBe(400);
      expect((await t.json('PUT', url, { strokes: [{ ...stroke(), t: 1.5 }], base: [] })).status).toBe(400);
    });

    it('takes an erase from a clock far in the future as happening now, so strokes drawn after it are kept', async () => {
      const { first, id, url } = await setup();
      await t.json('PUT', url, { strokes: [], base: [key(first)], at: 9e15 });
      const later = { ...stroke(2), t: NOW + 1000 };
      await t.json('PUT', url, { strokes: [later], base: [] });
      expect(await visible(id)).toEqual([later]);
    });

    it('cuts back a stroke time far ahead of the clock', async () => {
      const { id, url } = await setup();
      await t.json('PUT', url, { strokes: [{ ...stroke(2), t: 9e15 }] });
      expect((await visible(id))[0].t).toBe(NOW + 5 * 60_000);
    });

    it('lets a device with a clock behind erase only what was drawn before its time', async () => {
      const { first, id, url } = await setup();
      const other = { ...stroke(2), t: NOW - 1000 };
      await t.json('PUT', url, { strokes: [first, other] });
      await t.json('PUT', url, { strokes: [], base: [key(first)], at: 1 });
      expect(await visible(id)).toEqual([other]);
    });
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
    expect(Object.keys((await t.json('GET', '/api/ink')).body.items)).toEqual([b]);
    await t.req('DELETE', `/api/tasklists/${l.id}`);
    expect((await t.json('GET', '/api/ink')).body.items).toEqual({});
  });

  it('serves the ink as a device file in the changes feed', async () => {
    const l = await mk();
    await t.json('POST', `/api/tasklists/${l.id}/items`, { strokes: [stroke()] });
    const ch = (await t.json('GET', '/api/changes')).body;
    expect(Object.keys(ch.files.ink.items)).toHaveLength(1);
  });
});

describe('ink items in a new list', () => {
  it('creates a list from ink items alone and stores the strokes under the new ids', async () => {
    const r = await t.json('POST', '/api/tasklists', { title: '', date: null, items: [{ title: '', strokes: [stroke()] }, { title: 'Text' }, { title: '', strokes: [stroke(4)] }] });
    expect(r.status).toBe(201);
    expect(r.body.items.map((i: { ink?: true; title: string }) => [i.ink ?? false, i.title])).toEqual([[true, ''], [false, 'Text'], [true, '']]);
    const doc = (await t.json('GET', '/api/ink')).body.items;
    expect(doc[r.body.items[0].id]).toEqual([stroke()]);
    expect(doc[r.body.items[2].id]).toEqual([stroke(4)]);
    expect(doc[r.body.items[1].id]).toBeUndefined();
  });
});

describe('ink of repeating lists', () => {
  const week = async (date: string) => (await t.json('GET', '/api/items?from=2026-10-12&to=2026-11-09')).body.items.find((i: { kind: string; date: string }) => i.kind === 'tasklist' && i.date === date);

  it('an ink item added for this and all following lists has its strokes in every one of them', async () => {
    const a = (await t.json('POST', '/api/tasklists', { title: 'Clean', date: '2026-10-14', recurrence: 'weekly', items: [{ title: 'Sink' }] })).body;
    const second = await week('2026-10-21');
    const r = await t.json('POST', `/api/tasklists/${second.id}/items?scope=following`, { strokes: [stroke()] });
    expect(r.status).toBe(201);
    const id = r.body.items[1].id;
    for (const d of ['2026-10-21', '2026-10-28']) expect((await week(d)).items[1]).toMatchObject({ id, ink: true });
    expect((await t.json('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    expect((await week('2026-10-14')).items).toHaveLength(1);
    // removed for the following lists: the ink goes
    await t.json('DELETE', `/api/tasklists/${second.id}/items/${id}?scope=following`);
    expect((await t.json('GET', '/api/ink')).body.items[id]).toBeUndefined();
    expect(a.id).toBeDefined();
  });

  it('keeps the ink when one occurrence only loses the item or is deleted, and removes it when the series is deleted', async () => {
    const a = (await t.json('POST', '/api/tasklists', { title: 'Clean', date: '2026-10-14', recurrence: 'weekly', items: [{ title: '', strokes: [stroke()] }] })).body;
    const id = a.items[0].id;
    const second = await week('2026-10-21');
    await t.json('DELETE', `/api/tasklists/${second.id}/items/${id}`);
    expect((await t.json('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    await t.req('DELETE', `/api/tasklists/${a.id}`);
    expect((await t.json('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    await t.req('DELETE', `/api/tasklists/${a.seriesId}`);
    expect((await t.json('GET', '/api/ink')).body.items[id]).toBeUndefined();
  });
});

describe('ink of shared lists follows the list', () => {
  it('a member writes and the owner sees the strokes; both lose them with the list', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    const as = async (email: string) => {
      const cookie = await sessionCookie(t, email);
      return (m: string, u: string, b?: unknown) => t.json(m, u, b, { cookie });
    };
    const jo = await as(JO);
    const anna = await as(ANNA);
    const own = (await jo('POST', '/api/tasklists', { title: 'Groceries', date: null, items: [{ title: 'Milk' }] })).body;
    const shared = (await jo('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) })).body;
    const r = await anna('POST', `/api/tasklists/${shared.id}/items`, { strokes: [stroke()] });
    expect(r.status).toBe(201);
    const id = r.body.items[1].id;
    expect((await jo('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    expect((await anna('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    expect((await anna('PUT', `/api/tasklists/${shared.id}/items/${id}/ink`, { strokes: [] })).status).toBe(200);
    expect((await jo('GET', '/api/ink')).body.items[id]).toEqual([]);
    await jo('DELETE', `/api/tasklists/${shared.id}`);
    expect((await anna('GET', '/api/ink')).body.items[id]).toBeUndefined();
  });
});

describe('ink item rules', () => {
  it('has no title: a rename is refused, and a repeated add with the same id stores the ink once', async () => {
    const l = await mk();
    const first = await t.json('POST', `/api/tasklists/${l.id}/items`, { id: 'item-abc123', strokes: [stroke()] });
    const again = await t.json('POST', `/api/tasklists/${l.id}/items`, { id: 'item-abc123', strokes: [stroke(5)] });
    expect(again.body.items).toHaveLength(first.body.items.length);
    expect((await t.json('PATCH', `/api/tasklists/${l.id}/items/item-abc123`, { title: 'x' })).status).toBe(400);
  });
  it('is not taken for a text item with the same id', async () => {
    const l = await mk();
    const id = l.items[0].id;
    await t.json('POST', `/api/tasklists/${l.id}/items`, { id, strokes: [stroke()] });
    expect((await t.json('GET', '/api/ink')).body.items[id]).toBeUndefined();
  });
});

describe('ink when a list is shared and shared no more', () => {
  it('moves with the list into the shared store and back to the owner', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    const cookie = await sessionCookie(t, JO);
    const jo = (m: string, u: string, b?: unknown) => t.json(m, u, b, { cookie });
    const own = (await jo('POST', '/api/tasklists', { title: 'G', date: null, items: [{ title: '', strokes: [stroke()] }] })).body;
    const id = own.items[0].id;
    const shared = (await jo('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) })).body;
    expect((await jo('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
    await jo('DELETE', `/api/tasklists/${shared.id}/share`);
    expect((await jo('GET', '/api/ink')).body.items[id]).toEqual([stroke()]);
  });
});

describe('ink in templates', () => {
  it('keeps the strokes of an ink item in a template and returns them', async () => {
    const r = await t.json('POST', '/api/templates', { name: 'Weekly shop', items: [{ title: 'Text' }, { title: '', strokes: [stroke()] }, { title: ' ' }] });
    expect(r.status).toBe(201);
    expect(r.body.items).toEqual([{ title: 'Text' }, { title: '', strokes: [stroke()] }]);
    expect((await t.json('GET', '/api/templates')).body.templates[0].items[1].strokes).toEqual([stroke()]);
  });
});
