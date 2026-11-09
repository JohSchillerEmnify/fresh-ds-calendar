import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { birthdayCreateBody, birthdayDateLocked, birthdayPatch, birthdayRule } from '../src/services/birthday.js';
import type { GoogleEvent } from '../src/providers/CalendarProvider.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

const master = (o: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'b1', calendarId: 'primary', etag: '"1"', status: 'confirmed', start: { date: '2026-10-15' }, end: { date: '2026-10-16' },
  created: '', updated: '', eventType: 'birthday', birthdayProperties: { type: 'birthday' }, ...o,
});

describe('birthday create body', () => {
  it('is exactly what Google accepts', () => {
    expect(birthdayCreateBody('Lena', '2026-10-15', '4')).toEqual({
      eventType: 'birthday', summary: 'Lena', start: { date: '2026-10-15' }, end: { date: '2026-10-16' }, recurrence: ['RRULE:FREQ=YEARLY'],
      visibility: 'private', transparency: 'transparent', birthdayProperties: { type: 'birthday' }, colorId: '4',
    });
  });

  it('sends no colorId without a colour', () => {
    expect(birthdayCreateBody('Lena', '2026-10-15', null)).not.toHaveProperty('colorId');
  });

  it('repeats 29 February on the last day of February', () => {
    expect(birthdayRule('2028-02-29')).toBe('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1');
    expect(birthdayCreateBody('Leap', '2028-02-29').recurrence).toEqual(['RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1']);
    expect(birthdayRule('2028-02-28')).toBe('RRULE:FREQ=YEARLY');
  });

  it('refuses a date that does not exist', () => {
    expect(() => birthdayCreateBody('X', '2027-02-29')).toThrow();
  });
});

describe('birthday patch', () => {
  it('lets only name, colour and a one-day date through', () => {
    expect(birthdayPatch(master(), '2026-10-15', { title: 'Lena M.', colorId: '2', start: '2026-10-16', end: '2026-10-17', allDay: true }))
      .toEqual({ summary: 'Lena M.', colorId: '2', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } });
  });

  it('is empty when nothing changes, also for the day shown', () => {
    expect(birthdayPatch(master(), '2026-10-15', { start: '2026-10-15', end: '2026-10-16' })).toEqual({});
  });

  it('keeps the start year of the series and changes only month and day', () => {
    const m = master({ start: { date: '1990-10-15' }, end: { date: '1990-10-16' } });
    expect(birthdayPatch(m, '2027-10-15', { start: '2027-10-16', end: '2027-10-17' })).toEqual({ start: { date: '1990-10-16' }, end: { date: '1990-10-17' } });
    // a new year alone is no change
    expect(birthdayPatch(m, '2027-10-15', { start: '2030-10-15', end: '2030-10-16' })).toEqual({});
  });

  it('refuses a move onto or off 29 February', () => {
    expect(() => birthdayPatch(master({ start: { date: '1990-10-15' } }), '2027-10-15', { start: '2028-02-29', end: '2028-03-01' })).toThrow(/29 February/);
    const leap = master({ start: { date: '1992-02-29' }, end: { date: '1992-03-01' }, recurrence: ['RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'] });
    expect(() => birthdayPatch(leap, '2027-02-28', { start: '2027-03-01', end: '2027-03-02' })).toThrow(/29 February/);
    expect(birthdayPatch(leap, '2027-02-28', { title: 'Leap L.' })).toEqual({ summary: 'Leap L.' });
  });

  it('refuses the other fields instead of dropping them', () => {
    for (const input of [{ description: 'x' }, { location: 'x' }, { reminders: { useDefault: true, minutes: [] } }, { calendarId: 'work' }, { allDay: false }]) {
      expect(() => birthdayPatch(master(), '2026-10-15', input)).toThrow();
    }
  });

  it('refuses a date that is more than one day', () => {
    expect(() => birthdayPatch(master(), '2026-10-15', { start: '2026-10-16', end: '2026-10-18' })).toThrow();
  });

  it('locks the date of a birthday from a contact and of the own one, not the name', () => {
    for (const bp of [{ type: 'birthday', contact: 'people/c1' }, { type: 'self' }]) {
      const m = master({ birthdayProperties: bp });
      expect(birthdayDateLocked(m)).toBe(true);
      expect(() => birthdayPatch(m, '2026-10-15', { start: '2026-10-16', end: '2026-10-17' })).toThrow(/Contacts/);
      expect(birthdayPatch(m, '2026-10-15', { title: 'Anna K.' })).toEqual({ summary: 'Anna K.' });
    }
  });
});

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const remote = async (q: string) => (await t.json('GET', `/api/__test/remote/events?q=${encodeURIComponent(q)}`)).body.items as GoogleEvent[];
const items = async (from: string, to: string) => (await t.json('GET', `/api/items?from=${from}&to=${to}`)).body.items as any[];
const seed = async (o: object = {}) => (await t.json('POST', '/api/__test/remote/events', {
  calendarId: 'primary', summary: 'Lena', start: { date: '2026-10-15' }, end: { date: '2026-10-16' }, eventType: 'birthday', recurrence: ['RRULE:FREQ=YEARLY'],
  birthdayProperties: { type: 'birthday' }, visibility: 'private', transparency: 'transparent', ...o,
})).body as GoogleEvent;

