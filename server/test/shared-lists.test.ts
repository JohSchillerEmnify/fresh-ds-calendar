/** Shared task lists (spec feature @id:shared-lists): store, membership, moves, security. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { PeopleStore } from '../src/auth/peopleStore.js';
import { Clock } from '../src/lib/clock.js';
import { SharedListService } from '../src/services/sharedLists.js';
import { makeApp, sessionCookie, shareAndAccept, shareCategoryAndAccept } from './helpers.js';

const JO = 'jo@example.com', ANNA = 'anna@example.com', BOB = 'bob@example.com';

/** Turns sign-in on for three people and returns one `call` function per person (own session cookie). */
async function setup() {
  const t = makeApp();
  await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA, BOB] });
  const as = async (email: string) => {
    const cookie = await sessionCookie(t, email);
    return (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => t.json(method, url, body, { cookie, ...headers });
  };
  return { t, jo: await as(JO), anna: await as(ANNA), bob: await as(BOB) };
}

type Call = Awaited<ReturnType<typeof setup>>['jo'];
const allOpen = async (c: Call) => (await c('GET', '/api/tasklists/all-open?today=2026-10-12')).body.items as any[];
const titles = async (c: Call) => (await allOpen(c)).map((l) => l.title).sort();

/** A list of Jo's with two items; returns it. */
async function groceries(jo: Call, extra: Record<string, unknown> = {}) {
  const r = await jo('POST', '/api/tasklists', { title: 'Groceries', date: null, items: [{ title: 'Milk' }, { title: 'Eggs' }], ...extra });
  expect(r.status).toBe(201);
  return r.body;
}

describe('removing one person from a shared list', () => {
  it('keeps the others, moves the list back with the last one, and answers a stranger and an unknown person alike', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const id = encodeURIComponent(s.id);
      const annaSub = mockSub(ANNA), bobSub = mockSub(BOB);
      // bob is no member yet: a stranger
      const stranger = await bob('DELETE', `/api/tasklists/${id}/share/${annaSub}`);
      await shareAndAccept(jo, bob, s.id, BOB);
      expect((await anna('DELETE', `/api/tasklists/${id}/share/${bobSub}`)).status).toBe(403);
      const unknown = await jo('DELETE', `/api/tasklists/${id}/share/nobody`);
      expect([unknown.status, unknown.body.error.code]).toEqual([404, 'NOT_FOUND']);
      expect([stranger.status, stranger.body.error?.code]).toEqual([unknown.status, unknown.body.error.code]);
      expect((await jo('DELETE', `/api/tasklists/${id}/share/${annaSub}`)).status).toBe(200);
      expect(await titles(anna)).toEqual([]);
      expect(await titles(bob)).toEqual(['Groceries']);
      const last = await jo('DELETE', `/api/tasklists/${id}/share/${bobSub}`);
      expect([last.status, last.body.calendarId]).toEqual([200, expect.not.stringMatching(/^shared$/)]);
      expect(await titles(bob)).toEqual([]);
      expect(await titles(jo)).toEqual(['Groceries']);
    } finally { t.cleanup(); }
  });
});

describe('a shared list left without people', () => {
  it('moves back once when the last person is removed twice at the same time', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const url = `/api/tasklists/${encodeURIComponent(s.id)}/share/${mockSub(ANNA)}`;
      const both = await Promise.all([jo('DELETE', url), jo('DELETE', url)]);
      expect(both.map((r) => r.status).sort()).toEqual([200, 200]);
      expect((await allOpen(jo)).filter((l) => l.title === 'Groceries')).toHaveLength(1);
    } finally { t.cleanup(); }
  });
});

