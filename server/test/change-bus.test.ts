/** The one hook that reports every successful write (ChangeBus) and what the API reports to it. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockSub } from '../src/auth/people.js';
import { ALL_KINDS, ChangeBus, kindsOfPath, type ChangeEvent } from '../src/services/changeBus.js';
import { LOCAL_PERSON } from '../src/services/prefsStore.js';
import { makeApp, sessionCookie, type TestApp } from './helpers.js';

describe('ChangeBus', () => {
  it('hands each report to every listener, once per person, and stops after unsubscribe', () => {
    const bus = new ChangeBus();
    const a: ChangeEvent[] = [], b: ChangeEvent[] = [];
    const off = bus.on((e) => a.push(e));
    bus.on((e) => b.push(e));
    bus.emit(['x', 'y', 'x'], 'prefs');
    off();
    bus.emit(['x'], 'events');
    expect(a).toEqual([{ subs: ['x', 'y'], kind: 'prefs' }]);
    expect(b).toEqual([{ subs: ['x', 'y'], kind: 'prefs' }, { subs: ['x'], kind: 'events' }]);
  });

  it('ignores a report without people and survives a throwing listener', () => {
    const bus = new ChangeBus();
    const seen: ChangeEvent[] = [];
    bus.on(() => { throw new Error('boom'); });
    bus.on((e) => seen.push(e));
    bus.emit([], 'prefs');
    bus.emit(['x'], 'prefs');
    expect(seen).toHaveLength(1);
  });

  it('names the kinds of data a path changes', () => {
    expect(kindsOfPath('/events/abc')).toEqual(['events']);
    expect(kindsOfPath('/tasklists/abc/items/i1')).toEqual(['taskLists']);
    expect(kindsOfPath('/prefs/theme')).toEqual(['theme']);
    expect(kindsOfPath('/prefs')).toEqual(['prefs']);
    expect(kindsOfPath('/categories/c1/share')).toEqual(['shares', 'taskLists']);
    expect(kindsOfPath('/categories')).toEqual(['settings', 'taskLists']);
    expect(kindsOfPath('/health')).toEqual([]);
  });
});

describe('what the API reports', () => {
  let t: TestApp;
  let seen: ChangeEvent[];
  beforeEach(() => { t = makeApp(); seen = []; t.app.ctx.changes.on((e) => seen.push(e)); });
  afterEach(() => t.cleanup());

  it('reports a successful write once with the person and the kind', async () => {
    await t.json('PATCH', '/api/prefs', { labs: true });
    expect(seen).toEqual([{ subs: [LOCAL_PERSON], kind: 'prefs' }]);
  });

  it('reports nothing for a read or a refused write', async () => {
    await t.json('GET', '/api/prefs');
    await t.json('PATCH', '/api/prefs', { labs: 'yes' });
    await t.json('POST', '/api/tasklists', { date: '2026-10-12' });
    expect(seen).toEqual([]);
  });

  it('reports the people on a shared list, also after a delete or a leave', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    const jo = { cookie: await sessionCookie(t, JO) }, anna = { cookie: await sessionCookie(t, ANNA) };
    const own = (await t.json('POST', '/api/tasklists', { title: 'G', date: null, items: [] }, jo)).body;
    const shared = (await t.json('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) }, jo)).body;
    const both = [mockSub(JO), mockSub(ANNA)].sort();
    seen.length = 0;
    await t.json('POST', `/api/tasklists/${shared.id}/items`, { title: 'Milk' }, jo);
    expect(seen.map((e) => [e.kind, [...e.subs].sort()])).toEqual([['taskLists', both]]);
    seen.length = 0;
    await t.json('POST', `/api/tasklists/${shared.id}/leave`, undefined, anna);
    expect(seen.map((e) => [e.kind, [...e.subs].sort()])).toEqual([['taskLists', both]]);
  });

  it('reports a category share to the person it is moved to and to the one it was taken from', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    const jo = { cookie: await sessionCookie(t, JO) };
    // signing in for the first time is reported too (to everyone known), not part of this case
    seen.length = 0;
    await t.json('PUT', '/api/categories/shopping/share', { person: mockSub(ANNA) }, jo);
    expect(seen.find((e) => e.kind === 'shares')!.subs.sort()).toEqual([mockSub(JO), mockSub(ANNA)].sort());
    seen.length = 0;
    await t.json('PUT', '/api/categories/shopping/share', { person: null }, jo);
    expect(seen.find((e) => e.kind === 'shares')!.subs).toContain(mockSub(ANNA));
  });

  it('reports a demo reset as a change of every kind', async () => {
    await t.json('POST', '/api/demo/reset');
    expect(seen.map((e) => e.kind).sort()).toEqual([...ALL_KINDS].sort());
  });
});
