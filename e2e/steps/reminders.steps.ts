/**
 * Reminder steps (STEPS.md "Reminders"): lead lists are comma-separated minutes ("90, 30, 15"), labels use the app's duration
 * format ("1 h 30 min"). Setup and "in Google" steps read and write the mock Google provider through `__test` routes.
 */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { GoogleEvent } from './support/api.js';
import { berlinToEpoch } from './support/dates.js';
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

Given('Google accepts reminder changes in calendars I can only read', async function (this: World) {
  await this.api.put('/api/__test/remote/reader-reminders', { allow: true });
});

Given('Google refuses reminder changes in calendars I can only read', async function (this: World) {
  await this.api.put('/api/__test/remote/reader-reminders', { allow: false });
});

Then('the event {string} in Google is still {string} on {date} from {time} to {time}', async function (this: World, title: string, summary: string, date: string, from: string, to: string) {
  const e = await googleEvent(this, title);
  expect(e.summary).toBe(summary);
  expect(Date.parse(e.start.dateTime ?? '')).toBe(berlinToEpoch(date, from));
  expect(Date.parse(e.end.dateTime ?? '')).toBe(berlinToEpoch(date, to));
});

Then('the app keeps the reminders {string} for the event {string}', async function (this: World, list: string, title: string) {
  const id = (await googleEvent(this, title)).id;
  await expect.poll(async () => (await this.api.get<{ reminders: { minutes: number[] } }>(`/api/events/${encodeURIComponent(id)}`)).reminders.minutes.join(', ')).toBe(minutesOf(list).join(', '));
});

// --- Settings → Reminders ----------------------------------------------------------------------------------------

async function openReminderSettings(this: World) {
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/');
    await this.calendarShown();
  }
  if (!(await this.page.getByTestId('settings-view').isVisible())) await this.page.getByTestId('settings-button').click();
  await this.page.getByTestId('settings-reminders').click();
  await expect(this.page.getByTestId('reminders-settings')).toBeVisible();
}
When('I open the reminder settings', openReminderSettings);
When('I open the reminders settings', openReminderSettings);

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

// --- Web Push ----------------------------------------------------------------------------------------------------

/** Where the server-side push state of the test double is read. */
interface PushState { subscriptions: Array<{ endpoint: string; plan: Array<{ at: number; title: string; body: string }> }> }
const pushesOf = async (w: World) => (await w.api.call<{ pushes: Array<{ endpoint: string; title: string; body: string; kind?: string }> }>('GET', '/api/__test/pushes')).pushes;
/** The push kind behind each icon name of the spec (the service worker picks the icon files by kind). */
const KIND_OF_ICON: Record<string, string> = { 'calendar page': 'event', checklist: 'tasklist', sunrise: 'summary', moon: 'bedtime' };
const browserEndpoint = (w: World): Promise<string> => w.page.evaluate(() => (window as unknown as { __e2ePushEndpoint?: string }).__e2ePushEndpoint ?? '');
const subscriptionOf = async (w: World) => {
  const endpoint = await browserEndpoint(w);
  return endpoint ? (await w.api.call<PushState>('GET', '/api/__test/push-subscriptions')).subscriptions.find((s) => s.endpoint === endpoint) : undefined;
};

Given('the morning overview is on at {time}', async function (this: World, time: string) {
  await this.api.patch('/api/prefs', { notify: { morning: true, morningTime: time } });
});

When('I switch on reminders in this browser', async function (this: World) {
  // headless Chromium has no push service: the browser's permission and subscription are replaced by a fake with a unique https endpoint
  await this.page.evaluate(() => {
    const endpoint = `https://push.example.test/e2e-${Math.random().toString(36).slice(2)}`;
    let sub: unknown = null;
    const fake = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' } }), unsubscribe: async () => { sub = null; return true; } };
    Notification.requestPermission = async () => 'granted';
    Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
    PushManager.prototype.subscribe = async () => (sub = fake) as unknown as PushSubscription;
    PushManager.prototype.getSubscription = async () => sub as PushSubscription | null;
    (window as unknown as { __e2ePushEndpoint: string }).__e2ePushEndpoint = endpoint;
  });
  const control = this.page.getByTestId('reminders-push');
  await expect(control).toBeVisible();
  await control.click();
  await expect(control).toHaveAttribute('aria-checked', 'true');
});

Then('this browser has a push subscription on the server', async function (this: World) {
  await expect.poll(async () => !!(await subscriptionOf(this))).toBe(true);
});

Then('the server has {int} planned pushes for this browser', async function (this: World, count: number) {
  await expect.poll(async () => (await subscriptionOf(this))?.plan.length).toBe(count);
});

/** Expects exactly one recorded push to this browser that matches. */
async function sentOnce(w: World, match: (p: { title: string; body: string; kind?: string }) => boolean): Promise<void> {
  const endpoint = await browserEndpoint(w);
  const sent = async () => (await pushesOf(w)).filter((p) => p.endpoint === endpoint && match(p)).length;
  await expect.poll(sent).toBeGreaterThanOrEqual(1);
  expect(await sent()).toBe(1);
}

Then('the push {string} saying {string} was sent once', async function (this: World, title: string, body: string) {
  await sentOnce(this, (p) => p.title === title && p.body === body);
});

Then('the push {string} was sent once with the {string} icon', async function (this: World, title: string, icon: string) {
  const kind = KIND_OF_ICON[icon];
  expect(kind, `unknown icon "${icon}"`).toBeDefined();
  await sentOnce(this, (p) => p.title === title && p.kind === kind);
});

Then('the server plans the push {string} saying {string} for {date} {time}', async function (this: World, title: string, body: string, date: string, time: string) {
  const at = berlinToEpoch(date, time);
  await expect.poll(async () => (await subscriptionOf(this))?.plan.some((e) => e.title === title && e.body === body && e.at === at)).toBe(true);
});