describe('sharing a list', () => {
  it('moves it out of the owner\'s Google calendar into the shared store and shows it to both', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      // an invitation alone moves nothing
      expect((await jo('POST', `/api/tasklists/${own.id}/share`, { email: ANNA })).status).toBe(200);
      expect(await titles(anna)).toEqual([]);
      const inv = (await anna('GET', '/api/invitations')).body.invitations[0];
      const accepted = await anna('POST', `/api/invitations/${inv.id}/accept`);
      expect(accepted.status).toBe(200);
      const shared = await jo('GET', `/api/tasklists/${encodeURIComponent(accepted.body.listId)}`);
      expect(shared.body.id).toMatch(/^shared:/);
      expect(shared.body).toMatchObject({ calendarId: 'shared', title: 'Groceries', totalCount: 2 });
      expect(shared.body.shared).toMatchObject({ owned: true, owner: { initial: 'J' }, with: [{ sub: mockSub(ANNA), initial: 'A' }] });
      // gone from Google, stored as one JSON file
      const remote = await t.json('GET', `/api/__test/remote/events?owner=${JO}`);
      expect(remote.body.items.filter((e: any) => e.summary === 'Groceries')).toHaveLength(0);
      const dir = path.join(t.dir, 'shared', 'lists');
      expect(fs.readdirSync(dir)).toHaveLength(1);
      expect(JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]!), 'utf8'))).toMatchObject({ owner: mockSub(JO), members: [mockSub(ANNA)], rev: 1 });
      // both see it; Anna sees the owner's initial
      expect(await titles(jo)).toEqual(['Groceries']);
      const hers = (await allOpen(anna))[0];
      expect(hers).toMatchObject({ id: shared.body.id, shared: { owned: false, owner: { initial: 'J' } } });
      expect((await anna('GET', `/api/tasklists/${encodeURIComponent(hers.id)}`)).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('keeps items, ticks, date, time, tags, estimate and canvas place', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo, { date: '2026-10-14', time: '10:00', tags: ['home'], estimateMinutes: 30, items: [{ title: 'Milk', done: true }, { title: 'Eggs' }] });
      await jo('PATCH', `/api/tasklists/${own.id}`, { canvas: { x: 100, y: 200 } });
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      expect(s).toMatchObject({ date: '2026-10-14', time: '10:00', tags: ['home'], estimateMinutes: 30, canvas: { x: 100, y: 200 }, doneCount: 1 });
      // on its date it shows in the calendar of both people
      for (const c of [jo, anna]) {
        const r = await c('GET', '/api/items?from=2026-10-12&to=2026-10-19');
        expect(r.body.items.map((i: any) => i.title)).toEqual(['Groceries']);
      }
    } finally { t.cleanup(); }
  });

  it('refuses people who may not be added, repeating lists and sharing with yourself', async () => {
    const { t, jo } = await setup();
    try {
      const own = await groceries(jo);
      expect((await jo('POST', `/api/tasklists/${own.id}/share`, { email: JO })).status).toBe(400);
      expect((await jo('POST', `/api/tasklists/${own.id}/share`, { email: 'nobody' })).status).toBe(400);
      const weekly = await jo('POST', '/api/tasklists', { title: 'Weekly', date: '2026-10-14', recurrence: 'weekly', items: [{ title: 'x' }] });
      const r = await jo('POST', `/api/tasklists/${weekly.body.id}/share`, { email: ANNA });
      expect(r.status).toBe(400);
      expect(r.body.error.key).toBe('sharing.repeating');
      expect([...new Set(await titles(jo))]).toEqual(['Groceries', 'Weekly']); // nothing was lost
    } finally { t.cleanup(); }
  });
});

describe('security: who may touch a shared list', () => {
  it('answers 404 to a person who is neither owner nor member, on every route', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const id = encodeURIComponent(s.id);
      const item = s.items[0].id;
      expect(await allOpen(bob)).toEqual([]);
      const attempts: [string, string, unknown?][] = [
        ['GET', `/api/tasklists/${id}`],
        ['PATCH', `/api/tasklists/${id}`, { title: 'Hacked' }],
        ['DELETE', `/api/tasklists/${id}`],
        ['POST', `/api/tasklists/${id}/items`, { title: 'x' }],
        ['PATCH', `/api/tasklists/${id}/items/${item}`, { done: true }],
        ['DELETE', `/api/tasklists/${id}/items/${item}`],
        ['PUT', `/api/tasklists/${id}/items/order`, { itemIds: s.items.map((i: any) => i.id) }],
        ['POST', `/api/tasklists/${id}/share`, { email: BOB }],
        ['DELETE', `/api/tasklists/${id}/share`],
        ['POST', `/api/tasklists/${id}/leave`],
      ];
      for (const [m, u, b] of attempts) expect((await bob(m, u, b)).status, `${m} ${u}`).toBe(404);
      // untouched, and not reachable without a session
      expect((await jo('GET', `/api/tasklists/${id}`)).body.title).toBe('Groceries');
      expect((await t.json('GET', `/api/tasklists/${id}`)).status).toBe(401);
      expect((await anna('GET', `/api/tasklists/${id}`)).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('lets a member edit but answers 403 to owner-only actions, and the owner cannot leave', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const id = encodeURIComponent(s.id);
      expect((await anna('PATCH', `/api/tasklists/${id}`, { title: 'Weekly shop' })).body.title).toBe('Weekly shop');
      expect((await anna('POST', `/api/tasklists/${id}/items`, { title: 'Bread' })).status).toBe(201);
      for (const [m, u, b] of [['DELETE', `/api/tasklists/${id}`], ['DELETE', `/api/tasklists/${id}/share`], ['POST', `/api/tasklists/${id}/share`, { email: BOB }]] as [string, string, unknown?][]) {
        const r = await anna(m, u, b);
        expect([r.status, r.body.error.code], `${m} ${u}`).toEqual([403, 'FORBIDDEN']);
      }
      expect((await jo('POST', `/api/tasklists/${id}/leave`)).status).toBe(403);
      expect((await jo('GET', `/api/tasklists/${id}`)).body.items).toHaveLength(3);
    } finally { t.cleanup(); }
  });
});