describe('birthdays like Google Calendar (API)', () => {
  it('creates a yearly birthday in the primary calendar and shows it again next year', async () => {
    const c = await t.json('POST', '/api/events', { kind: 'birthday', title: 'Lena', date: '2026-10-15', colorId: '4' });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ title: 'Lena', special: 'birthday', allDay: true, start: '2026-10-15', end: '2026-10-16', colorId: '4', calendarId: 'birthdays' });
    expect(c.body).not.toHaveProperty('readOnly');
    expect(await remote('Lena')).toMatchObject([{ eventType: 'birthday', recurrence: ['RRULE:FREQ=YEARLY'], visibility: 'private', transparency: 'transparent' }]);
    expect((await items('2027-10-01', '2027-11-01')).find((i) => i.title === 'Lena')).toMatchObject({ start: '2027-10-15', special: 'birthday' });
  });

  it('repeats a 29 February birthday on the last day of February', async () => {
    await t.json('POST', '/api/events', { kind: 'birthday', title: 'Leap', date: '2028-02-29' });
    expect((await remote('Leap'))[0]!.recurrence).toEqual(['RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1']);
    expect((await items('2029-02-01', '2029-03-01')).find((i) => i.title === 'Leap')).toMatchObject({ start: '2029-02-28' });
  });

  it('validates the birthday body', async () => {
    expect((await t.json('POST', '/api/events', { kind: 'birthday', title: '', date: '2026-10-15' })).status).toBe(400);
    expect((await t.json('POST', '/api/events', { kind: 'birthday', title: 'X', date: '2026-10-15', location: 'Home' })).status).toBe(400);
    expect((await t.json('POST', '/api/events', { kind: 'birthday', title: 'X', date: '2027-02-30' })).status).toBe(400);
  });

  it('renames and moves the whole series from an instance of a later year', async () => {
    const m = await seed();
    const instance = (await items('2027-10-01', '2027-11-01')).find((i) => i.title === 'Lena');
    expect(instance.id).not.toBe(m.id);
    const p = await t.json('PATCH', `/api/events/${instance.id}`, { title: 'Lena M.', start: '2027-10-16', end: '2027-10-17', allDay: true }, { 'If-Match': instance.etag });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ id: instance.id, title: 'Lena M.', special: 'birthday' });
    const [g] = await remote('Lena M.');
    expect(g).toMatchObject({ id: m.id, start: { date: '2026-10-16' }, end: { date: '2026-10-17' }, recurrence: ['RRULE:FREQ=YEARLY'] });
    expect((await remote('Lena')).length).toBe(0);
  });

  it('moves a series from a later instance without losing its start year', async () => {
    const m = await seed({ start: { date: '1990-10-15' }, end: { date: '1990-10-16' } });
    const instance = (await items('2027-10-01', '2027-11-01')).find((i) => i.title === 'Lena');
    const p = await t.json('PATCH', `/api/events/${instance.id}`, { start: '2027-10-16', end: '2027-10-17', allDay: true });
    expect(p.body).toMatchObject({ id: instance.id, start: '2027-10-16' });
    expect((await remote('Lena'))[0]).toMatchObject({ id: m.id, start: { date: '1990-10-16' }, end: { date: '1990-10-17' } });
    const moved = (await items('2027-10-01', '2027-11-01')).find((i) => i.title === 'Lena');
    const leap = await t.json('PATCH', `/api/events/${moved.id}`, { start: '2028-02-29', end: '2028-03-01', allDay: true });
    expect(leap.status).toBe(400);
    expect(leap.body.error.key).toBe('calendar.birthday.leapDay');
  });

  it('changes only the colour', async () => {
    const m = await seed();
    const p = await t.json('PATCH', `/api/events/${m.id}`, { colorId: '11' });
    expect(p.body).toMatchObject({ colorId: '11', color: '#d50000' });
    expect((await t.json('PATCH', `/api/events/${m.id}`, { colorId: null })).body.colorId).toBeNull();
  });

  it('keeps the date of a birthday from a contact but renames it', async () => {
    const m = await seed({ summary: 'Anna', birthdayProperties: { type: 'birthday', contact: 'people/c1' } });
    expect((await items('2026-10-01', '2026-11-01')).find((i) => i.title === 'Anna')).toMatchObject({ dateLocked: true });
    const moved = await t.json('PATCH', `/api/events/${m.id}`, { start: '2026-10-16', end: '2026-10-17', allDay: true });
    expect(moved.status).toBe(400);
    expect(moved.body.error.key).toBe('calendar.birthday.dateLocked');
    expect((await t.json('PATCH', `/api/events/${m.id}`, { title: 'Anna K.' })).status).toBe(200);
    expect((await remote('Anna K.'))[0]!.start).toEqual({ date: '2026-10-15' });
  });

  it('refuses fields a birthday does not have', async () => {
    const m = await seed();
    expect((await t.json('PATCH', `/api/events/${m.id}`, { description: 'x' })).status).toBe(400);
  });

  it('deletes the whole series from one instance', async () => {
    const m = await seed();
    const instance = (await items('2027-10-01', '2027-11-01')).find((i) => i.title === 'Lena');
    expect((await t.json('DELETE', `/api/events/${instance.id}`)).status).toBe(204);
    expect((await remote('Lena')).length).toBe(0);
    expect((await items('2026-10-01', '2026-11-01')).some((i) => i.id === m.id)).toBe(false);
  });

  it('stays read-only in a calendar the person cannot write', async () => {
    const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Family', readOnly: true })).body;
    const m = await seed({ calendarId: cal.id });
    expect((await items('2026-10-01', '2026-11-01')).find((i) => i.title === 'Lena')).toMatchObject({ special: 'birthday', readOnly: true });
    expect((await t.json('PATCH', `/api/events/${m.id}`, { title: 'X' })).status).toBe(400);
    expect((await t.json('DELETE', `/api/events/${m.id}`)).status).toBe(400);
  });
});

