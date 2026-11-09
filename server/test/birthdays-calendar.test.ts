import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { forgetCalendarShape } from '../src/services/calendarShape.js';
import { setDiagSink } from '../src/lib/diag.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

/** The fields of an API item or calendar these tests read. */
interface Row { id: string; name: string; title: string; calendarId: string; color: string; start: string; special?: string; readOnly?: boolean; hidden?: boolean; primary?: boolean; isContactsCalendar?: boolean }
const CONTACTS = 'addressbook#contacts@group.v.calendar.google.com';
let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); forgetCalendarShape(); });

const seed = (o: object = {}) => t.json('POST', '/api/__test/remote/events', {
  calendarId: 'primary', summary: 'Lena', start: { date: '2026-10-15' }, end: { date: '2026-10-16' }, eventType: 'birthday', recurrence: ['RRULE:FREQ=YEARLY'],
  birthdayProperties: { type: 'birthday' }, ...o,
});
const calendars = async () => (await t.json('GET', '/api/calendars')).body.calendars as Row[];
const items = async (q = '') => (await t.json('GET', `/api/items?from=2026-10-01&to=2026-11-01${q}`)).body.items as Row[];
const contactsCalendar = (hidden: boolean) => t.json('POST', '/api/__test/remote/calendars', { summary: 'Birthdays', id: CONTACTS, color: '#9fc6e7', readOnly: true, hidden });

describe('the virtual Birthdays calendar', () => {
  it('is listed once with its own switch, and the old contacts calendar is not listed', async () => {
    await contactsCalendar(false);
    const list = await calendars();
    expect(list.filter((c) => c.name === 'Birthdays')).toEqual([expect.objectContaining({ id: 'birthdays', virtual: true, writable: false, hidden: false, defaultReminders: [] })]);
    expect(list.some((c) => c.id === CONTACTS)).toBe(false);
  });

  it('holds every birthday event under its own id, whichever calendar has it, and nothing else', async () => {
    await seed({ summary: 'Self', birthdayProperties: { type: 'self' } });
    await seed({ summary: 'Wedding', calendarId: 'work', birthdayProperties: { type: 'anniversary' } });
    await t.json('POST', '/api/events', { title: 'Holiday', allDay: true, start: '2026-10-15', end: '2026-10-16' });
    const all = await items();
    expect(all.filter((i) => i.special).map((i) => [i.title, i.calendarId, i.color])).toEqual(expect.arrayContaining([['Self', 'birthdays', '#9fc6e7'], ['Wedding', 'birthdays', '#9fc6e7']]));
    expect(all.find((i) => i.title === 'Holiday')!.calendarId).toBe('primary');
  });

  it('reads the old contacts calendar even when Google marks it hidden', async () => {
    await contactsCalendar(true);
    await t.json('POST', '/api/__test/remote/events', { calendarId: CONTACTS, summary: 'Carl', start: { date: '2026-10-16' }, end: { date: '2026-10-17' }, eventType: 'birthday', birthdayProperties: { type: 'birthday', contact: 'people/c9' } });
    expect((await items()).find((i) => i.title === 'Carl')).toMatchObject({ special: 'birthday', calendarId: 'birthdays', readOnly: true });
    expect((await calendars()).some((c) => c.id === CONTACTS)).toBe(false);
  });

  it('shows a birthday of both places once, the editable copy', async () => {
    await contactsCalendar(false);
    await t.json('POST', '/api/__test/remote/events', { calendarId: CONTACTS, summary: 'Anna', start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, eventType: 'birthday', birthdayProperties: { type: 'birthday', contact: 'people/c1' } });
    await seed({ summary: 'Anna K.', start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, birthdayProperties: { type: 'birthday', contact: 'people/c1' } });
    await seed({ summary: 'Twin', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } });
    await seed({ summary: 'Twin', calendarId: 'work', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } });
    const all = await items();
    expect(all.filter((i) => i.special && i.start === '2026-10-14').map((i) => i.title)).toEqual(['Anna K.']);
    expect(all.filter((i) => i.title === 'Twin')).toHaveLength(1);
  });

  it('keeps its own colour, per person, and a birthday colour of its own wins', async () => {
    await seed({ summary: 'Red', colorId: '11' });
    await seed({ summary: 'Plain', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } });
    expect((await t.json('PATCH', '/api/calendars/birthdays', { colorId: '8' })).body).toMatchObject({ id: 'birthdays', color: '#16a765' });
    expect((await t.json('PATCH', '/api/calendars/birthdays', { color: '#123456' })).body.color).toBe('#123456');
    expect((await calendars()).find((c) => c.id === 'birthdays')!.color).toBe('#123456');
    const all = await items();
    expect(all.find((i) => i.title === 'Plain')!.color).toBe('#123456');
    expect(all.find((i) => i.title === 'Red')!.color).toBe('#d50000');
    expect((await t.json('PATCH', '/api/calendars/birthdays', { colorId: '99' })).status).toBe(400);
    // nothing of it went to Google's list
    expect(((await t.json('GET', '/api/__test/remote/calendars')).body.calendars as Row[]).some((c) => c.id === 'birthdays')).toBe(false);
  });

  it('has no default reminders', async () => {
    expect((await t.json('PATCH', '/api/calendars/birthdays', { defaultReminders: [10] })).status).toBe(400);
  });

  it('is switched by the one hidden flag, which excludeHidden and the personal calendar do not mix up', async () => {
    await seed();
    await t.json('POST', '/api/events', { title: 'Holiday', allDay: true, start: '2026-10-15', end: '2026-10-16' });
    expect((await t.json('PATCH', '/api/calendars/birthdays', { hidden: true })).body.hidden).toBe(true);
    const titles = async () => (await items('&excludeHidden=1')).map((i) => i.title);
    expect(await titles()).toEqual(['Holiday']);
    await t.json('PATCH', '/api/calendars/birthdays', { hidden: false });
    await t.json('PATCH', '/api/calendars/primary', { hidden: true });
    expect(await titles()).toEqual(['Lena']);
  });

  it('is asked for by its id, and not by the id of the calendar that holds the birthday', async () => {
    await seed();
    expect((await items('&calendarIds=birthdays')).map((i) => i.title)).toEqual(['Lena']);
    expect((await items('&calendarIds=primary')).map((i) => i.title)).toEqual([]);
  });
});

