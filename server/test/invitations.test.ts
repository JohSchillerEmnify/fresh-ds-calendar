/** Invitations to share (spec feature @id:shared-lists, ADR 0047): what is stored, who may answer, expiry, and what stays unsaid. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';
import { setDiagSink } from '../src/lib/diag.js';
import { mockSub } from '../src/auth/people.js';
import { makeApp, sessionCookie, shareAndAccept, shareCategoryAndAccept } from './helpers.js';

const JO = 'jo@example.com', ANNA = 'anna@example.com', BOB = 'bob@example.com', STRANGER = 'stranger@example.com';
const DAY = 86_400_000;
type Json = ReturnType<typeof JSON.parse>;

async function setup() {
  const t = makeApp();
  await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA, BOB] });
  const as = async (email: string) => {
    const cookie = await sessionCookie(t, email);
    return (method: string, url: string, body?: unknown) => t.json(method, url, body, { cookie });
  };
  return { t, jo: await as(JO), anna: await as(ANNA), bob: await as(BOB), as };
}
type Call = Awaited<ReturnType<typeof setup>>['jo'];
const list = async (c: Call, title = 'Groceries') => (await c('POST', '/api/tasklists', { title, date: null, items: [{ title: 'Milk' }] })).body;
const invite = (c: Call, id: string, email: string) => c('POST', `/api/tasklists/${encodeURIComponent(id)}/share`, { email });
const incoming = async (c: Call): Promise<Json[]> => (await c('GET', '/api/invitations')).body.invitations;
const sent = async (c: Call): Promise<Json[]> => (await c('GET', '/api/invitations')).body.sent;
const titles = async (c: Call): Promise<string[]> => ((await c('GET', '/api/tasklists/all-open?today=2026-10-12')).body.items as { title: string }[]).map((l) => l.title).sort();
const at = (t: { app: { ctx: { clock: { set(ms: number, frozen: boolean): void } } } }, ms: number) => t.app.ctx.clock.set(ms, true);

describe('sending an invitation', () => {
  it('shares nothing: the list stays put, the sender sees a pending invitation, the other person one to answer', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo);
      const r = await invite(jo, own.id, '  Anna@Example.COM ');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: own.id, title: 'Groceries' });
      expect(r.body.shared).toBeUndefined();
      expect(await titles(anna)).toEqual([]);
      expect(await sent(jo)).toMatchObject([{ kind: 'list', target: own.id, address: ANNA }]);
      expect(await incoming(anna)).toMatchObject([{ kind: 'list', title: 'Groceries', from: JO }]);
      // the sender's copy says nothing of the person behind the address
      expect(Object.keys((await sent(jo))[0]).sort()).toEqual(['address', 'expires', 'id', 'kind', 'target']);
      expect(await incoming(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('is kept once however often it is sent', async () => {
    const { t, jo } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      await invite(jo, own.id, ANNA);
      expect(await sent(jo)).toHaveLength(1);
    } finally { t.cleanup(); }
  });

  it('is refused only for what says nothing about others: yourself, a malformed address, a repeating list, a stranger to the list', async () => {
    const { t, jo, bob } = await setup();
    try {
      const own = await list(jo);
      expect((await invite(jo, own.id, JO)).status).toBe(400);
      expect((await invite(jo, own.id, 'not an address')).status).toBe(400);
      const weekly = (await jo('POST', '/api/tasklists', { title: 'Weekly', date: '2026-10-14', recurrence: 'weekly', items: [{ title: 'x' }] })).body;
      expect((await invite(jo, weekly.id, ANNA)).status).toBe(400);
      expect((await invite(bob, own.id, ANNA)).status).toBe(404);
      expect(await sent(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('answers a known, an unknown and a removed address the same way', async () => {
    const { t, jo } = await setup();
    try {
      const own = await list(jo);
      const known = await invite(jo, own.id, ANNA);
      const unknown = await invite(jo, own.id, STRANGER);
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, BOB] });
      const removed = await invite(jo, own.id, ANNA);
      for (const r of [known, unknown, removed]) {
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ id: own.id, title: 'Groceries', totalCount: 1 });
        expect(r.body.shared).toBeFalsy();
      }
      expect(Object.keys(known.body).sort()).toEqual(Object.keys(unknown.body).sort());
      expect(known.res.headers.get('content-type')).toBe(unknown.res.headers.get('content-type'));
      // a category answers alike too
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      const cat = [await jo('PUT', '/api/categories/shopping/share', { email: BOB }), await jo('PUT', '/api/categories/shopping/share', { email: STRANGER })];
      expect(cat.map((r) => [r.status, r.body])).toEqual([[200, { shares: {} }], [200, { shares: {} }]]);
      // the sender is not offered anybody for it, whoever uses the calendar
      expect(((await jo('GET', '/api/people')).body.people as unknown[])).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('holds every answer, known address or not, for the minimum time', async () => {
    const { t, jo } = await setup();
    try {
      await t.json('POST', '/api/__test/config', { shareAnswerMs: 300 });
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      const timed = async (call: () => Promise<{ status: number }>) => { const t0 = Date.now(); const r = await call(); expect(r.status).toBe(200); return Date.now() - t0; };
      const [a, b] = [await list(jo, 'A'), await list(jo, 'B')];
      expect(await timed(() => invite(jo, a.id, STRANGER))).toBeGreaterThanOrEqual(290);
      expect(await timed(() => invite(jo, b.id, ANNA))).toBeGreaterThanOrEqual(290);
      expect(await timed(() => jo('PUT', '/api/categories/shopping/share', { email: STRANGER }))).toBeGreaterThanOrEqual(290);
      expect(await timed(() => jo('PUT', '/api/categories/shopping/share', { email: BOB }))).toBeGreaterThanOrEqual(290);
    } finally { t.cleanup(); }
  });

  it('writes nothing personal to the log', async () => {
    const { t, jo, anna } = await setup();
    const lines: string[] = [];
    const restore = setDiagSink((l) => lines.push(l));
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    try {
      const own = await list(jo, 'Secret plans');
      await invite(jo, own.id, STRANGER);
      await invite(jo, own.id, ANNA);
      const [inv] = await incoming(anna);
      await anna('POST', `/api/invitations/${inv.id}/decline`);
      const out = [...lines, ...spies.flatMap((s) => s.mock.calls.map((c) => c.join(' ')))].join('\n');
      expect(out).toContain('invitation_sent');
      for (const secret of [JO, ANNA, STRANGER, 'Secret plans', mockSub(ANNA)]) expect(out).not.toContain(secret);
    } finally { restore(); spies.forEach((s) => s.mockRestore()); t.cleanup(); }
  });
});

describe('answering', () => {
  it('accepting moves the list into the shared store for both and ends the invitation', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      const [inv] = await incoming(anna);
      const r = await anna('POST', `/api/invitations/${inv.id}/accept`);
      expect(r).toMatchObject({ status: 200, body: { listId: expect.stringMatching(/^shared:/) } });
      expect(await titles(anna)).toEqual(['Groceries']);
      expect(await titles(jo)).toEqual(['Groceries']);
      expect(await incoming(anna)).toEqual([]);
      expect(await sent(jo)).toEqual([]);
      // each is offered the other from now on
      expect(((await anna('GET', '/api/people')).body.people as { email: string }[]).map((p) => p.email)).toEqual([JO]);
      expect(((await jo('GET', '/api/people')).body.people as { email: string }[]).map((p) => p.email)).toEqual([ANNA]);
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(404);
    } finally { t.cleanup(); }
  });

  it('declining shares nothing and the sender keeps seeing a pending invitation', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      const [inv] = await incoming(anna);
      expect((await anna('POST', `/api/invitations/${inv.id}/decline`)).status).toBe(200);
      expect(await incoming(anna)).toEqual([]);
      expect(await titles(anna)).toEqual([]);
      expect(await sent(jo)).toMatchObject([{ address: ANNA }]);
      // sending it again does not bring it back, and tells the sender nothing
      expect((await invite(jo, own.id, ANNA)).status).toBe(200);
      expect(await incoming(anna)).toEqual([]);
      expect(await sent(jo)).toHaveLength(1);
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(404);
      // the sender may withdraw it
      await jo('POST', `/api/invitations/${(await sent(jo))[0].id}/withdraw`);
      expect(await sent(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('only the invited person answers, only the sender withdraws, anybody else gets 404', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      const [inv] = await incoming(anna);
      const [mine] = await sent(jo);
      for (const call of [bob, jo]) {
        for (const verb of ['accept', 'decline']) expect((await call('POST', `/api/invitations/${inv.id}/${verb}`)).status).toBe(404);
      }
      for (const call of [bob, anna]) expect((await call('POST', `/api/invitations/${mine.id}/withdraw`)).status).toBe(404);
      expect((await anna('POST', '/api/invitations/nope/accept')).status).toBe(404);
      expect(await titles(bob)).toEqual([]);
      expect(await incoming(anna)).toHaveLength(1);
    } finally { t.cleanup(); }
  });

  it('withdrawing takes the invitation away from the other person', async () => {
    const { t, jo, anna } = await setup();
    try {
      await invite(jo, (await list(jo)).id, ANNA);
      expect((await jo('POST', `/api/invitations/${(await sent(jo))[0].id}/withdraw`)).status).toBe(200);
      expect(await incoming(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('an invitation of a list that is gone answers 404 and is dropped', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      await jo('DELETE', `/api/tasklists/${own.id}`);
      const [inv] = await incoming(anna);
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(404);
      expect(await incoming(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });

  it('keeps following its list when the list moves into the shared store for somebody else', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      await shareAndAccept(jo, bob, own.id, BOB); // the list now has a new id
      const [inv] = await incoming(anna);
      const r = await anna('POST', `/api/invitations/${inv.id}/accept`);
      expect(r.status).toBe(200);
      expect(await titles(anna)).toEqual(['Groceries']);
      expect((await jo('GET', `/api/tasklists/${encodeURIComponent(r.body.listId)}`)).body.shared.with.map((p: { email: string }) => p.email).sort()).toEqual([ANNA, BOB]);
    } finally { t.cleanup(); }
  });
});

describe('a category', () => {
  it('sends one invitation; accepting shares its lists and the new ones', async () => {
    const { t, jo, anna } = await setup();
    try {
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      await jo('POST', '/api/tasklists', { title: 'Groceries', date: null, items: [{ title: 'Milk' }], categoryId: 'shopping' });
      expect((await jo('PUT', '/api/categories/shopping/share', { email: ANNA })).body.shares).toEqual({});
      expect(await titles(anna)).toEqual([]);
      expect(await incoming(anna)).toMatchObject([{ kind: 'category', title: 'Shopping', from: JO }]);
      expect(await sent(jo)).toMatchObject([{ kind: 'category', target: 'shopping', address: ANNA }]);
      await shareCategoryAndAccept(jo, anna, 'shopping', ANNA);
      await jo('POST', '/api/tasklists', { title: 'Party snacks', date: null, items: [{ title: 'Chips' }], categoryId: 'shopping' });
      expect(await titles(anna)).toEqual(['Groceries', 'Party snacks']);
    } finally { t.cleanup(); }
  });
});

describe('expiry', () => {
  it('an invitation lapses after 7 days, for both people', async () => {
    const { t, jo, anna } = await setup();
    try {
      const start = Date.parse('2026-10-12T08:00:00+02:00');
      at(t, start);
      await invite(jo, (await list(jo)).id, ANNA);
      at(t, start + 7 * DAY - 1000);
      expect(await incoming(anna)).toHaveLength(1);
      at(t, start + 7 * DAY);
      expect(await incoming(anna)).toEqual([]);
      expect(await sent(jo)).toEqual([]);
      // the lapsed one is gone from the file too
      expect(JSON.parse(fs.readFileSync(path.join(t.dir, 'shared', 'invitations.json'), 'utf8'))).toEqual([]);
    } finally { t.cleanup(); }
  });
});

describe('an address that has not signed in yet', () => {
  it('keeps the invitation until the first sign-in, and the sender sees the same as for any address', async () => {
    const { t, jo, as } = await setup();
    try {
      const NEW = 'newcomer@example.com';
      await t.json('POST', '/api/__test/auth/newcomer', { email: NEW });
      const own = await list(jo);
      const r = await invite(jo, own.id, NEW);
      expect(r.status).toBe(200);
      expect(await sent(jo)).toMatchObject([{ address: NEW }]);
      const newcomer = await as(NEW);
      expect(await incoming(newcomer)).toMatchObject([{ kind: 'list', title: 'Groceries', from: JO }]);
      expect((await newcomer('POST', `/api/invitations/${(await incoming(newcomer))[0].id}/accept`)).status).toBe(200);
      expect(await titles(newcomer)).toEqual(['Groceries']);
    } finally { t.cleanup(); }
  });

  it('a person taken off the allow-list sees no invitations', async () => {
    const { t, jo, anna } = await setup();
    try {
      await invite(jo, (await list(jo)).id, ANNA);
      await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, BOB] });
      const r = await anna('GET', '/api/invitations');
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.body?.invitations).toBeUndefined();
    } finally { t.cleanup(); }
  });
});

describe('when something goes wrong while accepting', () => {
  it('a sharer whose Google access is gone does not sign the invited person out, and the invitation stays', async () => {
    const { t, jo, anna } = await setup();
    try {
      await invite(jo, (await list(jo)).id, ANNA);
      await t.json('POST', '/api/__test/oauth/revoke', { email: JO });
      const r = await anna('POST', `/api/invitations/${(await incoming(anna))[0].id}/accept`);
      expect([401, 403]).not.toContain(r.status);
      expect(r).toMatchObject({ status: 503, body: { error: { key: 'sharing.invite.acceptLater' } } });
      expect(await incoming(anna)).toHaveLength(1);
      // the invited person's own Google is untouched
      expect((await anna('GET', '/api/items?from=2026-10-12&to=2026-10-19')).status).toBe(200);
    } finally { t.cleanup(); }
  });

  it('a failed move leaves the invitations of the list pointing at the list that still exists', async () => {
    const { t, jo, anna, bob } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      await invite(jo, own.id, BOB);
      const spy = vi.spyOn(MockGoogleProvider.prototype, 'deleteEvent').mockRejectedValueOnce(new Error('Google is down'));
      const failed = await anna('POST', `/api/invitations/${(await incoming(anna))[0].id}/accept`);
      spy.mockRestore();
      expect(failed.status).toBeGreaterThanOrEqual(400);
      expect((await sent(jo)).map((i) => i.target)).toEqual([own.id, own.id]);
      // a retry works, and so does the other invitation
      expect((await anna('POST', `/api/invitations/${(await incoming(anna))[0].id}/accept`)).status).toBe(200);
      expect((await bob('POST', `/api/invitations/${(await incoming(bob))[0].id}/accept`)).status).toBe(200);
      expect(await titles(bob)).toEqual(['Groceries']);
    } finally { t.cleanup(); }
  });

  it('an invitation of a sharer who may no longer use the calendar is not shown and cannot be accepted', async () => {
    const { t, jo, anna } = await setup();
    try {
      await invite(jo, (await list(jo)).id, ANNA);
      const [inv] = await incoming(anna);
      await t.json('POST', '/api/__test/auth', { allowedEmails: [ANNA, BOB] });
      expect(await incoming(anna)).toEqual([]);
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(404);
    } finally { t.cleanup(); }
  });

  it('accepting while the sharer withdraws leaves nothing shared with the invited person and answers 404', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = await list(jo);
      await invite(jo, own.id, ANNA);
      const [mine] = await sent(jo);
      const real = MockGoogleProvider.prototype.deleteEvent;
      const spy = vi.spyOn(MockGoogleProvider.prototype, 'deleteEvent').mockImplementationOnce(async function (this: MockGoogleProvider, ...a: Parameters<typeof real>) {
        t.app.ctx.shared.invitations.remove(mine.id);
        return real.apply(this, a);
      });
      const r = await anna('POST', `/api/invitations/${(await incoming(anna))[0].id}/accept`);
      spy.mockRestore();
      expect(r.status).toBe(404);
      expect(await titles(anna)).toEqual([]);
      expect(await titles(jo)).toEqual(['Groceries']);
    } finally { t.cleanup(); }
  });

  it('a list that began to repeat after the invitation answers 404 and drops it', async () => {
    const { t, jo, anna } = await setup();
    try {
      const own = (await jo('POST', '/api/tasklists', { title: 'Dated', date: '2026-10-14', items: [{ title: 'x' }] })).body;
      await invite(jo, own.id, ANNA);
      expect((await jo('PATCH', `/api/tasklists/${own.id}`, { recurrence: 'weekly' }, { 'If-Match': own.etag })).status).toBe(200);
      const [inv] = await incoming(anna);
      expect((await anna('POST', `/api/invitations/${inv.id}/accept`)).status).toBe(404);
      expect(await incoming(anna)).toEqual([]);
    } finally { t.cleanup(); }
  });
});

describe('limits', () => {
  it('a person keeps at most 50 invitations open, the same answer for every address', async () => {
    const { t, jo } = await setup();
    try {
      const own = await list(jo);
      for (let n = 0; n < 50; n++) expect((await invite(jo, own.id, `p${n}@example.com`)).status).toBe(200);
      expect((await invite(jo, own.id, 'p50@example.com')).status).toBe(400);
      expect((await invite(jo, own.id, 'p0@example.com')).status).toBe(200); // already open: nothing new
      expect(await sent(jo)).toHaveLength(50);
    } finally { t.cleanup(); }
  });

  it('does not invite the person a category is already shared with', async () => {
    const { t, jo, anna } = await setup();
    try {
      await jo('POST', '/api/categories', { id: 'shopping', name: 'Shopping', color: '#112233' });
      await shareCategoryAndAccept(jo, anna, 'shopping', ANNA);
      expect((await jo('PUT', '/api/categories/shopping/share', { email: ANNA })).status).toBe(200);
      expect(await sent(jo)).toEqual([]);
    } finally { t.cleanup(); }
  });
});
