/** Holiday calendar steps (STEPS.md "Holiday calendars"; feature holiday-regions). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import type { World } from './support/world.js';

const VARIANTS = { 'Public holidays only': 'official', 'Holidays and observances': 'all' } as const;
const section = (w: World) => w.page.getByTestId('settings-holidays');
const sheet = (w: World) => w.page.getByTestId('holiday-region-sheet');
const region = (w: World, name: string): Locator => sheet(w).locator(`[data-testid="holiday-region"][data-region="${name}"]`);

/** ICU also names retired codes (`DD` is "Germany" too); the curated list has none of them. */
const RETIRED = new Set(['BU', 'CS', 'DD', 'FX', 'NT', 'SU', 'TP', 'YD', 'YU', 'ZR']);

/** The ISO code of a country by its English name (the e2e app language). */
function codeOf(name: string): string {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let i = 0; i < 26 * 26; i++) {
    const code = String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!RETIRED.has(code) && names.of(code) === name) return code;
  }
  throw new Error(`no region named ${name}`);
}

const answered = (w: World, method: string, path: RegExp) =>
  w.page.waitForResponse((r) => r.request().method() === method && path.test(new URL(r.url()).pathname));

Given(
  'Google\'s holiday calendar of {string} has the holiday {string} on {date}',
  async function (this: World, name: string, title: string, date: string) {
    await this.api.remoteInsert({
      owner: this.person, calendarId: await this.api.holidayId(codeOf(name), 'official'), summary: title,
      start: { date }, end: { date: addDays(date, 1) },
    });
  },
);

Given('Google knows only the public holidays of {string}', async function (this: World, name: string) {
  await this.api.holidayMissing(this.person!, codeOf(name), ['all']);
});

Given('Google has no holiday calendar for {string}', async function (this: World, name: string) {
  await this.api.holidayMissing(this.person!, codeOf(name), ['official', 'all']);
});

Given('{string} has added the holiday region {string} as {string}', async function (this: World, email: string, name: string, variant: keyof typeof VARIANTS) {
  await this.api.remoteAddHoliday(email, codeOf(name), VARIANTS[variant]);
  // the signed-in device reads the calendar list at its next sync: start one now
  await this.page.reload();
  await this.calendarShown();
});

When('I open the holiday region picker', async function (this: World) {
  await section(this).locator('[data-testid="settings-row"][data-setting="Add region"]').click();
  await expect(this.page.getByTestId('holiday-region-search')).toBeVisible();
});

When('I search the holiday regions for {string}', async function (this: World, query: string) {
  await this.page.getByTestId('holiday-region-search').fill(query);
});

Then('the holiday regions offer {string}', async function (this: World, name: string) {
  await expect(region(this, name)).toBeVisible();
});

Then('the holiday regions do not offer {string}', async function (this: World, name: string) {
  await expect(region(this, name)).toHaveCount(0);
});

When('I choose the holiday region {string}', async function (this: World, name: string) {
  await region(this, name).click();
});

Then('the holiday variants offered are {string}', async function (this: World, list: string) {
  const texts = () => sheet(this).getByTestId('holiday-variant').allInnerTexts();
  await expect.poll(async () => (await texts()).map((x) => x.trim()).join(', ')).toBe(list);
});

When('I add the holiday region {string} as {string}', async function (this: World, name: string, variant: keyof typeof VARIANTS) {
  await region(this, name).click();
  const added = answered(this, 'POST', /^\/api\/holiday-calendars$/);
  await sheet(this).locator(`[data-testid="holiday-variant"][data-variant="${VARIANTS[variant]}"]`).click();
  expect((await added).ok(), 'added').toBe(true);
  await expect(sheet(this)).toHaveCount(0);
});

When('I add the holiday region {string} without a question', async function (this: World, name: string) {
  const added = answered(this, 'POST', /^\/api\/holiday-calendars$/);
  await region(this, name).click();
  expect((await added).ok(), 'added').toBe(true);
  await expect(sheet(this)).toHaveCount(0);
});

Then('the Holidays section lists no holiday calendar', async function (this: World) {
  await expect(section(this)).toBeVisible();
  await expect(section(this).getByTestId('settings-row')).toHaveCount(1);
});

Then('the Holidays section lists the holiday calendar {string}', async function (this: World, name: string) {
  await expect(section(this).locator(`[data-testid="settings-row"][data-setting="${name}"]`)).toBeVisible();
});

When('I remove the holiday calendar', async function (this: World) {
  const removed = answered(this, 'DELETE', /^\/api\/holiday-calendars\/.+/);
  await this.page.getByTestId('holiday-calendar-remove').click();
  expect((await removed).status(), 'removed').toBe(204);
  await expect(section(this)).toBeVisible();
});

When('I switch the calendar off in its settings page', async function (this: World) {
  const control = this.page.getByTestId('settings-calendar-shown');
  if ((await control.getAttribute('aria-checked')) === 'true') {
    const saved = answered(this, 'PATCH', /^\/api\/calendars\/.+/);
    await control.click();
    expect((await saved).ok(), 'saved').toBe(true);
  }
  await expect(control).toHaveAttribute('aria-checked', 'false');
});

Then('{string} no longer has the holiday region {string} in Google', async function (this: World, email: string, name: string) {
  const id = await this.api.holidayId(codeOf(name), 'official');
  expect((await this.api.remoteCalendars(email)).some((c) => c.id === id)).toBe(false);
});
