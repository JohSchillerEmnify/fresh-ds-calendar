/**
 * Reminder steps (STEPS.md "Reminders"): lead lists are comma-separated minutes ("90, 30, 15"), labels use the app's duration
 * format ("1 h 30 min"). Setup and "in Google" steps read and write the mock Google provider through `__test` routes.
 */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { GoogleEvent } from './support/api.js';
import { exactText, type World } from './support/world.js';

/** `"90, 30, 15"` -> `[90, 30, 15]`; `""` -> `[]`. */
const minutesOf = (list: string): number[] => list.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
const popups = (minutes: number[]) => minutes.map((m) => ({ method: 'popup', minutes: m }));
type Reminder = { method: string; minutes: number };

/** The confirmed Google event or task list with this title. */
async function googleEvent(world: World, title: string): Promise<GoogleEvent> {
  const found = (await world.api.remoteEvents(title)).filter((e) => e.status !== 'cancelled');
  if (found.length !== 1) throw new Error(`expected exactly one Google event "${title}", found ${found.length}`);
  return found[0]!;
}

async function calendarId(world: World, name: string): Promise<string> {
  const cal = (await world.api.remoteCalendars()).find((c) => c.summary === name);
  if (!cal) throw new Error(`no calendar "${name}" in the mock Google account`);
  return cal.id;
}

async function defaultsOf(world: World, name: string): Promise<Reminder[]> {
  const cal = (await world.api.remoteCalendars()).find((c) => c.summary === name) as ({ defaultReminders?: Reminder[] } | undefined);
  return cal?.defaultReminders ?? [];
}

const reminders = (e: GoogleEvent) => (e.reminders ?? {}) as { useDefault?: boolean; overrides?: Reminder[] };
const popupMinutes = (e: GoogleEvent) => (reminders(e).overrides ?? []).filter((r) => r.method === 'popup').map((r) => r.minutes);

async function ownReminders(world: World, title: string, popup: string, email?: string) {
  const e = await googleEvent(world, title);
  const overrides = [...popups(minutesOf(popup)), ...(email === undefined ? [] : [{ method: 'email', minutes: Number(email) }])];
  await world.api.remotePatch(e.id, { reminders: { useDefault: false, overrides } });
}

Given('the calendar {string} has the default reminders {string}', async function (this: World, name: string, list: string) {
  const id = await calendarId(this, name);
  await this.api.call('PUT', `/api/__test/remote/calendars/${encodeURIComponent(id)}/default-reminders`, { defaultReminders: popups(minutesOf(list)) });
});

Given('the calendar {string} has the default reminders {string} in Google', async function (this: World, name: string, list: string) {
  await expect.poll(async () => (await defaultsOf(this, name)).filter((r) => r.method === 'popup').map((r) => r.minutes).join(', ')).toBe(minutesOf(list).join(', '));
});

Given('the event {string} has its own reminders {string} in Google', async function (this: World, title: string, list: string) {
  await ownReminders(this, title, list);
});

Given('the event {string} has its own reminders {string} and the email reminder {string} in Google', async function (this: World, title: string, list: string, email: string) {
  await ownReminders(this, title, list, email);
});

Given('the task list {string} has its own reminders {string} in Google', async function (this: World, title: string, list: string) {
  await ownReminders(this, title, list);
});

// --- event dialog ----------------------------------------------------------------------------------------------

const row = (w: World): Locator => w.page.getByTestId('event-dialog').getByTestId('event-reminders');
const chips = (w: World): Locator => row(w).getByTestId('event-reminder');

Then('the event reminders show the calendar default {string}', async function (this: World, list: string) {
  await expect(row(this)).toHaveAttribute('data-use-default', 'true');
  await expect(row(this).getByTestId('event-reminders-default-list')).toHaveText(exactText(list));
});

Then('the event reminders are {string}', async function (this: World, list: string) {
  await expect(row(this)).toHaveAttribute('data-use-default', 'false');
  const expected = list.split(',').map((s) => s.trim()).filter(Boolean);
  await expect.poll(async () => (await chips(this).allTextContents()).map((s) => s.trim())).toEqual(expected);
});

When('I add the reminder {string}', async function (this: World, label: string) {
  await row(this).getByTestId('event-reminder-add').click();
  await row(this).getByTestId('event-reminder-option').filter({ hasText: exactText(label) }).click();
});

When('I remove the reminder {string}', async function (this: World, label: string) {
  await chips(this).filter({ hasText: exactText(label) }).getByTestId('event-reminder-remove').click();
});

When('I choose the calendar default reminders', async function (this: World) {
  await row(this).getByTestId('event-reminders-default').click();
});

Then('I cannot add another reminder', async function (this: World) {
  await expect(row(this).getByTestId('event-reminder-add')).toBeDisabled();
});

// --- Google ------------------------------------------------------------------------------------------------------

Then('the event {string} has the reminders {string} in Google', async function (this: World, title: string, list: string) {
  await expect.poll(async () => popupMinutes(await googleEvent(this, title)).join(', ')).toBe(minutesOf(list).join(', '));
});

Then('the event {string} does not use the calendar default in Google', async function (this: World, title: string) {
  await expect.poll(async () => reminders(await googleEvent(this, title)).useDefault).toBe(false);
});

Then('the event {string} uses the calendar default in Google', async function (this: World, title: string) {
  await expect.poll(async () => reminders(await googleEvent(this, title)).useDefault).toBe(true);
});

Then('the event {string} still has the email reminder {string} in Google', async function (this: World, title: string, minutes: string) {
  await expect.poll(async () => ((await googleEvent(this, title)).reminders as { overrides?: Reminder[] } | undefined)?.overrides?.filter((r) => r.method === 'email').map((r) => r.minutes).join(', ')).toBe(minutes);
});

// --- Settings → Reminders ----------------------------------------------------------------------------------------

When('I open the reminder settings', async function (this: World) {
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/');
    await this.calendarShown();
  }
  if (!(await this.page.getByTestId('settings-view').isVisible())) await this.page.getByTestId('settings-button').click();
  await this.page.getByTestId('settings-reminders').click();
  await expect(this.page.getByTestId('reminders-settings')).toBeVisible();
});

const calendarSection = (w: World, name: string): Locator => w.page.getByTestId('reminders-calendar').filter({ has: w.page.getByRole('heading', { name, exact: true }) });

Then('the reminder settings show {string} for the calendar {string}', async function (this: World, list: string, name: string) {
  const expected = list.split(',').map((s) => s.trim()).filter(Boolean);
  await expect.poll(async () => (await calendarSection(this, name).getByTestId('calendar-default-reminder').allTextContents()).map((s) => s.trim())).toEqual(expected);
});

When('I add the default reminder {string} for the calendar {string}', async function (this: World, label: string, name: string) {
  const section = calendarSection(this, name);
  await section.getByTestId('calendar-default-reminder-add').click();
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname.startsWith('/api/calendars/') && r.request().method() === 'PATCH');
  await section.getByTestId('calendar-default-reminder-option').filter({ hasText: exactText(label) }).click();
  expect((await saved).status(), 'calendar default saved').toBe(200);
});

When('I switch on reminders for task lists', async function (this: World) {
  const control = this.page.getByTestId('reminders-tasklists');
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) === 'true') return;
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await control.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
  await expect(control).toHaveAttribute('aria-checked', 'true');
});
