/**
 * All-calendars steps (STEPS.md "All calendars"). Calendars live in a person's mock Google account (TEST_MODE);
 * signing in and the event assertions are the steps of signin.steps.ts.
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { attr, type World } from './support/world.js';

interface Owned { owner: string; calendars: Map<string, { id: string; color: string }> }

/** Per scenario: whose calendars were set up and their ids/colours. */
const owned = new WeakMap<World, Owned>();

const OWN = { id: 'primary', color: '#039be5' };
const SHARED = { id: 'shared-family@group.calendar.example', color: '#d81b60' };

async function signIn(world: World, email: string, date = '2026-10-12') {
  world.person = email;
  await world.api.chooseGoogleAccount(email);
  await world.page.goto(`/week/${date}`);
  await world.page.getByTestId('signin-google').click();
  await world.page.waitForURL((u) => u.pathname !== '/signin' || u.searchParams.has('error'));
  await world.calendarShown();
}

/** Taps the calendar's chip in the filter bar (opening the bar first) and waits until the choice is saved. */
async function hideCalendar(world: World, name: string) {
  const bar = world.page.getByTestId('filter-bar');
  if (!(await bar.isVisible())) await world.page.getByTestId('filter-button').click();
  await expect(bar).toBeVisible();
  const chip = world.byTestId('filter-chip-calendar', attr('data-name', name));
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const saved = world.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/calendars/'));
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await saved;
}

Given('{string} has the calendar {string} and the shared calendar {string}', async function (this: World, owner: string, own: string, shared: string) {
  owned.set(this, { owner, calendars: new Map([[own, OWN], [shared, SHARED]]) });
  await this.api.setCalendars(owner, [
    { id: OWN.id, name: own, color: OWN.color, primary: true },
    { id: SHARED.id, name: shared, color: SHARED.color, shared: true },
  ]);
});

Given(
  'the calendar {string} has an event {string} on {date} from {time} to {time}',
  async function (this: World, calendar: string, title: string, date: string, from: string, to: string) {
    const o = owned.get(this)!;
    await this.api.remoteInsert({
      owner: o.owner, calendarId: o.calendars.get(calendar)!.id, summary: title,
      start: { dateTime: berlinIso(date, from) }, end: { dateTime: berlinIso(date, to) },
    });
  },
);

Then('the event {string} has the color of the calendar {string}', async function (this: World, title: string, calendar: string) {
  const color = owned.get(this)!.calendars.get(calendar)!.color;
  await expect(this.eventChip(title)).toHaveAttribute('data-color', new RegExp(`^${color}$`, 'i'));
});

When('they hide the calendar {string} in the filter bar', async function (this: World, name: string) {
  await hideCalendar(this, name);
});

Given('{string} hid the calendar {string}', async function (this: World, email: string, name: string) {
  await signIn(this, email);
  await hideCalendar(this, name);
});

When('{string} opens the week view for {date} on another device', async function (this: World, email: string, date: string) {
  await this.switchDevice();
  await signIn(this, email, date);
});
