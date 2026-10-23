import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const timed = { title: 'Concert', allDay: false, start: '2026-10-14T19:00:00+02:00', end: '2026-10-14T22:00:00+02:00' };
const popup = (...m: number[]) => m.map((minutes) => ({ method: 'popup', minutes }));
const setDefaults = (id: string, defaultReminders: unknown[]) => t.req('PUT', `/api/__test/remote/calendars/${id}/default-reminders`, { defaultReminders });
const remote = async (title: string) => (await t.json('GET', `/api/__test/remote/events?q=${encodeURIComponent(title)}`)).body.items[0];

describe('event reminders', () => {
  it('an event without reminders uses the calendar default and shows its popup minutes', async () => {
    await setDefaults('primary', [...popup(30, 10), { method: 'email', minutes: 60 }]);
    const c = await t.json('POST', '/api/events', timed);
    expect(c.body.reminders).toEqual({ useDefault: true, minutes: [30, 10] });
    expect((await t.json('GET', '/api/calendars')).body.calendars.find((k: any) => k.id === 'primary').defaultReminders).toEqual([30, 10]);
  });

  it('reads the own reminders an event has in Google, in order', async () => {
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { reminders: { useDefault: false, overrides: [...popup(90, 30, 15), { method: 'email', minutes: 60 }] } });
    expect((await t.json('GET', `/api/events/${c.body.id}`)).body.reminders).toEqual({ useDefault: false, minutes: [90, 30, 15] });
  });

  it('writes own reminders to Google as popup overrides', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, reminders: { useDefault: false, minutes: [90, 30] } });
    expect(c.body.reminders).toEqual({ useDefault: false, minutes: [90, 30] });
    expect((await remote('Concert')).reminders).toEqual({ useDefault: false, overrides: popup(90, 30) });
  });

  it('keeps email reminders on update and returns to the default', async () => {
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { reminders: { useDefault: false, overrides: [...popup(10), { method: 'email', minutes: 60 }] } });
    const p = await t.json('PATCH', `/api/events/${c.body.id}`, { reminders: { useDefault: false, minutes: [] } });
    expect(p.body.reminders).toEqual({ useDefault: false, minutes: [] });
    expect((await remote('Concert')).reminders).toEqual({ useDefault: false, overrides: [{ method: 'email', minutes: 60 }] });
    const d = await t.json('PATCH', `/api/events/${c.body.id}`, { reminders: { useDefault: true, minutes: [] } });
    expect(d.body.reminders.useDefault).toBe(true);
    expect((await remote('Concert')).reminders).toEqual({ useDefault: true });
  });

  it('leaves the reminders alone when an update does not mention them', async () => {
    const c = await t.json('POST', '/api/events', { ...timed, reminders: { useDefault: false, minutes: [15] } });
    await t.json('PATCH', `/api/events/${c.body.id}`, { title: 'Gig' });
    expect((await remote('Gig')).reminders).toEqual({ useDefault: false, overrides: popup(15) });
  });

  it('refuses more than five reminders, duplicates and out-of-range leads', async () => {
    for (const minutes of [[1, 2, 3, 4, 5, 6], [5, 5], [-1], [40_321], [1.5]]) {
      expect((await t.json('POST', '/api/events', { ...timed, reminders: { useDefault: false, minutes } })).status).toBe(400);
    }
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', `/api/__test/remote/events/${c.body.id}`, { reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1 }, { method: 'email', minutes: 2 }] } });
    // 2 email + 4 popup = 6 > 5 in Google
    expect((await t.json('PATCH', `/api/events/${c.body.id}`, { reminders: { useDefault: false, minutes: [1, 2, 3, 4] } })).status).toBe(400);
  });
});

describe('calendar default reminders', () => {
  it('changes the popup defaults and keeps email ones', async () => {
    await setDefaults('primary', [...popup(30), { method: 'email', minutes: 60 }]);
    const p = await t.json('PATCH', '/api/calendars/primary', { defaultReminders: [30, 15] });
    expect(p.status).toBe(200);
    expect(p.body.defaultReminders).toEqual([30, 15]);
    const cal = (await t.json('GET', '/api/__test/remote/calendars')).body.calendars.find((k: any) => k.id === 'primary');
    expect(cal.defaultReminders).toEqual([{ method: 'email', minutes: 60 }, ...popup(30, 15)]);
  });

  it('takes a read-only calendar (feature reminders: kept by the app when Google refuses) and refuses an unknown one', async () => {
    await t.json('POST', '/api/__test/calendars', { owner: 'a@b.c', calendars: [] });
    await t.json('POST', '/api/__test/remote/calendars', { summary: 'Holidays', id: 'ro@x', readOnly: true });
    expect((await t.json('PATCH', '/api/calendars/ro@x', { defaultReminders: [10] })).body.defaultReminders).toEqual([10]);
    expect((await t.json('PATCH', '/api/calendars/nope', { defaultReminders: [10] })).status).toBe(404);
    expect((await t.json('PATCH', '/api/calendars/primary', { defaultReminders: [1, 2, 3, 4, 5, 6] })).status).toBe(400);
    expect((await t.json('PATCH', '/api/calendars/primary', {})).status).toBe(400);
  });

  it('an event on the changed default follows it', async () => {
    const c = await t.json('POST', '/api/events', timed);
    await t.json('PATCH', '/api/calendars/primary', { defaultReminders: [20] });
    const r = await t.json('GET', '/api/items?from=2026-10-14&to=2026-10-15');
    expect(r.body.items.find((i: any) => i.id === c.body.id).reminders).toEqual({ useDefault: true, minutes: [20] });
  });
});

describe('task list reminders', () => {
  it('has its own list in Google and follows the tasks calendar default otherwise', async () => {
    const l = await t.json('POST', '/api/tasklists', { title: 'Taxes', date: '2026-10-14', time: '11:00' });
    expect(l.body.reminders).toEqual({ useDefault: true, minutes: [] });
    expect((await t.json('PATCH', '/api/reminders/tasks-calendar', { defaultReminders: [10] })).body).toEqual({ defaultReminders: [10] });
    expect((await t.json('GET', '/api/reminders/tasks-calendar')).body).toEqual({ defaultReminders: [10] });
    expect((await t.json('GET', `/api/tasklists/${l.body.id}`)).body.reminders).toEqual({ useDefault: true, minutes: [10] });
    const u = await t.json('PATCH', `/api/tasklists/${l.body.id}`, { reminders: { useDefault: false, minutes: [30] } });
    expect(u.body.reminders).toEqual({ useDefault: false, minutes: [30] });
    expect((await remote('Taxes')).reminders).toEqual({ useDefault: false, overrides: popup(30) });
  });

  it('creates a list with reminders and keeps them across an item change', async () => {
    const l = await t.json('POST', '/api/tasklists', { title: 'Taxes', date: '2026-10-14', time: '11:00', reminders: { useDefault: false, minutes: [30, 5] } });
    expect(l.body.reminders).toEqual({ useDefault: false, minutes: [30, 5] });
    const a = await t.json('POST', `/api/tasklists/${l.body.id}/items`, { title: 'Forms' });
    expect(a.body.reminders).toEqual({ useDefault: false, minutes: [30, 5] });
  });
});
