/** Sharing by a typed address (spec feature @id:shared-lists, ADR 0046): who is offered, and what an unknown address answers. */
import { describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { SHARE_ANSWER_MS, TaskSharing } from '../src/services/taskSharing.js';
import { makeApp, sessionCookie } from './helpers.js';

const JO = 'jo@example.com', ANNA = 'anna@example.com', BOB = 'bob@example.com', STRANGER = 'stranger@example.com';

async function setup() {
  const t = makeApp();
  await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA, BOB] });
  const as = async (email: string) => {
    const cookie = await sessionCookie(t, email);
    return (method: string, url: string, body?: unknown) => t.json(method, url, body, { cookie });
  };
  return { t, jo: await as(JO), anna: await as(ANNA), bob: await as(BOB) };
}
type Call = Awaited<ReturnType<typeof setup>>['jo'];
const offered = async (c: Call) => ((await c('GET', '/api/people')).body.people as { email: string }[]).map((p) => p.email);
const list = async (c: Call, title: string) => (await c('POST', '/api/tasklists', { title, date: null, items: [{ title: 'Milk' }] })).body;

describe('who is offered in "Share with"', () => {
  it('GET /api/people offers only the contacts of the person asking', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      // everybody has signed in, yet nobody is offered to anybody
      expect(await offered(jo)).toEqual([]);
      expect(await offered(anna)).toEqual([]);
      const groceries = await list(jo, 'Groceries');
      // the address is typed in a different case, with spaces
      expect((await jo('POST', `/api/tasklists/${groceries.id}/share`, { email: '  Anna@Example.COM ' })).status).toBe(200);
      expect(await offered(jo)).toEqual([ANNA]);            // typed
      expect(await offered(anna)).toEqual([JO]);            // shared with them
      expect(await offered(bob)).toEqual([]);               // nobody else's address
      // an address typed once is offered for the next list
      const errands = await list(jo, 'Errands');
      expect((await jo('POST', `/api/tasklists/${errands.id}/share`, { email: BOB })).status).toBe(200);
      expect(await offered(jo)).toEqual([ANNA, BOB]);
      expect(await offered(anna)).toEqual([JO]);
      expect(JSON.parse(JSON.stringify((await jo('GET', '/api/people')).body.people[0]))).toMatchObject({ sub: mockSub(ANNA), email: ANNA, initial: 'A' });
    } finally { t.cleanup(); }
  });

  it('keeps a typed address after the list stops being shared, only for the person who typed it', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo, 'Groceries');
      const shared = (await jo('POST', `/api/tasklists/${own.id}/share`, { email: ANNA })).body;
      await jo('DELETE', `/api/tasklists/${encodeURIComponent(shared.id)}/share`);
      expect(await offered(jo)).toEqual([ANNA]);
      expect(await offered(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('offers nobody who is no longer on the allow-list', async () => {
    const { t, jo } = await setup();
    try {
      await jo('POST', `/api/tasklists/${(await list(jo, 'G')).id}/share`, { email: ANNA });
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, BOB] });
      expect(await offered(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('shows the people of a category share to the one who shares and the one who receives', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      expect((await jo('PUT', '/api/categories/shopping/share', { email: ANNA })).status).toBe(200);
      expect(await offered(jo)).toEqual([ANNA]);
      expect(await offered(bob)).toEqual([]);
      expect(await offered(anna)).toEqual([]); // no list moved yet: nothing connects her to the owner
    } finally { t.cleanup(); }
  });

  it('carries the same scoped people in the change feed', async () => {
    const { t, jo, anna } = await setup();
    try {
      await jo('POST', `/api/tasklists/${(await list(jo, 'G')).id}/share`, { email: ANNA });
      for (const c of [jo, anna]) {
        const feed = (await c('GET', '/api/changes?today=2026-10-12')).body;
        expect(feed.files.people).toEqual((await c('GET', '/api/people')).body);
      }
      expect((await jo('GET', '/api/changes?today=2026-10-12')).body.files.people.people.map((p: { email: string }) => p.email)).toEqual([ANNA]);
    } finally { t.cleanup(); }
  });
});

