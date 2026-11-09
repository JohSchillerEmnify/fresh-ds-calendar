/** Birthday steps (spec/features/birthdays.feature): Google's contacts Birthdays calendar (read-only) and birthdays made in Google Calendar (editable). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import { tid, type World } from './support/world.js';

const BIRTHDAYS_ID = 'addressbook#contacts@group.v.calendar.google.com';
const BIRTHDAYS_COLOR = '#9fc6e7';

/** Adds one entry to the Birthdays calendar as Google makes it from a contact (the calendar is created on first use). */
async function addSpecial(world: World, title: string, date: string, type: 'birthday' | 'anniversary') {
  const cals = await world.api.remoteCalendars();
  if (!cals.some((c) => c.id === BIRTHDAYS_ID)) {
    await world.api.post('/api/__test/remote/calendars', { summary: 'Birthdays', id: BIRTHDAYS_ID, color: BIRTHDAYS_COLOR, readOnly: true });
  }
  await world.api.remoteInsert({
    calendarId: BIRTHDAYS_ID, summary: title, start: { date }, end: { date: addDays(date, 1) },
    eventType: 'birthday', birthdayProperties: { type, contact: 'people/c1' }, recurrence: ['RRULE:FREQ=YEARLY'],
  });
}

Given('the Birthdays calendar has a birthday {string} on {date}', async function (this: World, title: string, date: string) {
  await addSpecial(this, title, date, 'birthday');
});

Given('the Birthdays calendar has an anniversary {string} on {date}', async function (this: World, title: string, date: string) {
  await addSpecial(this, title, date, 'anniversary');
});

/** Makes sure the old contacts calendar exists in the mock's list. */
async function ensureContactsCalendar(world: World) {
  if (!(await world.api.remoteCalendars()).some((c) => c.id === BIRTHDAYS_ID)) {
    await world.api.post('/api/__test/remote/calendars', { summary: 'Birthdays', id: BIRTHDAYS_ID, color: BIRTHDAYS_COLOR, readOnly: true });
  }
}

Given('Google hides the old Birthdays calendar', async function (this: World) {
  await ensureContactsCalendar(this);
  await this.api.put(`/api/__test/remote/calendars/${encodeURIComponent(BIRTHDAYS_ID)}/hidden`, { hidden: true });
});

Then('the filter bar offers the calendar {string} once', async function (this: World, name: string) {
  if (!(await this.page.getByTestId('filter-bar').isVisible())) await this.page.getByTestId('filter-button').click();
  await expect(this.byTestId('filter-chip-calendar', `[data-name="${name}"]`)).toHaveCount(1);
});

Then('the event {string} is in the calendar {string}', async function (this: World, title: string, name: string) {
  const id = name === 'Birthdays' ? 'birthdays' : await this.api.calendarId(name);
  await expect(this.eventChip(title)).toHaveAttribute('data-calendar-id', id);
});

Then('the event {string} is shown once on {date}', async function (this: World, title: string, date: string) {
  await this.settled();
  await expect(this.eventChips(title, date).locator('visible=true')).toHaveCount(1);
});

const marker = (world: World, title: string) => world.eventChips(title).locator('visible=true').first();

Then('the event {string} is marked as a birthday', async function (this: World, title: string) {
  await expect(marker(this, title)).toHaveAttribute('data-special', 'birthday');
  await expect(marker(this, title).locator(tid('event-marker'))).toHaveText('🎂');
});

Then('the event {string} is marked as an anniversary', async function (this: World, title: string) {
  await expect(marker(this, title)).toHaveAttribute('data-special', 'anniversary');
  await expect(marker(this, title).locator(tid('event-marker'))).toHaveText('💍');
});

Then('the event {string} is not marked as a birthday', async function (this: World, title: string) {
  await expect(marker(this, title)).toBeVisible();
  await expect(marker(this, title)).not.toHaveAttribute('data-special', /.+/);
  await expect(marker(this, title).locator(tid('event-marker'))).toHaveCount(0);
});

Then('the event dialog is read-only', async function (this: World) {
  await expect(this.byTestId('event-readonly')).toBeVisible();
});

Then('the event dialog has no save or delete button', async function (this: World) {
  await expect(this.byTestId('event-save')).toHaveCount(0);
  await expect(this.byTestId('event-delete')).toHaveCount(0);
});