describe('editing together', () => {
  it('refuses a repeat rhythm on a shared list', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo, { date: '2026-10-14' });
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const r = await jo('PATCH', `/api/tasklists/${encodeURIComponent(s.id)}`, { recurrence: 'weekly' });
      expect(r.status).toBe(400);
    } finally { t.cleanup(); }
  });
  it('shows the other person\'s tick, bumps the etag and refuses a stale If-Match with 412', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const id = encodeURIComponent(s.id);
      const milk = s.items.find((i: any) => i.title === 'Milk').id;
      const ticked = await anna('PATCH', `/api/tasklists/${id}/items/${milk}`, { done: true });
      expect(ticked.body.doneCount).toBe(1);
      expect(ticked.body.etag).not.toBe(s.etag);
      expect((await jo('GET', `/api/tasklists/${id}`)).body.items.find((i: any) => i.id === milk).done).toBe(true);
      // Jo still holds the old version: her pinned write is refused, an unpinned item op applies on top
      const stale = await jo('PATCH', `/api/tasklists/${id}`, { title: 'Food' }, { 'If-Match': s.etag });
      expect([stale.status, stale.body.error.code]).toEqual([412, 'PRECONDITION_FAILED']);
      expect((await jo('DELETE', `/api/tasklists/${id}`, undefined, { 'If-Match': s.etag })).status).toBe(412);
      expect((await jo('POST', `/api/tasklists/${id}/items`, { title: 'Bread' })).status).toBe(201);
      const fresh = (await jo('GET', `/api/tasklists/${id}`)).body;
      expect((await jo('PATCH', `/api/tasklists/${id}`, { title: 'Food' }, { 'If-Match': fresh.etag })).body.title).toBe('Food');
    } finally { t.cleanup(); }
  });

  it('finished lists reach the Archive of both and an undated one is dated to the finishing day', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await jo('POST', '/api/tasklists', { title: 'One', date: null, items: [{ title: 'a' }] });
      const s = await shareAndAccept(jo, anna, own.body.id, ANNA);
      await anna('PATCH', `/api/tasklists/${encodeURIComponent(s.id)}/items/${s.items[0].id}`, { done: true });
      for (const c of [jo, anna]) {
        expect((await c('GET', '/api/tasklists/archive?today=2026-10-12')).body.items.map((l: any) => l.title)).toEqual(['One']);
        expect(await allOpen(c)).toEqual([]);
      }
    } finally { t.cleanup(); }
  });
});