describe('the mock Google enforces the birthday rules', () => {
  const mock = () => new MockGoogleProvider({ dataDir: null, tz: 'Europe/Berlin', clock: { real: () => Date.parse('2026-10-14T10:00:00Z'), nowMs: () => Date.parse('2026-10-14T10:00:00Z') } as never });
  const body = (o: object = {}) => ({ ...birthdayCreateBody('Lena', '2026-10-15'), ...o });

  it('accepts the exact create body and rejects every deviation', async () => {
    const m = mock();
    await m.insertEvent('primary', body());
    for (const o of [
      { description: 'x' }, { location: 'x' }, { extendedProperties: { private: { a: 'b' } } }, { birthdayProperties: { type: 'birthday', contact: 'people/c1' } },
      { recurrence: ['RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'] }, { visibility: 'default' }, { transparency: 'opaque' }, { end: { date: '2026-10-17' } },
      { start: { dateTime: '2026-10-15T10:00:00+02:00' } },
    ]) await expect(m.insertEvent('primary', body(o)), JSON.stringify(o)).rejects.toThrow(/invalid birthday/);
    await expect(m.insertEvent('primary', { ...birthdayCreateBody('Leap', '2028-02-29'), recurrence: ['RRULE:FREQ=YEARLY'] })).rejects.toThrow(/invalid birthday/);
  });

  it('rejects other patch fields, a date change of a contact birthday, and a move', async () => {
    const m = mock();
    const own = await m.insertEvent('primary', body());
    await expect(m.patchEvent('primary', own.id, { description: 'x' })).rejects.toThrow(/cannot be changed/);
    await expect(m.patchEvent('primary', own.id, { recurrence: ['RRULE:FREQ=YEARLY'] })).rejects.toThrow(/cannot be changed/);
    await expect(m.moveEvent('primary', own.id, 'work')).rejects.toThrow(/cannot be moved/);
    await m.patchEvent('primary', own.id, { summary: 'Lena M.', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } });
    const linked = m.remote.insert('primary', { ...body(), summary: 'Anna', birthdayProperties: { type: 'birthday', contact: 'people/c1' } });
    await expect(m.patchEvent('primary', linked.id, { start: { date: '2026-10-16' }, end: { date: '2026-10-17' } })).rejects.toThrow(/cannot change/);
    await m.patchEvent('primary', linked.id, { summary: 'Anna K.', colorId: '3' });
    const self = m.remote.insert('primary', { ...body(), summary: 'Me', birthdayProperties: { type: 'self' } });
    await expect(m.patchEvent('primary', self.id, { start: { date: '2026-10-16' }, end: { date: '2026-10-17' } })).rejects.toThrow(/cannot change/);
  });

  it('expands a yearly series, the 29 February rule on the last day of February', async () => {
    const m = mock();
    await m.insertEvent('primary', body());
    await m.insertEvent('primary', birthdayCreateBody('Leap', '2028-02-29'));
    const r = await m.listEvents({ calendarId: 'primary', timeMin: '2029-01-01T00:00:00+01:00', timeMax: '2031-01-01T00:00:00+01:00' });
    expect(r.items.filter((e) => e.summary === 'Lena').map((e) => e.start.date)).toEqual(['2029-10-15', '2030-10-15']);
    expect(r.items.filter((e) => e.summary === 'Leap').map((e) => e.start.date)).toEqual(['2029-02-28', '2030-02-28']);
  });
});
