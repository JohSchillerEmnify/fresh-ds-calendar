/** Birthday steps (spec/features/birthdays.feature): Google's contacts Birthdays calendar and its read-only entries. */
import { expect } from '@playwright/test';
import { Given, Then } from './fixtures.js';
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
