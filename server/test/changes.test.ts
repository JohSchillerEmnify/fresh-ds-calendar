/** `GET /api/changes` (ADR 0025, spec/API.md): the device's "changes since" read, against the mock provider. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../src/providers/CalendarProvider.js';
import { mockSub } from '../src/auth/people.js';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
beforeEach(async () => { t = makeApp(); await freeze(t); });
afterEach(() => t.cleanup());

const TODAY = '2026-10-12';
const url = (cursor?: string) => `/api/changes?today=${TODAY}${cursor ? `&cursor=${cursor}` : ''}`;
const changes = async (cursor?: string) => (await t.json('GET', url(cursor))).body;
const ev = (title: string, date = '2026-10-14') => t.json('POST', '/api/events', { title, allDay: true, start: date, end: date.replace(/..$/, (d) => String(Number(d) + 1).padStart(2, '0')) });
const titles = (xs: { title: string }[]) => xs.map((x) => x.title).sort();

describe('first call (no cursor)', () => {
  it('answers everything in full: window, calendars, events, task lists, files and a cursor', async () => {
    await ev('Dentist');
    await t.json('POST', '/api/tasklists', { title: 'Chores', date: TODAY, items: [{ title: 'Vacuum' }] });
    await t.json('POST', '/api/tasklists', { title: 'Someday', date: null, items: [] });
    const r = await changes();
    expect(r).toMatchObject({ full: true, window: { from: '2025-10-12', to: '2027-10-13' } });
    expect(typeof r.cursor).toBe('string');
    expect(r.calendars.map((c: any) => c.id)).toEqual(expect.arrayContaining(['primary', 'work']));
    expect(r.events.replace).toEqual(expect.arrayContaining(['primary', 'work']));
    expect(titles(r.events.upserts)).toEqual(['Dentist']);
    expect(r.taskLists.replace).toBe(true);
    expect(titles(r.taskLists.upserts)).toEqual(['Chores', 'Someday']);
    expect(Object.keys(r.files).sort()).toEqual(['canvas', 'categoryShares', 'motivation', 'people', 'prefs', 'settings', 'tasksCalendarReminders', 'templates', 'theme', 'themes']);
  });

  it('treats a cursor that is not ours as no cursor', async () => {
    expect((await changes('garbage')).full).toBe(true);
    expect((await changes(Buffer.from('{"v":2}').toString('base64url'))).full).toBe(true);
  });

  it('keeps events inside the window only', async () => {
    await ev('Far away', '2030-01-10');
    await ev('Near');
    expect(titles((await changes()).events.upserts)).toEqual(['Near']);
  });
});

describe('with a cursor', () => {
  it('answers nothing when nothing changed', async () => {
    await ev('Dentist');
    const r = await changes((await changes()).cursor);
    expect(r).toMatchObject({ full: false, files: {}, events: { replace: [], series: [], removed: [], upserts: [] }, taskLists: { replace: false, series: [], removed: [], upserts: [] } });
  });

  it('returns added and changed events, and removed ones, also on days never opened', async () => {
    const a = (await ev('Dentist')).body;
    const b = (await ev('Gym', '2027-03-03')).body;
    const c0 = (await changes()).cursor;
    await ev('Concert', '2027-04-04');
    await t.json('PATCH', `/api/events/${a.id}`, { title: 'Dentist 2' });
    await t.json('DELETE', `/api/events/${b.id}`);
    const r = await changes(c0);
    expect(titles(r.events.upserts)).toEqual(['Concert', 'Dentist 2']);
    expect(r.events.removed).toEqual([{ calendarId: 'primary', id: b.id }]);
    expect(r.events.replace).toEqual([]);
    // the next cursor starts after these changes
    expect((await changes(r.cursor)).events.upserts).toEqual([]);
  });

  it('reports an event moved out of the window as removed, not as an upsert', async () => {
    const a = (await ev('Dentist')).body;
    const c0 = (await changes()).cursor;
    await t.json('PATCH', `/api/events/${a.id}`, { start: '2031-01-10', end: '2031-01-11' });
    const r = await changes(c0);
    expect(r.events.upserts).toEqual([]);
    expect(r.events.removed).toEqual([{ calendarId: 'primary', id: a.id }]);
  });

  it('reports a change made at Google itself', async () => {
    const c0 = (await changes()).cursor;
    await t.json('POST', '/api/__test/remote/events', { summary: 'From Google', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } });
    expect(titles((await changes(c0)).events.upserts)).toEqual(['From Google']);
  });

  it('keeps two devices independent: each cursor sees every change after it', async () => {
    const c0 = (await changes()).cursor;
    await ev('One');
    const first = await changes(c0);
    await ev('Two');
    expect(titles((await changes(first.cursor)).events.upserts)).toEqual(['Two']);
    expect(titles((await changes(c0)).events.upserts)).toEqual(['One', 'Two']);
  });

  it('lists a calendar in full again, as replace, when its token is gone (410), without an error', async () => {
    await ev('Dentist');
    await t.json('POST', '/api/tasklists', { title: 'Chores', date: TODAY, items: [] });
    const c0 = (await changes()).cursor;
    t.app.ctx.mock!.expireSyncTokens();
    const res = await t.json('GET', url(c0));
    expect(res.status).toBe(200);
    expect(res.body.events.replace).toEqual(expect.arrayContaining(['primary', 'work']));
    expect(titles(res.body.events.upserts)).toEqual(['Dentist']);
    expect(res.body.taskLists.replace).toBe(true);
    expect(titles(res.body.taskLists.upserts)).toEqual(['Chores']);
    // and the new cursor works again
    expect((await changes(res.body.cursor)).events.replace).toEqual([]);
  });

  it('loads the days that enter the window as the days pass', async () => {
    await ev('In two years', '2027-10-20');
    const c0 = (await changes()).cursor;
    await freeze(t, '2026-10-20T08:00:00+02:00');
    const next = await t.json('GET', `/api/changes?today=2026-10-20&cursor=${c0}`);
    expect(next.body.window.to).toBe('2027-10-21');
    expect(titles(next.body.events.upserts)).toEqual(['In two years']);
    expect(next.body.events.replace).toEqual([]);
  });
});

describe('task lists', () => {
  it('returns added, changed and deleted lists of any date', async () => {
    const a = (await t.json('POST', '/api/tasklists', { title: 'A', date: null, items: [{ title: 'x' }] })).body;
    const b = (await t.json('POST', '/api/tasklists', { title: 'B', date: '2025-01-01', items: [] })).body;
    const c0 = (await changes()).cursor;
    await t.json('POST', `/api/tasklists/${a.id}/items`, { title: 'y' });
    await t.json('DELETE', `/api/tasklists/${b.id}`);
    await t.json('POST', '/api/tasklists', { title: 'C', date: '2026-11-01', items: [] });
    const r = await changes(c0);
    expect(titles(r.taskLists.upserts)).toEqual(['A', 'C']);
    expect(r.taskLists.upserts.find((l: any) => l.title === 'A').items).toHaveLength(2);
    expect(r.taskLists.removed).toEqual([b.id]);
    expect(r.taskLists.replace).toBe(false);
  });

  it('answers the window\'s instances of a repeating list when one changes, and the series to replace', async () => {
    const m = (await t.json('POST', '/api/tasklists', { title: 'Weekly', date: TODAY, items: [{ title: 'Meds' }], recurrence: 'weekly' })).body;
    const first = await changes();
    const instances = first.taskLists.upserts.filter((l: any) => l.title === 'Weekly');
    expect(instances.length).toBeGreaterThan(50);
    const target = instances[3];
    await t.json('POST', `/api/tasklists/${target.id}/items`, { title: 'Extra' });
    const r = await changes(first.cursor);
    expect(r.taskLists.series.length).toBeGreaterThan(0);
    expect(r.taskLists.upserts.find((l: any) => l.id === target.id).items).toHaveLength(2);
    expect(r.taskLists.upserts.length).toBeGreaterThan(50);
    expect(m.id).toBeTruthy();
  });
});

describe('per-person files', () => {
  it('sends a file only when its version moved', async () => {
    const c0 = (await changes()).cursor;
    await t.json('PATCH', '/api/prefs', { labs: true });
    const r1 = await changes(c0);
    expect(Object.keys(r1.files)).toEqual(['prefs']);
    expect(r1.files.prefs.labs).toBe(true);
    expect(Object.keys((await changes(r1.cursor)).files)).toEqual([]);
  });

  it('covers settings, templates, canvas, theme choice and motivation', async () => {
    const c0 = (await changes()).cursor;
    const writes = [
      await t.json('POST', '/api/categories', { name: 'Pets', color: '#112233' }),
      await t.json('POST', '/api/templates', { name: 'Trip', items: [{ title: 'Passport' }] }),
      await t.json('PUT', '/api/canvas', { areas: [{ id: 'a1', name: 'Haus', color: '#1a73e8', x: 100, y: 200, w: 320, h: 240 }] }),
      await t.json('PATCH', '/api/prefs/theme', { preset: 'Neon' }),
      await t.json('POST', '/api/streak/checkin'),
    ];
    expect(writes.map((w) => w.status)).toEqual([201, 201, 200, 200, 200]);
    const files = (await changes(c0)).files;
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['settings', 'templates', 'canvas', 'theme', 'motivation']));
    expect(files.settings.categories.map((c: any) => c.name)).toContain('Pets');
  });

  it('re-sends the events of a read-only calendar when the person\'s own reminders on them changed', async () => {
    const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: 'reader', ownerEmail: 'anna@example.org' })).body;
    const e = (await t.json('POST', '/api/__test/remote/events', { summary: 'Yoga', calendarId: cal.id, start: { dateTime: '2026-10-14T07:00:00+02:00' }, end: { dateTime: '2026-10-14T08:00:00+02:00' } })).body;
    const c0 = (await changes()).cursor;
    await t.json('PATCH', `/api/events/${e.id}`, { reminders: { useDefault: false, minutes: [30] } });
    const r = await changes(c0);
    expect(r.events.replace).toEqual(['anna@example.org']);
    expect(r.events.upserts.find((x: any) => x.id === e.id).reminders).toEqual({ useDefault: false, minutes: [30] });
  });
});

describe('shared lists', () => {
  it('reports shared lists added, changed, left and deleted, per person', async () => {
    const JO = 'jo@example.com', ANNA = 'anna@example.com';
    await t.json('POST', '/api/__test/auth', { allowedEmails: [JO, ANNA] });
    const as = async (email: string) => {
      const cookie = await sessionCookie(t, email);
      return (method: string, path: string, body?: unknown) => t.json(method, path, body, { cookie });
    };
    const jo = await as(JO), anna = await as(ANNA);
    const own = (await jo('POST', '/api/tasklists', { title: 'Groceries', date: null, items: [{ title: 'Milk' }] })).body;
    const c0 = (await jo('GET', url())).body.cursor, a0 = (await anna('GET', url())).body.cursor;
    const shared = (await jo('POST', `/api/tasklists/${own.id}/share`, { person: mockSub(ANNA) })).body;
    // Jo's own Google copy is gone, the shared one arrives; Anna gets it too
    const jr = (await jo('GET', url(c0))).body;
    expect(jr.taskLists.removed).toContain(own.id);
    expect(jr.taskLists.upserts.map((l: any) => l.id)).toEqual([shared.id]);
    expect((await anna('GET', url(a0))).body.taskLists.upserts.map((l: any) => l.id)).toEqual([shared.id]);
    // a change by Jo reaches Anna; an unchanged list is left out
    const a1 = (await anna('GET', url(a0))).body.cursor;
    expect((await anna('GET', url(a1))).body.taskLists.upserts).toEqual([]);
    await jo('POST', `/api/tasklists/${shared.id}/items`, { title: 'Eggs' });
    expect((await anna('GET', url(a1))).body.taskLists.upserts[0].items).toHaveLength(2);
    // leaving removes it for Anna only
    const a2 = (await anna('GET', url(a1))).body.cursor;
    await anna('POST', `/api/tasklists/${shared.id}/leave`);
    expect((await anna('GET', url(a2))).body.taskLists.removed).toEqual([shared.id]);
    expect((await jo('GET', url((await jo('GET', url(c0))).body.cursor))).body.taskLists.removed).toEqual([]);
  });
});

describe('robustness', () => {
  it('takes the sync token from a read without a time range or filter, which Google refuses together with a token', async () => {
    const spy = vi.spyOn(t.app.ctx.mock!, 'listEvents');
    await changes();
    const tokenReads = spy.mock.calls.map((c) => c[0]).filter((p) => p.singleEvents === false);
    expect(tokenReads.length).toBeGreaterThanOrEqual(3);
    for (const p of tokenReads) expect(p).not.toHaveProperty('timeMin');
    for (const p of tokenReads) expect(p).not.toHaveProperty('timeMax');
    for (const p of tokenReads) expect(p).not.toHaveProperty('privateExtendedProperty');
  });

  it('ignores a date of the device that is far from the server\'s: the window stays around the server\'s today', async () => {
    for (const today of ['9999-12-31', '0000-01-01', '2026-10-30']) {
      const r = await t.json('GET', `/api/changes?today=${today}`);
      expect(r.status, today).toBe(200);
      expect(r.body.window).toEqual({ from: '2025-10-12', to: '2027-10-13' });
    }
    expect((await t.json('GET', '/api/changes?today=nope')).status).toBe(400);
    expect((await t.json('GET', '/api/changes?today=2026-10-14')).body.window.from).toBe('2025-10-14');
  });

  it('lists a calendar in full instead of one instances call per series when many series changed', async () => {
    const made = [];
    for (let i = 0; i < 21; i++) made.push((await t.json('POST', '/api/tasklists', { title: `W${i}`, date: TODAY, items: [], recurrence: 'weekly' })).body);
    const first = await changes();
    for (const l of made) {
      const inst = first.taskLists.upserts.find((x: any) => x.title === l.title);
      await t.json('POST', `/api/tasklists/${inst.id}/items`, { title: 'x' });
    }
    const spy = vi.spyOn(t.app.ctx.mock!, 'listInstances');
    const r = await changes(first.cursor);
    expect(spy).not.toHaveBeenCalled();
    expect(r.taskLists.replace).toBe(true);
  });

  it('answers the other calendars when one cannot be read, and keeps that calendar\'s place in the cursor', async () => {
    await t.json('POST', '/api/__test/remote/events', { summary: 'Work 1', calendarId: 'work', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } });
    const c0 = (await changes()).cursor;
    await t.json('POST', '/api/__test/remote/events', { summary: 'Work 2', calendarId: 'work', start: { date: '2026-10-21' }, end: { date: '2026-10-22' } });
    await ev('Home 2');
    const real = t.app.ctx.mock!.listChanges.bind(t.app.ctx.mock!);
    const spy = vi.spyOn(t.app.ctx.mock!, 'listChanges').mockImplementation(async (id, tok) => {
      if (id === 'work') throw new ProviderError('boom');
      return real(id, tok);
    });
    const r = await t.json('GET', url(c0));
    expect(r.status).toBe(200);
    expect(r.body.events.failed).toEqual(['work']);
    expect(titles(r.body.events.upserts)).toEqual(['Home 2']);
    expect(r.body.events.replace).toEqual([]);
    spy.mockRestore();
    // the failed calendar is still where it was: its change arrives next time
    expect(titles((await changes(r.body.cursor)).events.upserts)).toEqual(['Work 2']);
  });

  it('tells the device to drop the instances of a series that became a plain event', async () => {
    const m = (await t.json('POST', '/api/__test/remote/events', { summary: 'Weekly', start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, recurrence: ['RRULE:FREQ=WEEKLY'] })).body;
    const first = await changes();
    expect(first.events.upserts.filter((e: any) => e.title === 'Weekly').length).toBeGreaterThan(50);
    await t.json('PATCH', `/api/__test/remote/events/${m.id}`, { recurrence: null });
    const r = await changes(first.cursor);
    expect(r.events.series).toEqual([{ calendarId: 'primary', seriesId: m.id }]);
    expect(r.events.upserts.map((e: any) => e.id)).toEqual([m.id]);
  });
});