// --- birthdays made in Google Calendar (eventType birthday in a normal calendar) --------------------------------------

/** Adds a yearly birthday to a calendar as Google Calendar makes it; `contact` links it to a Google contact. */
async function addGoogleBirthday(world: World, calendar: string, title: string, date: string, contact?: string) {
  await world.api.remoteInsert({
    calendarId: await world.api.calendarId(calendar), summary: title, start: { date }, end: { date: addDays(date, 1) }, eventType: 'birthday',
    recurrence: ['RRULE:FREQ=YEARLY'], visibility: 'private', transparency: 'transparent',
    birthdayProperties: { type: 'birthday', ...(contact ? { contact } : {}) },
  });
}

Given('the calendar {string} has a birthday {string} on {date}', async function (this: World, calendar: string, title: string, date: string) {
  await addGoogleBirthday(this, calendar, title, date);
});

Given('the calendar {string} has a birthday {string} on {date} linked to a contact', async function (this: World, calendar: string, title: string, date: string) {
  await addGoogleBirthday(this, calendar, title, date, 'people/c1');
});

const OPTIONS: Record<string, string> = { Event: 'new-kind-event', 'Task list': 'new-kind-tasklist', Birthday: 'create-birthday' };

When('I choose {string} in the create menu', async function (this: World, option: string) {
  const id = OPTIONS[option];
  if (!id) throw new Error(`Unknown create menu entry "${option}" (known: ${Object.keys(OPTIONS).join(', ')})`);
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId(id).click();
  if (option === 'Birthday') await expect(this.byTestId('birthday-dialog')).toBeVisible();
});

When('I enter the birthday name {string}', async function (this: World, name: string) {
  await this.byTestId('birthday-name').fill(name);
});

When('I change the birthday name to {string}', async function (this: World, name: string) {
  await this.byTestId('birthday-name').fill(name);
});

When('I set the birthday date to {date}', async function (this: World, date: string) {
  await this.byTestId('birthday-date').fill(date);
});

When('I save the birthday', async function (this: World) {
  await this.byTestId('birthday-save').click();
  await expect(this.byTestId('birthday-dialog')).toBeHidden();
});

Then('the birthday date cannot be changed', async function (this: World) {
  await expect(this.byTestId('birthday-date')).toBeDisabled();
  await expect(this.byTestId('birthday-date-locked')).toBeVisible();
});

Then('the birthday name is {string}', async function (this: World, name: string) {
  await expect(this.byTestId('birthday-name')).toHaveValue(name);
});

Then('the birthday name can be changed', async function (this: World) {
  await expect(this.byTestId('birthday-name')).toBeEditable();
});

Then('the event {string} is shown on {date}', async function (this: World, title: string, date: string) {
  await this.page.goto(`/month/${date.slice(0, 7)}`);
  await this.settled();
  await expect(this.eventChips(title, date).locator('visible=true').first()).toBeVisible();
});

/** The live (not deleted) birthday series Google holds under this name. */
const googleBirthdays = async (world: World, title: string) =>
  (await world.api.remoteEvents(title)).filter((e) => e.eventType === 'birthday' && e.status !== 'cancelled' && !e.recurringEventId);

Then('Google has a birthday {string} repeating every year from {date}', async function (this: World, title: string, date: string) {
  await expect.poll(async () => (await googleBirthdays(this, title)).map((e) => [e.start.date, (e.recurrence as string[] | undefined)?.[0]]), `Google birthday "${title}"`)
    .toEqual([[date, 'RRULE:FREQ=YEARLY']]);
});

Then('Google has the birthday {string} with the rule {string}', async function (this: World, title: string, rule: string) {
  await expect.poll(async () => (await googleBirthdays(this, title)).map((e) => e.recurrence), `Google birthday "${title}"`).toEqual([[rule]]);
});

Then('Google has no birthday {string}', async function (this: World, title: string) {
  // the delete is sent when its undo time is over
  await expect.poll(() => this.page.evaluate(() => (window as { __pendingDeletes?: number }).__pendingDeletes ?? 0), { timeout: 15_000 }).toBe(0);
  await expect.poll(async () => (await googleBirthdays(this, title)).length, `Google birthdays "${title}"`).toBe(0);
});
