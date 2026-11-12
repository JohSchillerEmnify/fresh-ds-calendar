/** Steps of spec/features/events-readonly.feature: invitations and calendars shared read-only are look-only. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { optionLabels } from './support/ui.js';
import { tid, type World } from './support/world.js';

/** Per scenario: the status of the last API call the scenario made itself. */
const answered = new WeakMap<World, number>();

/** Inserts a timed event into Google as another client would (the organiser is whoever the scenario names). */
async function insertEvent(world: World, calendarId: string | undefined, title: string, date: string, from: string, to: string, extra: object = {}) {
  await world.api.remoteInsert({ ...(calendarId ? { calendarId } : {}), summary: title, start: { dateTime: berlinIso(date, from) }, end: { dateTime: berlinIso(date, to) }, ...extra });
}

Given(
  'the calendar contains an event {string} on {date} from {time} to {time} organised by {string}',
  async function (this: World, title: string, date: string, from: string, to: string, organiser: string) {
    await insertEvent(this, undefined, title, date, from, to, { organizer: { email: organiser } });
  },
);

Given(
  'the calendar contains an event {string} on {date} from {time} to {time} organised by {string} with guests allowed to edit',
  async function (this: World, title: string, date: string, from: string, to: string, organiser: string) {
    await insertEvent(this, undefined, title, date, from, to, { organizer: { email: organiser }, guestsCanModify: true });
  },
);

Given('a calendar {string} shared with me with edit rights by {string}', async function (this: World, name: string, owner: string) {
  // another person's primary calendar: its id is their address, my role is writer
  await this.api.remoteInsertCalendar(name, false, undefined, { id: owner, accessRole: 'writer', ownerEmail: owner });
});

Given('a family calendar {string} shared with me with edit rights by {string}', async function (this: World, name: string, owner: string) {
  // a Google group calendar (default id `…@group.calendar.google.com`): the owner's data, my role is writer
  await this.api.remoteInsertCalendar(name, false, undefined, { accessRole: 'writer', ownerEmail: owner });
});

Given('a calendar {string} shared with me read-only by {string}', async function (this: World, name: string, owner: string) {
  // another person's primary calendar, my role is reader
  await this.api.remoteInsertCalendar(name, false, undefined, { id: owner, accessRole: 'reader', ownerEmail: owner });
});

Given(
  'the calendar {string} contains an event {string} on {date} from {time} to {time}',
  async function (this: World, calendar: string, title: string, date: string, from: string, to: string) {
    await insertEvent(this, await this.api.calendarId(calendar), title, date, from, to);
  },
);

Given(
  'the calendar {string} contains an event {string} on {date} from {time} to {time} at {string} with the description {string}',
  async function (this: World, calendar: string, title: string, date: string, from: string, to: string, location: string, description: string) {
    await insertEvent(this, await this.api.calendarId(calendar), title, date, from, to, { location, description });
  },
);

When('I start a new event', async function (this: World) {
  await this.page.goto('/week/2026-10-12');
  await this.settled();
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-event').click();
  await expect(this.byTestId('event-dialog')).toBeVisible();
});

When('I try to rename the event {string} through the API', async function (this: World, title: string) {
  const found = (await this.api.remoteEvents(title)).find((e) => e.status !== 'cancelled');
  if (!found) throw new Error(`Google has no event "${title}"`);
  answered.set(this, await this.api.status('PATCH', `/api/events/${encodeURIComponent(found.id)}`, { title: `${title} (renamed)` }));
});

Then('the API answers {int}', async function (this: World, status: number) {
  expect(answered.get(this)).toBe(status);
});

Then('the event dialog is editable', async function (this: World) {
  await expect(this.byTestId('event-save')).toBeVisible();
  await expect(this.byTestId('event-readonly')).toHaveCount(0);
});

Then('the read-only reason says {string}', async function (this: World, text: string) {
  await expect(this.byTestId('event-readonly-reason')).toHaveText(text);
});

Then('the calendar picker does not offer {string}', async function (this: World, name: string) {
  const picker = this.page.locator(tid('event-calendar'));
  await expect(picker).toBeVisible();
  // the list loads after the dialog opens: wait for the writable calendars, then check the other one is not among them
  await expect.poll(async () => await optionLabels(picker), { message: 'calendar picker options' }).toContain('Work');
  expect(await optionLabels(picker)).not.toContain(name);
});

Then('the calendar picker offers {string}', async function (this: World, name: string) {
  const picker = this.page.locator(tid('event-calendar'));
  await expect(picker).toBeVisible();
  await expect.poll(async () => await optionLabels(picker), { message: 'calendar picker options' }).toContain(name);
});
