/**
 * All-calendars steps (STEPS.md "All calendars"). Calendars live in a person's mock Google account (TEST_MODE);
 * signing in and the event assertions are the steps of signin.steps.ts.
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { attr, type World } from './support/world.js';
import { openSettingsPage } from './support/settings.js';

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

When('I hide the calendar {string} in the filter bar', async function (this: World, name: string) {
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

/** The 11 Google event colours (event dialog palette): name, Google colour id and hex. */
const COLOURS: Record<string, { id: string; hex: string }> = {
  Lavender: { id: '1', hex: '#7986cb' }, Sage: { id: '2', hex: '#33b679' }, Grape: { id: '3', hex: '#8e24aa' }, Flamingo: { id: '4', hex: '#e67c73' },
  Banana: { id: '5', hex: '#f6bf26' }, Tangerine: { id: '6', hex: '#f4511e' }, Peacock: { id: '7', hex: '#039be5' }, Graphite: { id: '8', hex: '#616161' },
  Blueberry: { id: '9', hex: '#3f51b5' }, Basil: { id: '10', hex: '#0b8043' }, Tomato: { id: '11', hex: '#d50000' },
};
/** The entries of Google's calendar palette (`colors.get`) the scenarios use. */
const PALETTE: Record<number, string> = { 1: '#ac725e', 3: '#f83a22', 8: '#16a765', 16: '#4986e7' };
/** A colour given as a Google event colour name or as `#rrggbb`. */
const colourHex = (name: string) => (name.startsWith('#') ? name : COLOURS[name].hex);
const pageOf = (world: World) => world.page.getByTestId('settings-group-page');
const options = (world: World) => pageOf(world).getByTestId('calendar-color-option');
const paletteSwatch = (world: World, n: number) => options(world).and(world.page.locator(`[data-name="Calendar color ${n}"]`));
const currentSwatch = (world: World) => options(world).and(world.page.locator('[data-name="Current color"]'));

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

Then("the calendar's settings page offers {int} palette colours", async function (this: World, count: number) {
  await expect(pageOf(this).locator('[data-testid="calendar-color-option"][data-name^="Calendar color "]')).toHaveCount(count);
});

Then('the palette colour {int} is drawn as {string}', async function (this: World, n: number, hex: string) {
  await expect(paletteSwatch(this, n)).toHaveAttribute('data-color', hex);
});

Then("the palette colour {int} is chosen on the calendar's settings page", async function (this: World, n: number) {
  await expect(paletteSwatch(this, n)).toHaveAttribute('aria-checked', 'true');
  await expect(pageOf(this).locator('[data-testid="calendar-color-option"][aria-checked="true"]')).toHaveCount(1);
});

Then("the current colour {string} is chosen as an extra colour on the calendar's settings page", async function (this: World, hex: string) {
  await expect(currentSwatch(this)).toHaveAttribute('data-color', hex);
  await expect(currentSwatch(this)).toHaveAttribute('aria-checked', 'true');
  await expect(pageOf(this).locator('[data-testid="calendar-color-option"][aria-checked="true"]')).toHaveCount(1);
});

Then("the calendar's settings page has no extra current colour", async function (this: World) {
  await expect(options(this).first()).toBeVisible();
  await expect(currentSwatch(this)).toHaveCount(0);
});

/** Runs `act` and waits until the server has the colour. */
async function saved(world: World, act: () => Promise<void>) {
  const done = world.page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/calendars\/|\/api\/calendar-colors\/tasks-calendar/.test(r.url()) && r.status() === 200);
  await act();
  await done;
}

When("I choose the palette colour {int} on the calendar's settings page", async function (this: World, n: number) {
  await saved(this, () => paletteSwatch(this, n).click());
});

When("I pick the custom colour {string} on the calendar's settings page", async function (this: World, hex: string) {
  // the native picker is a colour input: setting its value fires input and change like the picker's OK does
  await saved(this, () => pageOf(this).getByTestId('calendar-color-custom').fill(hex));
});

When("I type the colour {string} on the calendar's settings page", async function (this: World, hex: string) {
  const field = pageOf(this).getByTestId('calendar-color-hex');
  await field.fill(hex);
  // a valid colour is saved on Enter; an invalid one only shows the error
  if (/^#[0-9a-f]{6}$/i.test(hex)) await saved(this, () => field.press('Enter'));
  else await field.press('Enter');
});

Then('the colour field shows the error {string}', async function (this: World, message: string) {
  await expect(pageOf(this).getByTestId('calendar-color-error')).toHaveText(message);
});

Given('I recolour the calendar {string} to the palette colour {int}', async function (this: World, calendar: string, n: number) {
  await openSettingsPage(this, 'calendars');
  await this.page.locator(`[data-testid="settings-row"][data-setting="${calendar}"]`).click();
  await expect(pageOf(this)).toHaveAttribute('data-group', calendar);
  await saved(this, () => paletteSwatch(this, n).click());
});

When('I try to recolour the calendar {string} to the palette colour {int}', async function (this: World, calendar: string, n: number) {
  await openSettingsPage(this, 'calendars');
  await this.page.locator(`[data-testid="settings-row"][data-setting="${calendar}"]`).click();
  await expect(pageOf(this)).toHaveAttribute('data-group', calendar);
  const answered = this.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/calendars/'));
  await paletteSwatch(this, n).click();
  await answered;
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

Then('Google lists the calendar {string} with the palette colour {int}', async function (this: World, calendar: string, n: number) {
  const o = owned.get(this);
  // a calendar of the fixture by its name, else any calendar of the account by its Google summary (the tasks calendar)
  const id = o?.calendars.get(calendar)?.id;
  const listed = (await this.api.remoteCalendars(o?.owner)).find((c) => (id ? c.id === id : c.summary === calendar));
  expect(listed).toMatchObject({ backgroundColor: PALETTE[n] });
});
