import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_PERSON } from '../src/services/prefsStore.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const when = { start: { dateTime: '2026-10-14T07:00:00+02:00' }, end: { dateTime: '2026-10-14T08:00:00+02:00' } };
const popup = (...m: number[]) => m.map((minutes) => ({ method: 'popup', minutes }));
const overridesFile = () => path.join(t.dir, 'users', LOCAL_PERSON, 'reminder-overrides.json');
const readFile = () => JSON.parse(fs.readFileSync(overridesFile(), 'utf8'));

/** A read-only event "Yoga" (reader calendar of anna@example.org) with the own reminders 30. */
async function yoga(role: 'reader' | 'freeBusyReader' = 'reader') {
  const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: role, ownerEmail: 'anna@example.org' })).body;
  const ev = (await t.json('POST', '/api/__test/remote/events', { summary: 'Yoga', calendarId: cal.id, ...when, reminders: { useDefault: false, overrides: popup(30) } })).body;
  return { cal, id: ev.id as string };
}
const google = async (id: string) => (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: any) => e.id === id);

describe('reminders of a read-only event', () => {
  it('is kept by the app without asking Google, shown on every read, and Google stays unchanged', async () => {
    const { id } = await yoga();
    const before = await google(id);
    const patch = vi.spyOn(t.app.ctx.provider, 'patchEvent');
    const r = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [30, 15] } });
    expect(r.body.reminders).toEqual({ useDefault: false, minutes: [30, 15] });
    expect(patch).not.toHaveBeenCalled();
    patch.mockRestore();
    expect(await google(id)).toEqual(before);
    expect((await t.json('GET', `/api/events/${id}`)).body.reminders.minutes).toEqual([30, 15]);
    const items = (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items;
    expect(items.find((i: any) => i.id === id).reminders).toEqual({ useDefault: false, minutes: [30, 15] });
    expect(readFile()).toEqual({ events: { 'anna@example.org': { [id]: { useDefault: false, minutes: [30, 15] } } } });
  });

  it('can go back to the calendar default and to none', async () => {
    const { id } = await yoga('freeBusyReader');
    const d = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: true, minutes: [] } });
    expect(d.body.reminders.useDefault).toBe(true);
    const n = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [] } });
    expect(n.body.reminders).toEqual({ useDefault: false, minutes: [] });
  });

  it('migrates a file of the old format: the per-event copies stay, the path memory and kept defaults go', async () => {
    const { id } = await yoga();
    await t.req('PUT', '/api/__test/remote/calendars/anna%40example.org/default-reminders', { defaultReminders: popup(30) });
    fs.mkdirSync(path.dirname(overridesFile()), { recursive: true });
    fs.writeFileSync(overridesFile(), JSON.stringify({
      paths: { 'anna@example.org': 'local' }, localSince: { 'anna@example.org': 1 },
      events: { 'anna@example.org': { [id]: { useDefault: false, minutes: [10] } } },
      defaults: { 'anna@example.org': { minutes: [5], since: 1 } },
    }));
    const cal = (await t.json('GET', '/api/calendars')).body.calendars.find((k: any) => k.id === 'anna@example.org');
    expect(cal.defaultReminders).toEqual([30]); // Google's list, not the old kept [5]
    expect((await t.json('GET', `/api/events/${id}`)).body.reminders.minutes).toEqual([10]);
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [20] } });
    expect(readFile()).toEqual({ events: { 'anna@example.org': { [id]: { useDefault: false, minutes: [20] } } } });
  });

  it('changes one instance of a repeating event only', async () => {
    const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: 'reader', ownerEmail: 'anna@example.org' })).body;
    await t.json('POST', '/api/__test/remote/events', { summary: 'Daily', calendarId: cal.id, ...when, recurrence: ['RRULE:FREQ=DAILY'] });
    const list = async () => (await t.json('GET', '/api/items?from=2026-10-13&to=2026-10-16')).body.items as Array<{ id: string; reminders: { minutes: number[] } }>;
    const [first, second] = await list();
    await t.json('PATCH', `/api/events/${first!.id}`, { reminders: { useDefault: false, minutes: [10] } });
    const after = await list();
    expect(after.find((i) => i.id === first!.id)!.reminders.minutes).toEqual([10]);
    expect(after.find((i) => i.id === second!.id)!.reminders.minutes).toEqual([]);
  });

  it('leaves everything else look-only: any other field is 403, reminders alongside it too', async () => {
    const { id } = await yoga();
    expect((await t.json('PATCH', `/api/events/${id}`, { title: 'X' })).status).toBe(403);
    expect((await t.json('PATCH', `/api/events/${id}`, { title: 'X', reminders: { useDefault: true, minutes: [] } })).status).toBe(403);
    expect((await t.json('DELETE', `/api/events/${id}`)).status).toBe(403);
    expect((await google(id)).summary).toBe('Yoga');
  });

  it('works for an invitation in an own calendar (Google accepts there)', async () => {
    const e = (await t.json('POST', '/api/__test/remote/events', { summary: 'Lunch', ...when, organizer: { email: 'anna@example.org' } })).body;
    const r = await t.json('PATCH', `/api/events/${e.id}`, { reminders: { useDefault: false, minutes: [10] } });
    expect(r.status).toBe(200);
    expect((await google(e.id)).reminders.overrides).toEqual(popup(10));
  });

  it('passes an outage on and stores nothing', async () => {
    const { id } = await yoga();
    await t.req('POST', '/api/__test/outage', { down: true });
    const r = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [10] } });
    await t.req('POST', '/api/__test/outage', { down: false });
    expect(r.status).toBe(503);
    expect(fs.existsSync(overridesFile())).toBe(false);
  });

  it('still refuses more than five reminders', async () => {
    const { id } = await yoga();
    expect((await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [1, 2, 3, 4, 5, 6] } })).status).toBe(400);
  });

  it('is part of the Drive backup of the person (a file under users/<sub>/)', async () => {
    const { id } = await yoga();
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [10] } });
    const files = t.app.ctx.backup.collect(LOCAL_PERSON);
    expect(JSON.stringify(files)).toContain('reminder-overrides.json');
  });
});

