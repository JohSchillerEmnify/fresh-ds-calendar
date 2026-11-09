import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GoogleEvent, ProviderCalendar } from '../src/providers/CalendarProvider.js';
import { hasWriteRole, readOnlyReason } from '../src/services/ownership.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

const cal = (o: Partial<ProviderCalendar> & { id: string }): ProviderCalendar => ({ summary: o.id, backgroundColor: '#039be5', primary: false, accessRole: 'owner', ...o });
const me = cal({ id: 'primary', primary: true, owner: 'jo@example.org' });
const ev = (o: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'e1', calendarId: 'primary', etag: '"1"', status: 'confirmed', start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, created: '', updated: '', ...o,
});

describe('editable calendar', () => {
  it('follows the Google role: owner or writer, whoever owns the calendar', () => {
    expect(hasWriteRole(me)).toBe(true);
    expect(hasWriteRole(cal({ id: 'anna@example.org', accessRole: 'writer', owner: 'anna@example.org' }))).toBe(true);
    expect(hasWriteRole(cal({ id: 'family@group.calendar.google.com', accessRole: 'writer' }))).toBe(true);
  });

  it('is not given by reader or freeBusyReader, nor by an unknown calendar', () => {
    expect(hasWriteRole(cal({ id: 'a@example.org', accessRole: 'reader' }))).toBe(false);
    expect(hasWriteRole(cal({ id: 'b@example.org', accessRole: 'freeBusyReader' }))).toBe(false);
    expect(hasWriteRole(undefined)).toBe(false);
  });
});

describe('read-only reason of an event', () => {
  const all = [me, cal({ id: 'work', owner: 'jo@example.org' }), cal({ id: 'anna@example.org', accessRole: 'writer', owner: 'anna@example.org', summary: 'Anna' })];

  it('has none for an event without organiser, or one organised by the person', () => {
    expect(readOnlyReason(ev(), all)).toBeNull();
    expect(readOnlyReason(ev({ calendarId: 'work', organizer: { email: 'jo@example.org', self: true } }), all)).toBeNull();
  });

  it('is an invitation when someone else organises it', () => {
    expect(readOnlyReason(ev({ organizer: { email: 'anna@example.org' } }), all)).toEqual({ kind: 'invitation', by: 'anna@example.org' });
  });

  it('has none when the organiser lets guests edit', () => {
    expect(readOnlyReason(ev({ organizer: { email: 'anna@example.org' }, guestsCanModify: true }), all)).toBeNull();
  });

  it('has none for an event someone else made in a shared group calendar the person may write', () => {
    const fam = cal({ id: 'family@group.calendar.google.com', accessRole: 'writer', owner: 'anna@example.org' });
    expect(readOnlyReason(ev({ calendarId: fam.id, organizer: { email: fam.id, self: false } }), [me, fam])).toBeNull();
    expect(readOnlyReason(ev({ calendarId: fam.id, organizer: { email: 'anna@example.org' } }), [me, fam])).toEqual({ kind: 'invitation', by: 'anna@example.org' });
  });

  it('has none in another person\'s primary calendar shared with write rights', () => {
    expect(readOnlyReason(ev({ calendarId: 'anna@example.org', organizer: { self: true } }), all)).toBeNull();
    expect(readOnlyReason(ev({ calendarId: 'anna@example.org', organizer: { email: 'anna@example.org' } }), all)).toBeNull();
  });

  it('is the calendar of its owner in a calendar shared read-only', () => {
    const ro = cal({ id: 'bob@example.org', accessRole: 'reader', owner: 'bob@example.org' });
    expect(readOnlyReason(ev({ calendarId: ro.id }), [me, ro])).toEqual({ kind: 'calendar', by: 'bob@example.org' });
    const holidays = cal({ id: 'h@group.v.calendar.google.com', accessRole: 'reader', summary: 'Holidays' });
    expect(readOnlyReason(ev({ calendarId: holidays.id }), [me, holidays])).toEqual({ kind: 'calendar', by: 'Holidays' });
  });
});

