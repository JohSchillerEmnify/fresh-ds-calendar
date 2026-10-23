import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderForbiddenError } from '../src/providers/CalendarProvider.js';
import { LOCAL_PERSON } from '../src/services/prefsStore.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); await freeze(t); });

const when = { start: { dateTime: '2026-10-14T07:00:00+02:00' }, end: { dateTime: '2026-10-14T08:00:00+02:00' } };
const popup = (...m: number[]) => m.map((minutes) => ({ method: 'popup', minutes }));
const allow = (v: boolean) => t.req('PUT', '/api/__test/remote/reader-reminders', { allow: v });
const overridesFile = () => path.join(t.dir, 'users', LOCAL_PERSON, 'reminder-overrides.json');
const readFile = () => JSON.parse(fs.readFileSync(overridesFile(), 'utf8'));

/** A read-only event "Yoga" (reader calendar of anna@example.org) with the own reminders 30. */
async function yoga(role: 'reader' | 'freeBusyReader' = 'reader') {
  const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Anna', id: 'anna@example.org', accessRole: role, ownerEmail: 'anna@example.org' })).body;
  const ev = (await t.json('POST', '/api/__test/remote/events', { summary: 'Yoga', calendarId: cal.id, ...when, reminders: { useDefault: false, overrides: popup(30) } })).body;
  return { cal, id: ev.id as string };
}
const google = async (id: string) => (await t.json('GET', '/api/__test/remote/events')).body.items.find((e: any) => e.id === id);

describe('mock provider reader policy', () => {
  it('refuses a reminders-only patch on a reader calendar by default, accepts it after allow, and accepts other writes', async () => {
    const { id } = await yoga();
    const p = t.app.ctx.provider;
    const reminders = { useDefault: false, overrides: popup(30, 15) };
    await expect(p.patchEvent('anna@example.org', id, { reminders })).rejects.toBeInstanceOf(ProviderForbiddenError);
    await allow(true);
    await p.patchEvent('anna@example.org', id, { reminders });
    expect((await google(id)).reminders.overrides).toEqual(popup(30, 15));
  });

  it('returns to refusing after a reset', async () => {
    await allow(true);
    await t.req('POST', '/api/__test/reset');
    const { id } = await yoga();
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [5] } });
    expect((await google(id)).reminders.overrides).toEqual(popup(30));
  });
});

describe('reminders of a read-only event', () => {
  it('goes to Google when Google accepts, and keeps no copy', async () => {
    await allow(true);
    const { id } = await yoga();
    const r = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [30, 15] } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ readOnly: true, title: 'Yoga', reminders: { useDefault: false, minutes: [30, 15] } });
    expect((await google(id)).reminders.overrides).toEqual(popup(30, 15));
    expect(fs.existsSync(overridesFile()) ? readFile().events : {}).toEqual({});
    expect(readFile().paths).toEqual({ 'anna@example.org': 'google' });
  });

  it('is kept by the app when Google refuses, shown on every read, and Google stays unchanged', async () => {
    const { id } = await yoga();
    const before = await google(id);
    const r = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [30, 15] } });
    expect(r.body.reminders).toEqual({ useDefault: false, minutes: [30, 15] });
    expect(await google(id)).toEqual(before);
    expect((await t.json('GET', `/api/events/${id}`)).body.reminders.minutes).toEqual([30, 15]);
    const items = (await t.json('GET', '/api/items?from=2026-10-12&to=2026-10-19')).body.items;
    expect(items.find((i: any) => i.id === id).reminders).toEqual({ useDefault: false, minutes: [30, 15] });
    expect(readFile()).toEqual({ paths: { 'anna@example.org': 'local' }, events: { 'anna@example.org': { [id]: { useDefault: false, minutes: [30, 15] } } } });
  });

  it('can go back to the calendar default and to none', async () => {
    const { id } = await yoga('freeBusyReader');
    const d = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: true, minutes: [] } });
    expect(d.body.reminders.useDefault).toBe(true);
    const n = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [] } });
    expect(n.body.reminders).toEqual({ useDefault: false, minutes: [] });
  });

  it('skips the Google attempt once a calendar is known to refuse, and tries again when Google starts to accept', async () => {
    const { id } = await yoga();
    const patch = vi.spyOn(t.app.ctx.provider, 'patchEvent');
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [10] } });
    expect(patch).toHaveBeenCalledTimes(1);
    await allow(true);
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [20] } });
    expect(patch).toHaveBeenCalledTimes(1); // path "local": not asked again
    patch.mockRestore();
  });

  it('drops the app copy when Google takes a later change', async () => {
    const { id } = await yoga();
    await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [10] } });
    t.app.ctx.prefs.reminderOverrides.setGoogle(LOCAL_PERSON, 'anna@example.org', id);
    await allow(true);
    const r = await t.json('PATCH', `/api/events/${id}`, { reminders: { useDefault: false, minutes: [20] } });
    expect(r.body.reminders.minutes).toEqual([20]);
    expect((await google(id)).reminders.overrides).toEqual(popup(20));
    expect(readFile().events).toEqual({});
  });

  it('leaves everything else look-only: any other field is 403, reminders alongside it too', async () => {
    await allow(true);
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
