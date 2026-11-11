/** Birthdays from Google Contacts (spec/features/events/contact-birthdays.feature): the mock People API, the permission and its offer. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { tid, type World } from './support/world.js';

/** The resource name of each contact a scenario created, by name (the first one of that name). */
const known = new WeakMap<World, Map<string, string>>();
const remember = (world: World, name: string, resourceName: string) => {
  const m = known.get(world) ?? new Map<string, string>();
  if (!m.has(name)) m.set(name, resourceName);
  known.set(world, m);
};

interface ContactDate { year?: number; month: number; day: number }
const fullDate = (date: string): ContactDate => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) });

async function addContact(world: World, name: string, body: { owner?: string; birthday?: ContactDate; events?: Array<ContactDate & { type: string }> }) {
  const r = await world.api.post<{ resourceName: string }>('/api/__test/remote/contacts', { name, ...body });
  remember(world, name, r.resourceName);
  return r.resourceName;
}

Given('the contacts permission is granted', async function (this: World) {
  await this.api.post('/api/__test/oauth/contacts-access', { granted: true });
});

Given('the contacts permission is not granted', async function (this: World) {
  await this.api.post('/api/__test/oauth/contacts-access', { granted: false });
});

Given('the Google contacts have a birthday {string} on {date}', async function (this: World, name: string, date: string) {
  await addContact(this, name, { birthday: fullDate(date) });
});

Given('the Google contacts have a birthday {string} on {string} without a year', async function (this: World, name: string, day: string) {
  await addContact(this, name, { birthday: { month: Number(day.slice(0, 2)), day: Number(day.slice(3, 5)) } });
});

Given('the Google contacts have an anniversary {string} on {date}', async function (this: World, name: string, date: string) {
  await addContact(this, name, { events: [{ type: 'anniversary', ...fullDate(date) }] });
});

Given('the Google contacts have a custom date {string} for {string} on {date}', async function (this: World, label: string, name: string, date: string) {
  await addContact(this, name, { events: [{ type: label, ...fullDate(date) }] });
});

Given('the Google contacts of {string} have a birthday {string} on {date}', async function (this: World, owner: string, name: string, date: string) {
  await addContact(this, name, { owner, birthday: fullDate(date) });
});

Given('the Google contacts no longer have the birthday {string}', async function (this: World, name: string) {
  const rn = known.get(this)?.get(name);
  if (!rn) throw new Error(`No contact "${name}" was made in this scenario`);
  await this.api.delete(`/api/__test/remote/contacts/${rn}`);
});

Given('the Google contacts answer with an error', async function (this: World) {
  await this.api.post('/api/__test/remote/contacts-error', { status: 500 });
});

Given('the calendar {string} has a birthday {string} on {date} linked to the contact {string}', async function (this: World, calendar: string, title: string, date: string, contact: string) {
  const resourceName = known.get(this)?.get(contact) ?? await addContact(this, contact, { birthday: fullDate(date) });
  await this.api.remoteInsert({
    calendarId: await this.api.calendarId(calendar), summary: title, start: { date }, end: { date: new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) }, eventType: 'birthday',
    recurrence: ['RRULE:FREQ=YEARLY'], visibility: 'private', transparency: 'transparent', birthdayProperties: { type: 'birthday', contact: resourceName },
  });
});

Then('the event dialog shows the age {int}', async function (this: World, age: number) {
  await expect(this.byTestId('birthday-age')).toHaveText(`Turns ${age}`);
});

Then('the event dialog shows no age', async function (this: World) {
  await expect(this.byTestId('event-readonly')).toBeVisible();
  await expect(this.byTestId('birthday-age')).toHaveCount(0);
});

Then('the event dialog shows the hint {string}', async function (this: World, hint: string) {
  await expect(this.byTestId('event-readonly-hint')).toHaveText(hint);
});

Then('the Birthdays settings offer to allow Google Contacts', async function (this: World) {
  await expect(this.byTestId('settings-contacts-access')).toBeVisible();
  await expect(this.byTestId('settings-contacts-grant')).toBeVisible();
});

Then('the Birthdays settings do not offer to allow Google Contacts', async function (this: World) {
  await expect(this.byTestId('settings-calendar-shown')).toBeVisible();
  await expect(this.byTestId('settings-contacts-access')).toHaveCount(0);
  await expect(this.byTestId('settings-contacts-grant')).toHaveCount(0);
});

/** Answers the test double's consent screen with the Contacts permission, then presses the button that starts the round trip. */
async function allowThrough(world: World, button: string) {
  await world.api.post('/api/__test/oauth/contacts-access', { granted: true });
  await world.byTestId(button).click();
  await world.page.waitForURL((u) => !u.pathname.startsWith('/api/'));
}

When('I allow Google Contacts', async function (this: World) {
  await allowThrough(this, 'settings-contacts-grant');
  await expect(this.byTestId('settings-calendar-shown')).toBeVisible();
});

When('I allow in the message about Google Contacts', async function (this: World) {
  await allowThrough(this, 'contacts-offer-allow');
  await this.calendarShown();
});

When('I dismiss the message about Google Contacts', async function (this: World) {
  await this.byTestId('contacts-offer-dismiss').click();
  // saved for the person before the app is opened again
  await expect.poll(async () => (await this.api.get<{ contactsOfferDismissed: boolean }>('/api/prefs')).contactsOfferDismissed).toBe(true);
});

Then('I am told that birthdays from Google Contacts can be shown', async function (this: World) {
  await expect(this.byTestId('contacts-offer')).toBeVisible();
  await expect(this.byTestId('contacts-offer')).toContainText('Show birthdays from your Google Contacts too?');
});

Then('the message reads {string}', async function (this: World, text: string) {
  await expect(this.byTestId('contacts-offer')).toContainText(text);
});

Then('the event dialog shows the age text {string}', async function (this: World, text: string) {
  await expect(this.byTestId('birthday-age')).toHaveText(text);
});

Then('the message has the action {string}', async function (this: World, label: string) {
  await expect(this.byTestId('contacts-offer-allow')).toHaveText(label);
});

Then('I am no longer told that birthdays from Google Contacts can be shown', async function (this: World) {
  await this.settled();
  await expect(this.page.locator(tid('contacts-offer'))).toHaveCount(0);
});

Then('I am still signed in', async function (this: World) {
  await this.api.get('/api/auth/me');
  await this.calendarShown();
});