describe('a typed address that names nobody', () => {
  it('answers an address that is not an allowed person like a success that shared nobody', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo, 'Groceries');
      const none = await jo('POST', `/api/tasklists/${own.id}/share`, { email: STRANGER });
      // a person who may use the calendar but has never signed in (removed from the people list)
      t.app.ctx.people.reset();
      await sessionCookie(t, JO);
      const unseen = await jo('POST', `/api/tasklists/${own.id}/share`, { email: ANNA });
      for (const r of [none, unseen]) {
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ id: own.id, title: 'Groceries', totalCount: 1 });
        expect(r.body.shared).toBeFalsy();
      }
      expect(Object.keys(none.body).sort()).toEqual(Object.keys(unseen.body).sort());
      expect(none.res.headers.get('content-type')).toBe(unseen.res.headers.get('content-type'));
      // nothing was shared, nothing is offered, nothing is remembered, nothing is stored
      expect(await offered(jo)).toEqual([]);
      expect((await anna('GET', '/api/tasklists/all-open?today=2026-10-12')).body.items).toEqual([]);
      expect(t.app.ctx.shared.candidates(mockSub(JO))).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('answers a shared list the same way, and keeps the members', async () => {
    const { t, jo, anna } = await setup();
    try {
      const shared = (await jo('POST', `/api/tasklists/${(await list(jo, 'Groceries')).id}/share`, { email: ANNA })).body;
      const r = await jo('POST', `/api/tasklists/${encodeURIComponent(shared.id)}/share`, { email: STRANGER });
      expect(r.status).toBe(200);
      expect(r.body.shared.with.map((p: { email: string }) => p.email)).toEqual([ANNA]);
      expect(await offered(anna)).toEqual([JO]);
    } finally { t.cleanup(); }
  });

  it('answers a category share to an unknown address by changing nothing', async () => {
    const { t, jo } = await setup();
    try {
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      const r = await jo('PUT', '/api/categories/shopping/share', { email: STRANGER });
      expect(r).toMatchObject({ status: 200, body: { shares: {} } });
      expect((await jo('GET', '/api/categories/shares')).body.shares).toEqual({});
      expect(await offered(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('is refused only for what says nothing about others: your own address, a malformed one, a stranger to the list', async () => {
    const { t, jo, bob } = await setup();
    try {
      const own = await list(jo, 'Groceries');
      expect((await jo('POST', `/api/tasklists/${own.id}/share`, { email: JO })).status).toBe(400);
      expect((await jo('POST', `/api/tasklists/${own.id}/share`, { email: 'not an address' })).status).toBe(400);
      expect((await bob('POST', `/api/tasklists/${own.id}/share`, { email: STRANGER })).status).toBe(404);
    } finally { t.cleanup(); }
  });

  it('holds every answer for the same minimum time outside tests', async () => {
    const started = Date.now();
    const sharing = new TaskSharing({} as never, {} as never, {} as never, {} as never, 'jo', 'Europe/Berlin', 60, {} as never);
    await (sharing as unknown as { hold(s: number): Promise<void> }).hold(started);
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(SHARE_ANSWER_MS).toBeGreaterThanOrEqual(500);
  });
});

describe('a newcomer', () => {
  it('signing in is not announced to anybody', async () => {
    const t = makeApp();
    try {
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
      t.app.ctx.people.reset();
      await sessionCookie(t, JO);
      const seen: Array<{ subs: string[]; kind: string }> = [];
      t.app.ctx.changes.on((e) => seen.push(e));
      await sessionCookie(t, ANNA);
      expect(seen).toEqual([]);
    } finally { t.cleanup(); }
  });
});