describe('stop sharing and leave', () => {
  it('moves the list back into the owner\'s Google calendar with its state and removes it for the member', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo, { items: [{ title: 'Milk', done: true }, { title: 'Eggs' }] });
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      const back = await jo('DELETE', `/api/tasklists/${encodeURIComponent(s.id)}/share`);
      expect(back.status).toBe(200);
      expect(back.body.id).not.toMatch(/^shared:/);
      expect(back.body).toMatchObject({ title: 'Groceries', doneCount: 1, totalCount: 2 });
      expect(back.body.shared).toBeUndefined();
      expect(await titles(jo)).toEqual(['Groceries']);
      expect(await allOpen(anna)).toEqual([]);
      expect(fs.readdirSync(path.join(t.dir, 'shared', 'lists'))).toHaveLength(0);
      const remote = await t.json('GET', `/api/__test/remote/events?owner=${JO}`);
      expect(remote.body.items.filter((e: any) => e.summary === 'Groceries')).toHaveLength(1);
    } finally { t.cleanup(); }
  });

  it('lets a member leave: it disappears for them only, and with nobody left the owner has it back in Google', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      expect((await anna('POST', `/api/tasklists/${encodeURIComponent(s.id)}/leave`)).status).toBe(204);
      expect(await allOpen(anna)).toEqual([]);
      expect((await anna('GET', `/api/tasklists/${encodeURIComponent(s.id)}`)).status).toBe(404);
      const mine = (await allOpen(jo)).filter((l) => l.title === 'Groceries');
      expect(mine).toHaveLength(1);
      expect(mine[0].calendarId).not.toBe('shared');
      expect(mine[0].shared).toBeUndefined();
    } finally { t.cleanup(); }
  });

  it('deletes for everyone when the owner deletes', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await groceries(jo);
      const s = await shareAndAccept(jo, anna, own.id, ANNA);
      expect((await jo('DELETE', `/api/tasklists/${encodeURIComponent(s.id)}`)).status).toBe(204);
      expect(await allOpen(jo)).toEqual([]);
      expect(await allOpen(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });
});

describe('sharing a category', () => {
  const shopping = 'shopping';

  it('moves its lists, creates new ones shared, and moves them back when unshared', async () => {
    const { t, jo, anna } = await setup();
    try {
      await groceries(jo, { categoryId: shopping });
      await jo('POST', '/api/tasklists', { title: 'Taxes', date: null, items: [{ title: 'Form' }], categoryId: 'work' });
      await shareCategoryAndAccept(jo, anna, shopping, ANNA);
      expect((await jo('GET', '/api/categories/shares')).body.shares[shopping]).toMatchObject({ sub: mockSub(ANNA) });
      expect((await jo('GET', '/api/categories/shares')).body.shares[shopping].initial).toBe('A');
      expect(await titles(anna)).toEqual(['Groceries']);
      // a new Shopping list is created shared, a Work list is not
      const party = await jo('POST', '/api/tasklists', { title: 'Party snacks', date: null, items: [{ title: 'Chips' }], categoryId: shopping });
      expect(party.body.id).toMatch(/^shared:/);
      const other = await jo('POST', '/api/tasklists', { title: 'Plan', date: null, items: [{ title: 'x' }], categoryId: 'work' });
      expect(other.body.id).not.toMatch(/^shared:/);
      expect(await titles(anna)).toEqual(['Groceries', 'Party snacks']);
      // unsharing moves them back to Jo only
      const off = await jo('PUT', `/api/categories/${shopping}/share`, { email: null });
      expect(off.body.shares).toEqual({});
      expect(await titles(anna)).toEqual([]);
      expect(await titles(jo)).toEqual(['Groceries', 'Party snacks', 'Plan', 'Taxes']);
      expect((await jo('POST', '/api/tasklists', { title: 'Later', date: null, items: [{ title: 'x' }], categoryId: shopping })).body.id).not.toMatch(/^shared:/);
    } finally { t.cleanup(); }
  });

  it('carries the owner\'s category look, which a member cannot change; renames reach the member', async () => {
    const { t, jo, anna } = await setup();
    try {
      await groceries(jo, { categoryId: 'shopping' });
      await shareCategoryAndAccept(jo, anna, 'shopping', ANNA);
      const hers = (await allOpen(anna))[0];
      expect(hers).toMatchObject({ categoryId: 'shopping', categoryInfo: { name: 'Shopping', icon: '🛒' } });
      const id = encodeURIComponent(hers.id);
      const r = await anna('PATCH', `/api/tasklists/${id}`, { categoryId: 'home' });
      expect([r.status, r.body.error.key]).toEqual([400, 'sharing.categoryOwnerOnly']);
      expect((await anna('PATCH', `/api/tasklists/${id}`, { categoryId: 'shopping', title: 'Same category is fine' })).status).toBe(200);
      await jo('PATCH', '/api/categories/shopping', { name: 'Groceries run', color: '#112233' });
      expect((await allOpen(anna))[0]).toMatchObject({ categoryInfo: { name: 'Groceries run', color: '#112233' }, color: '#112233' });
      // deleting the category clears it from the shared list and drops the rule
      await jo('DELETE', '/api/categories/shopping');
      expect((await allOpen(anna))[0]).toMatchObject({ categoryId: null, categoryInfo: null });
      expect((await jo('GET', '/api/categories/shares')).body.shares).toEqual({});
    } finally { t.cleanup(); }
  });

  it('refuses sharing a category the person does not have and a malformed address', async () => {
    const { t, jo } = await setup();
    try {
      expect((await jo('PUT', '/api/categories/nope/share', { email: ANNA })).status).toBe(404);
      expect((await jo('PUT', '/api/categories/shopping/share', { email: 'nobody' })).status).toBe(400);
      expect((await jo('PUT', '/api/categories/shopping/share', {})).status).toBe(400);
    } finally { t.cleanup(); }
  });
});

