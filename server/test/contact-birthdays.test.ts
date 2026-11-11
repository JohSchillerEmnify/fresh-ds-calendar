/** Birthdays from Google Contacts (feature contact-birthdays, ADR 0043, spec/API.md): People API mapping, sync tokens, dedupe, the change feed and per-person isolation. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dedupeBirthdays } from '@calendar/shared/birthdays';
import { mockSub } from '../src/auth/people.js';
import { fromPerson } from '../src/providers/google/person.js';
import { contactEvents } from '../src/services/contactBirthdays.js';
import { GoogleProvider } from '../src/providers/google/GoogleProvider.js';
import { SyncTokenExpiredError } from '../src/providers/CalendarProvider.js';
import { freeze, makeApp, sessionCookie, type TestApp } from './helpers.js';

let t: TestApp;
beforeEach(async () => { t = makeApp(); await freeze(t); });
afterEach(() => t.cleanup());

interface Row { id: string; title: string; start: string; special?: string; readOnly?: boolean; calendarId: string; readOnlyReason?: { kind: string }; contactBirthday?: { resourceName: string; birthYear?: number }; dupKey?: string }
const grant = (granted = true) => t.json('POST', '/api/__test/oauth/contacts-access', { granted });
const contact = (body: object) => t.json('POST', '/api/__test/remote/contacts', { name: 'Anna', ...body });
const items = async (from = '2026-10-01', to = '2026-11-01') => (await t.json('GET', `/api/items?from=${from}&to=${to}`)).body.items as Row[];
const titlesOn = (rows: Row[], day: string) => rows.filter((r) => r.start === day).map((r) => r.title).sort();
const changes = async (cursor?: string) => (await t.json('GET', `/api/changes?today=2026-10-12${cursor ? `&cursor=${cursor}` : ''}`)).body;
const dates = (m: number, d: number, y?: number) => ({ month: m, day: d, ...(y !== undefined ? { year: y } : {}) });

describe('the People API mapping', () => {
  it('reads year 0 as no year, takes the primary name and drops a date without month and day', () => {
    const c = fromPerson({
      resourceName: 'people/c1', names: [{ displayName: 'Other' }, { displayName: 'Max', metadata: { primary: true } }],
      birthdays: [{ text: 'sometime' }, { date: { month: 10, day: 15, year: 0 } }],
      events: [{ type: 'anniversary', date: { month: 10, day: 14, year: 2010 } }, { type: 'Moving day', date: { year: 2015 } }],
    });
    expect(c).toEqual({ resourceName: 'people/c1', name: 'Max', birthday: { month: 10, day: 15 }, dates: [{ type: 'anniversary', date: { month: 10, day: 14, year: 2010 } }] });
  });

  it('flags a deleted contact', () => {
    expect(fromPerson({ resourceName: 'people/c2', metadata: { deleted: true } })).toEqual({ resourceName: 'people/c2', deleted: true, dates: [] });
  });
});

describe('the events made from contacts', () => {
  const anna = { resourceName: 'people/c1', name: 'Anna', birthday: { year: 1990, month: 10, day: 14 }, dates: [] };

  it('repeat every year inside the window, once each, with the age only for a birthday with a year', () => {
    const e = contactEvents([anna, { resourceName: 'people/c2', name: 'Max', birthday: { month: 10, day: 15 }, dates: [] }], '2026-10-01', '2028-01-01', '#9fc6e7');
    expect(e.filter((x) => x.title === 'Anna').map((x) => x.start)).toEqual(['2026-10-14', '2027-10-14']);
    expect(e.find((x) => x.title === 'Anna')!.contactBirthday).toEqual({ resourceName: 'people/c1', birthYear: 1990 });
    expect(e.find((x) => x.title === 'Max')!.contactBirthday).toEqual({ resourceName: 'people/c2' });
    expect(e[0]).toMatchObject({ calendarId: 'birthdays', special: 'birthday', readOnly: true, readOnlyReason: { kind: 'contact' }, allDay: true, end: '2026-10-15', color: '#9fc6e7' });
  });

  it('puts 29 February on the last day of February in years without one', () => {
    const e = contactEvents([{ resourceName: 'people/c1', name: 'Leo', birthday: { year: 2000, month: 2, day: 29 }, dates: [] }], '2026-01-01', '2029-01-01', '#000000');
    expect(e.map((x) => x.start)).toEqual(['2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('titles an anniversary with the name and a ring, another date "<label>: <name>" without a marker, and skips a contact without a name', () => {
    const e = contactEvents([
      { resourceName: 'people/c1', name: 'Max and Eva', dates: [{ type: 'anniversary', date: { year: 2010, month: 10, day: 14 } }] },
      { resourceName: 'people/c2', name: 'Anna', dates: [{ type: 'Moving day', date: { month: 10, day: 15 } }, { date: { month: 10, day: 16 } }] },
      { resourceName: 'people/c3', birthday: { month: 10, day: 17 }, dates: [] },
    ], '2026-10-01', '2026-11-01', '#000000');
    expect(e.map((x) => [x.title, x.special, !!x.contactBirthday?.birthYear])).toEqual([['Max and Eva', 'anniversary', false], ['Moving day: Anna', undefined, false], ['Anna', undefined, false]]);
  });

  it('give two entries of one contact on one day two ids', () => {
    const e = contactEvents([{ resourceName: 'people/c1', name: 'Anna', birthday: { month: 10, day: 14 }, dates: [{ type: 'anniversary', date: { month: 10, day: 14 } }] }], '2026-10-01', '2026-11-01', '#000000');
    expect(new Set(e.map((x) => x.id)).size).toBe(2);
  });
});

describe('the Birthdays calendar with and without the permission', () => {
  it('shows a contact birthday once the permission is granted, read-only and in the calendar colour', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    const a = (await items()).find((i) => i.title === 'Anna')!;
    expect(a).toMatchObject({ start: '2026-10-14', special: 'birthday', calendarId: 'birthdays', readOnly: true, readOnlyReason: { kind: 'contact' } });
    const cal = (await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === 'birthdays');
    expect(cal.contactsPermission).toBe('granted');
  });

  it('shows none without it, says so, and nothing fails', async () => {
    await contact({ birthday: dates(10, 14, 1990) });
    expect(titlesOn(await items(), '2026-10-14')).toEqual([]);
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === 'birthdays').contactsPermission).toBe('missing');
    expect((await changes()).events.calendars).not.toContain('people');
  });

  it('keeps the other birthdays when Google Contacts answers an error, and shows the contact again once it recovers', async () => {
    await grant();
    await t.json('POST', '/api/__test/remote/events', { calendarId: 'primary', summary: 'Carl', start: { date: '2026-10-16' }, end: { date: '2026-10-17' }, eventType: 'birthday', recurrence: ['RRULE:FREQ=YEARLY'], birthdayProperties: { type: 'birthday' } });
    await contact({ birthday: dates(10, 14, 1990) });
    await t.json('POST', '/api/__test/remote/contacts-error', { status: 500 });
    const during = await items();
    expect(titlesOn(during, '2026-10-16')).toEqual(['Carl']);
    expect(titlesOn(during, '2026-10-14')).toEqual([]);
    await t.json('POST', '/api/__test/remote/contacts-error', { status: null });
    expect(titlesOn(await items(), '2026-10-14')).toEqual(['Anna']);
  });

  it('refuses to change or delete a contact date', async () => {
    await grant();
    const id = 'contact:people/c1:b:2026-10-14';
    expect((await t.json('PATCH', `/api/events/${encodeURIComponent(id)}`, { title: 'X' })).status).toBe(400);
    expect((await t.json('DELETE', `/api/events/${encodeURIComponent(id)}`)).status).toBe(400);
  });
});

describe('one birthday shows once', () => {
  const calendarBirthday = (summary: string, contactName?: string) => t.json('POST', '/api/__test/remote/events', {
    calendarId: 'primary', summary, start: { date: '2026-10-14' }, end: { date: '2026-10-15' }, eventType: 'birthday', recurrence: ['RRULE:FREQ=YEARLY'],
    birthdayProperties: { type: 'birthday', ...(contactName ? { contact: contactName } : {}) },
  });

  it('when the calendar birthday is linked to the contact, the calendar event wins', async () => {
    await grant();
    const rn = (await contact({ birthday: dates(10, 14, 1990) })).body.resourceName;
    await calendarBirthday('Anna M.', rn);
    expect(titlesOn(await items(), '2026-10-14')).toEqual(['Anna M.']);
  });

  it('when the title and day are the same, in any letter case', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    await calendarBirthday('ANNA');
    expect(titlesOn(await items(), '2026-10-14')).toEqual(['ANNA']);
  });

  it('not for two contacts with the same name on different days', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    await contact({ birthday: dates(10, 20, 1985) });
    const r = await items();
    expect([titlesOn(r, '2026-10-14'), titlesOn(r, '2026-10-20')]).toEqual([['Anna'], ['Anna']]);
  });

  it('the shared rule keeps the editable copy, then the calendar copy, then the contact copy', () => {
    const contactCopy = { id: 'a', dupKey: 'c:1|birthday|d', dupAlt: 't:anna|d', readOnly: true, readOnlyReason: { kind: 'contact' } };
    const calendarCopy = { id: 'b', dupKey: 't:anna|d', readOnly: true };
    const editable = { id: 'c', dupKey: 'c:1|birthday|d' };
    expect(dedupeBirthdays([contactCopy, calendarCopy])).toEqual([calendarCopy]);
    expect(dedupeBirthdays([contactCopy, editable, calendarCopy])).toEqual([editable]);
    expect(dedupeBirthdays([{ id: 'x' }, contactCopy])).toEqual([{ id: 'x' }, contactCopy]);
  });
});

describe('the change feed (ADR 0025)', () => {
  const peopleOf = (r: { events: { upserts: Row[] } }) => r.events.upserts.filter((u) => u.id.startsWith('contact:')).map((u) => u.title).sort();

  it('brings the contact dates under their own source, and only changes later', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    const first = await changes();
    expect(first.events.calendars).toContain('people');
    expect(first.events.replace).toContain('people');
    expect(peopleOf(first)).toEqual(['Anna', 'Anna']);
    const quiet = await changes(first.cursor);
    expect(quiet.events.replace).not.toContain('people');
    expect(quiet.events.upserts).toEqual([]);
    expect(quiet.events.calendars).toContain('people');
  });

  it('answers in full after a contact is removed, and drops the source when the permission goes', async () => {
    await grant();
    const rn = (await contact({ birthday: dates(10, 14, 1990) })).body.resourceName;
    await contact({ name: 'Max', birthday: dates(10, 15) });
    const first = await changes();
    await t.json('DELETE', `/api/__test/remote/contacts/${rn}`);
    const next = await changes(first.cursor);
    expect(next.events.replace).toContain('people');
    expect(peopleOf(next)).toEqual(['Max', 'Max']);
    await grant(false);
    expect((await changes(next.cursor)).events.calendars).not.toContain('people');
  });

  it('keeps what the device holds while Google Contacts cannot answer, with no failure of the others', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    const first = await changes();
    await t.json('POST', '/api/__test/remote/contacts-error', { status: 500 });
    const next = await changes(first.cursor);
    expect(next.events.calendars).toContain('people');
    expect(next.events).toMatchObject({ replace: [], upserts: [], failed: [] });
  });

  it('reads the contacts in full again when Google expires the sync token', async () => {
    await grant();
    await contact({ birthday: dates(10, 14, 1990) });
    await changes();
    t.app.ctx.mock!.contacts.expireTokens();
    await contact({ name: 'Max', birthday: dates(10, 15) });
    expect(titlesOn(await items(), '2026-10-15')).toEqual(['Max']);
  });
});

describe('per person', () => {
  it('keeps the contacts and the permission of one person from another', async () => {
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['anna@example.com', 'jo@example.com'] });
    await grant();
    await contact({ owner: 'anna@example.com', name: 'Lena', birthday: dates(10, 16, 1992) });
    const anna = await sessionCookie(t, 'anna@example.com');
    await grant(false);
    const jo = await sessionCookie(t, 'jo@example.com');
    const read = async (cookie: string) => (await t.json('GET', '/api/items?from=2026-10-01&to=2026-11-01', undefined, { cookie })).body.items as Row[];
    expect(titlesOn(await read(anna), '2026-10-16')).toEqual(['Lena']);
    expect(titlesOn(await read(jo), '2026-10-16')).toEqual([]);
    expect(mockSub('jo@example.com')).not.toBe(mockSub('anna@example.com'));
  });
});

describe('asking for the permission', () => {
  const start = (q: string) => t.req('GET', `/api/auth/google/start${q}`);

  it('is a plain sign-in without contacts=1, and returns to the Birthdays settings with to=settings', async () => {
    await t.json('POST', '/api/__test/auth', { allowedEmails: ['anna@example.com'] });
    await t.json('POST', '/api/__test/oauth/account', { email: 'anna@example.com' });
    await grant();
    const round = async (q: string) => {
      const s = await start(q);
      const cookie = s.headers.getSetCookie().map((c) => c.split(';')[0]!).join('; ');
      const consent = await t.req('GET', s.headers.get('location')!, undefined, { cookie });
      return (await t.req('GET', consent.headers.get('location')!, undefined, { cookie })).headers.get('location');
    };
    expect(await round('')).toBe('/');
    expect(await round('?contacts=1')).toBe('/');
    expect(await round('?contacts=1&to=settings')).toBe('/?settings=birthdays-contacts');
    expect(await round('?to=settings')).toBe('/');
  });
});

describe('the Google People client', () => {
  const fake = (pages: Array<{ data?: object; error?: object }>) => {
    const calls: Record<string, unknown>[] = [];
    const people = { people: { connections: { list: async (p: Record<string, unknown>) => {
      calls.push(p);
      const page = pages.shift()!;
      if (page.error) throw page.error;
      return { data: page.data };
    } } } };
    return { calls, provider: new GoogleProvider({ api: {} as never, people: people as never }) };
  };

  it('asks with the fields, the page size and the sync token, reads every page and keeps the new token', async () => {
    const { calls, provider } = fake([
      { data: { connections: [{ resourceName: 'people/c1', names: [{ displayName: 'Anna' }] }], nextPageToken: 'p2' } },
      { data: { connections: [{ resourceName: 'people/c2', metadata: { deleted: true } }], nextSyncToken: 'next' } },
    ]);
    const r = await provider.listContacts('old');
    expect(r.nextSyncToken).toBe('next');
    expect(r.items.map((i) => [i.resourceName, !!i.deleted])).toEqual([['people/c1', false], ['people/c2', true]]);
    expect(calls[0]).toMatchObject({ resourceName: 'people/me', personFields: 'names,birthdays,events', pageSize: 1000, requestSyncToken: true, syncToken: 'old' });
    expect(calls[1]).toMatchObject({ pageToken: 'p2', syncToken: 'old' });
  });

  it('turns the expired-token answer (400, EXPIRED_SYNC_TOKEN) into the sync-token error', async () => {
    const { provider } = fake([{ error: { response: { status: 400, data: { error: { status: 'FAILED_PRECONDITION', details: [{ reason: 'EXPIRED_SYNC_TOKEN' }] } } } } }]);
    await expect(provider.listContacts('old')).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });
});