describe('calendar_shape diagnostic', () => {
  it('logs one anonymised line per person and day, with counts only', async () => {
    const lines: Record<string, unknown>[] = [];
    const restore = setDiagSink((l) => lines.push(JSON.parse(l) as Record<string, unknown>));
    try {
      await contactsCalendar(true);
      await seed({ summary: 'SecretName' });
      await seed({ summary: 'Old', start: { date: '1604-10-15' }, end: { date: '1604-10-16' }, recurrence: undefined, birthdayProperties: { type: 'anniversary' } });
      await calendars();
      await new Promise((r) => setTimeout(r, 50));
      await calendars();
      await new Promise((r) => setTimeout(r, 50));
    } finally { restore(); }
    const shape = lines.filter((l) => l.event === 'calendar_shape');
    expect(shape).toHaveLength(1);
    expect(JSON.stringify(shape[0])).not.toMatch(/SecretName|addressbook|Personal|Work/);
    const cals = JSON.parse(shape[0]!.calendars as string) as Row[];
    const primary = cals.find((c) => c.primary);
    expect(primary).toMatchObject({ birthdays: 2, byType: { birthday: 1, anniversary: 1 }, before1900: 1, noRecurrence: 1, hidden: false, selected: true, isContactsCalendar: false });
    expect(cals.find((c) => c.isContactsCalendar)).toMatchObject({ hidden: true, birthdays: 0 });
  });
});