describe('default reminders of a read-only calendar', () => {
  /** Anna's reader calendar with the Google defaults popup 30 and email 60, plus the event "Standup" on the default. */
  async function anna() {
    await yoga();
    await t.req('PUT', '/api/__test/remote/calendars/anna%40example.org/default-reminders', { defaultReminders: [...popup(30), { method: 'email', minutes: 60 }] });
    const ev = (await t.json('POST', '/api/__test/remote/events', { summary: 'Standup', calendarId: 'anna@example.org', ...when })).body;
    return ev.id as string;
  }
  const googleDefaults = async () => (await t.json('GET', '/api/__test/remote/calendars')).body.calendars.find((k: any) => k.id === 'anna@example.org').defaultReminders;
  const apiDefaults = async () => (await t.json('GET', '/api/calendars')).body.calendars.find((k: any) => k.id === 'anna@example.org').defaultReminders;
  const setDefaults = (minutes: unknown) => t.json('PATCH', '/api/calendars/anna%40example.org', { defaultReminders: minutes });

  it('go to Google like a writable calendar, email defaults kept, nothing kept by the app', async () => {
    await anna();
    const r = await setDefaults([30, 15]);
    expect(r.status).toBe(200);
    expect(r.body.defaultReminders).toEqual([30, 15]);
    expect(await googleDefaults()).toEqual([{ method: 'email', minutes: 60 }, ...popup(30, 15)]);
    expect(fs.existsSync(overridesFile()) ? readFile().defaults ?? {} : {}).toEqual({});
  });

  it('do not override an event\'s own reminders (Google\'s or kept by the app)', async () => {
    await anna();
    const id = (await t.json('GET', '/api/__test/remote/events?q=Yoga')).body.items[0].id as string;
    await setDefaults([15]);
    const items = (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items;
    expect(items.find((i: any) => i.id === id).reminders).toEqual({ useDefault: false, minutes: [30] });
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [5] } });
    expect((await t.json('GET', `/api/events/${id}`)).body.reminders).toEqual({ useDefault: false, minutes: [5] });
  });

  it('an event the app keeps on the default follows the calendar\'s defaults in Google', async () => {
    const id = await anna();
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: true, minutes: [] } });
    await setDefaults([20]);
    expect((await t.json('GET', `/api/events/${id}`)).body.reminders).toEqual({ useDefault: true, minutes: [20] });
    expect((await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items.find((i: any) => i.id === id).reminders).toEqual({ useDefault: true, minutes: [20] });
  });

  it('pass an outage on and store nothing; limits stay', async () => {
    await anna();
    await t.req('POST', '/api/__test/outage', { down: true });
    const r = await setDefaults([10]);
    await t.req('POST', '/api/__test/outage', { down: false });
    expect(r.status).toBe(503);
    expect(fs.existsSync(overridesFile())).toBe(false);
    // email 60 + 5 popups = 6 > 5 in Google's list
    expect((await setDefaults([1, 2, 3, 4, 5])).status).toBe(400);
    expect((await setDefaults([1, 1])).status).toBe(400);
  });
});