describe('only own events are editable (API)', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());
  beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

  const when = { start: { dateTime: '2026-10-14T12:00:00+02:00' }, end: { dateTime: '2026-10-14T13:00:00+02:00' } };
  const remote = async (body: object) => (await t.json('POST', '/api/__test/remote/events', { summary: 'Lunch', ...when, ...body })).body as GoogleEvent;
  const items = async () => (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items as Array<Record<string, any>>;

  it('refuses PATCH and DELETE of an invitation with 403 calendar.event.notOwn', async () => {
    const e = await remote({ organizer: { email: 'anna@example.org' } });
    expect(await items()).toEqual([expect.objectContaining({ title: 'Lunch', readOnly: true, readOnlyReason: { kind: 'invitation', by: 'anna@example.org' } })]);
    const p = await t.json('PATCH', `/api/events/${e.id}`, { title: 'X' });
    expect(p.status).toBe(403);
    expect(p.body.error.key ?? p.body.error.code).toBeTruthy();
    expect((await t.json('DELETE', `/api/events/${e.id}`)).status).toBe(403);
  });

  it('lets an invitation be edited when guests may modify it, and an own event always', async () => {
    const a = await remote({ organizer: { email: 'anna@example.org' }, guestsCanModify: true });
    const b = await remote({ summary: 'Mine', organizer: { email: 'jo@example.org', self: true } });
    expect((await t.json('PATCH', `/api/events/${a.id}`, { title: 'Potluck' })).status).toBe(200);
    expect((await t.json('PATCH', `/api/events/${b.id}`, { title: 'Dentist' })).status).toBe(200);
    expect((await items()).every((i) => !i.readOnly)).toBe(true);
  });

  it('lets another person\'s calendar shared with writer rights be edited and used for new events', async () => {
    const shared = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: 'writer', ownerEmail: 'anna@example.org' })).body;
    const e = await remote({ calendarId: shared.id, organizer: { email: 'anna@example.org' } });
    expect((await items()).find((i) => i.id === e.id)?.readOnly).toBeFalsy();
    expect((await t.json('PATCH', `/api/events/${e.id}`, { title: 'X' })).status).toBe(200);
    const create = await t.json('POST', '/api/events', { title: 'New', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', calendarId: shared.id });
    expect(create.status).toBe(201);
    const own = await t.json('POST', '/api/events', { title: 'Own', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00' });
    expect((await t.json('PATCH', `/api/events/${own.body.id}`, { calendarId: shared.id })).status).toBe(200);
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === shared.id)).toMatchObject({ writable: true });
  });

  it('keeps events of a calendar shared read-only look-only, and refuses to create or move into it', async () => {
    const shared = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: 'reader', ownerEmail: 'anna@example.org' })).body;
    const e = await remote({ calendarId: shared.id });
    expect((await items()).find((i) => i.id === e.id)).toMatchObject({ readOnly: true, readOnlyReason: { kind: 'calendar', by: 'anna@example.org' } });
    expect((await t.json('PATCH', `/api/events/${e.id}`, { title: 'X' })).status).toBe(403);
    expect((await t.json('DELETE', `/api/events/${e.id}`)).status).toBe(403);
    const create = await t.json('POST', '/api/events', { title: 'New', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', calendarId: shared.id });
    expect(create.status).toBe(403);
    const own = await t.json('POST', '/api/events', { title: 'Own', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00' });
    expect((await t.json('PATCH', `/api/events/${own.body.id}`, { calendarId: shared.id })).status).toBe(403);
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === shared.id)).toMatchObject({ writable: false });
  });

  it('lets a shared group calendar with write rights be used like an own one (family calendar)', async () => {
    const fam = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Family', id: 'family@group.calendar.google.com', accessRole: 'writer', ownerEmail: 'anna@example.org' })).body;
    const e = await remote({ calendarId: fam.id, organizer: { email: fam.id, self: false } });
    expect((await items()).find((i) => i.id === e.id)).toMatchObject({ calendarId: fam.id });
    expect((await items()).find((i) => i.id === e.id)?.readOnly).toBeFalsy();
    expect((await t.json('PATCH', `/api/events/${e.id}`, { title: 'X' })).status).toBe(200);
    const created = await t.json('POST', '/api/events', { title: 'New', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', calendarId: fam.id });
    expect(created.status).toBe(201);
    const made = (await items()).find((i) => i.id === created.body.id);
    expect(made?.readOnly).toBeFalsy();
    expect((await t.json('DELETE', `/api/events/${e.id}`)).status).toBeLessThan(300);
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === fam.id)).toMatchObject({ writable: true });
  });

  it('keeps the person\'s own secondary calendar editable', async () => {
    const own = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Hobby' })).body;
    expect(own.id).toMatch(/@group\.calendar\.google\.com$/);
    const e = await remote({ calendarId: own.id });
    expect((await t.json('PATCH', `/api/events/${e.id}`, { title: 'Chess' })).status).toBe(200);
    const created = await t.json('POST', '/api/events', { title: 'New', allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T10:00:00+02:00', calendarId: own.id });
    expect(created.status).toBe(201);
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === own.id)).toMatchObject({ writable: true });
  });
});
