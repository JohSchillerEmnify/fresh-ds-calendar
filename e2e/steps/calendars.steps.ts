/**
 * All-calendars steps (STEPS.md "All calendars"). Calendars live in a person's mock Google account (TEST_MODE);
 * signing in and the event assertions are the steps of signin.steps.ts.
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { attr, type World } from './support/world.js';
import { longPress } from './calendar-plan.steps.js';

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
  // the app's own first sync is over, so a later request is a new one (live sync scenarios count them)
  await expect(this.page.locator('html')).toHaveAttribute('data-device-store', 'synced', { timeout: 15_000 });
});

/** The 11 Google colours the calendar sheet offers (event dialog palette): Google colour id and hex. */
const COLOURS: Record<string, { id: string; hex: string }> = {
  Lavender: { id: '1', hex: '#7986cb' }, Sage: { id: '2', hex: '#33b679' }, Grape: { id: '3', hex: '#8e24aa' }, Flamingo: { id: '4', hex: '#e67c73' },
  Banana: { id: '5', hex: '#f6bf26' }, Tangerine: { id: '6', hex: '#f4511e' }, Peacock: { id: '7', hex: '#039be5' }, Graphite: { id: '8', hex: '#616161' },
  Blueberry: { id: '9', hex: '#3f51b5' }, Basil: { id: '10', hex: '#0b8043' }, Tomato: { id: '11', hex: '#d50000' },
};
const colourHex = (name: string) => COLOURS[name].hex;
const sheetOf = (world: World) => world.page.getByTestId('calendar-plan-sheet');
const swatch = (world: World, name: string) => sheetOf(world).getByTestId('calendar-color-option').and(world.page.locator(`[data-name="${name}"]`));

Given(
  'the calendar {string} has an event {string} on {date} from {time} to {time} in the colour {string}',
  async function (this: World, calendar: string, title: string, date: string, from: string, to: string, colour: string) {
    const o = owned.get(this)!;
    await this.api.remoteInsert({
      owner: o.owner, calendarId: o.calendars.get(calendar)!.id, summary: title, colorId: COLOURS[colour].id,
      start: { dateTime: berlinIso(date, from) }, end: { dateTime: berlinIso(date, to) },
    });
  },
);

Then('the calendar sheet offers 11 colours', async function (this: World) {
  await expect(sheetOf(this).getByTestId('calendar-color-option')).toHaveCount(11);
});

Then('the colour {string} is chosen in the calendar sheet', async function (this: World, name: string) {
  await expect(swatch(this, name)).toHaveAttribute('aria-checked', 'true');
  await expect(sheetOf(this).locator('[data-testid="calendar-color-option"][aria-checked="true"]')).toHaveCount(1);
});

/** Picks a swatch and waits until the server has the colour. */
async function chooseColour(world: World, name: string) {
  const saved = world.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/calendars/') && r.status() === 200);
  await swatch(world, name).click();
  await saved;
}

When('I choose the colour {string} in the calendar sheet', async function (this: World, name: string) {
  await chooseColour(this, name);
});

Given('I recolour the calendar {string} to {string}', async function (this: World, calendar: string, name: string) {
  const bar = this.page.getByTestId('filter-bar');
  if (!(await bar.isVisible())) await this.page.getByTestId('filter-button').click();
  const chip = this.byTestId('filter-chip-calendar', attr('data-name', calendar));
  await longPress(this, chip);
  await chooseColour(this, name);
});

Then('the event {string} is drawn in the colour {string}', async function (this: World, title: string, name: string) {
  await expect(this.eventChip(title)).toHaveAttribute('data-color', new RegExp(`^${colourHex(name)}$`, 'i'));
});

Then('the event {string} is drawn in its own calendar colour', async function (this: World, title: string) {
  await expect(this.eventChip(title)).toHaveAttribute('data-color', new RegExp(`^${SHARED.color}$`, 'i'));
});

Then('Google lists the calendar {string} in the colour {string}', async function (this: World, calendar: string, name: string) {
  const o = owned.get(this)!;
  const listed = (await this.api.remoteCalendars(o.owner)).find((c) => c.id === o.calendars.get(calendar)!.id);
  expect(listed?.backgroundColor.toLowerCase()).toBe(colourHex(name));
});
