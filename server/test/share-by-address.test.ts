/** Who is offered in "Share with" (spec feature @id:shared-lists, ADR 0046, ADR 0047): only people who accepted a share, never an address that was only typed. */
import { describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { makeApp, sessionCookie, shareAndAccept, shareCategoryAndAccept } from './helpers.js';

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
      // the address is typed in a different case, with spaces; an invitation alone offers nobody
      expect((await jo('POST', `/api/tasklists/${groceries.id}/share`, { email: '  Anna@Example.COM ' })).status).toBe(200);
      expect(await offered(jo)).toEqual([]);
      expect(await offered(anna)).toEqual([]);
      const [inv] = (await anna('GET', '/api/invitations')).body.invitations;
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(200);
      expect(await offered(jo)).toEqual([ANNA]);            // accepted
      expect(await offered(anna)).toEqual([JO]);            // shared with them
      expect(await offered(bob)).toEqual([]);               // nobody else's address
      // an address that was accepted once is offered for the next list
      const errands = await list(jo, 'Errands');
      await shareAndAccept(jo, bob, errands.id, BOB);
      expect(await offered(jo)).toEqual([ANNA, BOB]);
      expect(await offered(anna)).toEqual([JO]);
      expect(JSON.parse(JSON.stringify((await jo('GET', '/api/people')).body.people[0]))).toMatchObject({ sub: mockSub(ANNA), email: ANNA, initial: 'A' });
    } finally { t.cleanup(); }
  });

  it('keeps an accepted address after the list stops being shared, only for the person who shared', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo, 'Groceries');
      const shared = await shareAndAccept(jo, anna, own.id, ANNA);
      await jo('DELETE', `/api/tasklists/${encodeURIComponent(shared.id)}/share`);
      expect(await offered(jo)).toEqual([ANNA]);
      expect(await offered(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('offers nobody who is no longer on the allow-list', async () => {
    const { t, jo, anna } = await setup();
    try {
      await shareAndAccept(jo, anna, (await list(jo, 'G')).id, ANNA);
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, BOB] });
      expect(await offered(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('shows the people of an accepted category share to the one who shares and the one who receives', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      await shareCategoryAndAccept(jo, anna, 'shopping', ANNA);
      expect(await offered(jo)).toEqual([ANNA]);
      expect(await offered(bob)).toEqual([]);
      expect(await offered(anna)).toEqual([]); // no list moved yet: nothing connects her to the owner
    } finally { t.cleanup(); }
  });

  it('carries the same scoped people in the change feed', async () => {
    const { t, jo, anna } = await setup();
    try {
      await shareAndAccept(jo, anna, (await list(jo, 'G')).id, ANNA);
      for (const c of [jo, anna]) {
        const feed = (await c('GET', '/api/changes?today=2026-10-12')).body;
        expect(feed.files.people).toEqual((await c('GET', '/api/people')).body);
      }
      expect((await jo('GET', '/api/changes?today=2026-10-12')).body.files.people.people.map((p: { email: string }) => p.email)).toEqual([ANNA]);
    } finally { t.cleanup(); }
  });

  it('answers a shared list the same way, and keeps the members', async () => {
    const { t, jo, anna } = await setup();
    try {
      const shared = await shareAndAccept(jo, anna, (await list(jo, 'Groceries')).id, ANNA);
      const r = await jo('POST', `/api/tasklists/${encodeURIComponent(shared.id)}/share`, { email: STRANGER });
      expect(r.status).toBe(200);
      expect(r.body.shared.with.map((p: { email: string }) => p.email)).toEqual([ANNA]);
      expect(await offered(anna)).toEqual([JO]);
    } finally { t.cleanup(); }
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