describe('SharedListService store', () => {
  it('survives a restart as plain JSON files and refuses strangers by sub', () => {
    const t = makeApp();
    try {
      const people = new PeopleStore(t.dir);
      people.record('jo', JO, 'Jo');
      const mk = () => new SharedListService(t.dir, people, new Clock(), 'Europe/Berlin', () => () => true);
      const svc = mk();
      const data = { title: 'L', date: null, time: null, items: [{ id: 'a', title: 'x', done: false }], categoryId: null, tags: [], estimateMinutes: null, recurrence: null, completedOn: null, canvas: null };
      const doc = svc.create('jo', ['anna'], data, null);
      svc.save(doc, { ...data, title: 'Renamed' });
      const again = mk();
      expect(again.access('anna', `shared:${doc.id}`)).toMatchObject({ rev: 2, data: { title: 'Renamed' }, members: ['anna'] });
      expect(() => again.access('mallory', `shared:${doc.id}`)).toThrow();
      expect(() => again.access('jo', 'shared:../../etc/passwd')).toThrow();
      expect(() => again.access('jo', doc.id)).toThrow(); // no prefix: not a shared id
    } finally { t.cleanup(); }
  });
});

describe('removing a person from one list of a shared category', () => {
  const shopping = 'shopping';
  const make = (jo: Call, title: string) => jo('POST', '/api/tasklists', { title, date: null, items: [{ title: 'x' }], categoryId: shopping });
  const removeAnna = async (jo: Call, id: string) => jo('DELETE', `/api/tasklists/${encodeURIComponent(id)}/share/${mockSub(ANNA)}`);
  /** Groceries and Party snacks in Shopping, shared with Anna, Anna removed from Groceries. */
  async function removed() {
    const k = await setup();
    const groceries = (await make(k.jo, 'Groceries')).body, party = (await make(k.jo, 'Party snacks')).body;
    await shareCategoryAndAccept(k.jo, k.anna, shopping, ANNA);
    const shared = (await allOpen(k.jo)).find((l) => l.title === 'Groceries');
    await removeAnna(k.jo, shared.id);
    return { ...k, groceries, party };
  }

  it('keeps the person off that list, the others stay shared and a new list reaches them', async () => {
    const { t, jo, anna } = await removed();
    try {
      expect(await titles(anna)).toEqual(['Party snacks']);
      expect(await titles(jo)).toEqual(['Groceries', 'Party snacks']);
      await make(jo, 'Bread');
      expect(await titles(anna)).toEqual(['Bread', 'Party snacks']);
    } finally { t.cleanup(); }
  });

  it('is not undone when the category invitation is accepted again', async () => {
    const { t, jo, anna } = await removed();
    try {
      await t.app.ctx.calendarFor(mockSub(JO)).grantCategory(shopping, mockSub(ANNA));
      expect(await titles(anna)).toEqual(['Party snacks']);
      expect(await titles(jo)).toEqual(['Groceries', 'Party snacks']);
    } finally { t.cleanup(); }
  });

  it('ends when the category share stops: a new share includes the list again', async () => {
    const { t, jo, anna } = await removed();
    try {
      await jo('PUT', `/api/categories/${shopping}/share`, { email: null });
      await shareCategoryAndAccept(jo, anna, shopping, ANNA);
      expect(await titles(anna)).toEqual(['Groceries', 'Party snacks']);
    } finally { t.cleanup(); }
  });

  it('ends for that list when the person is added to it by hand', async () => {
    const { t, jo, anna } = await removed();
    try {
      const own = (await allOpen(jo)).find((l) => l.title === 'Groceries');
      await shareAndAccept(jo, anna, own.id, ANNA);
      expect(await titles(anna)).toEqual(['Groceries', 'Party snacks']);
      await t.app.ctx.calendarFor(mockSub(JO)).grantCategory(shopping, mockSub(ANNA));
      expect(await titles(anna)).toEqual(['Groceries', 'Party snacks']);
    } finally { t.cleanup(); }
  });
});
