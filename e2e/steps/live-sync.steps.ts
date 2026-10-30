/** Live sync steps (STEPS.md "Live sync", feature last-known-state rule "Live sync", ADR 0030). */
import { expect, type Locator, type Page } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { attr, type World } from './support/world.js';

/** "Within a second" in the scenarios: the 1 s target plus the tolerance of the assumption A7. */
const WITHIN_A_SECOND_MS = 2000;

/** The page of the other device ("the app is open on a second device"); the scenario's own page stays the current one. */
let second: Page | null = null;
/** Change lookups counted when the last "Google is not asked ..." step started. */
let lookupsBefore = 0;

const lookups = async (w: World): Promise<number> => (await w.api.get<{ count: number }>('/api/__test/remote/lookups')).count;
const chip = (page: Page, title: string, date: string): Locator => page.locator(`[data-testid="event-chip"]${attr('data-title', title)}${attr('data-date', date)}`).locator('visible=true').first();
const secondPage = (): Page => {
  if (!second) throw new Error('No "the app is open on a second device" step before');
  return second;
};
const checkedItem = (page: Page, itemTitle: string, title: string): Locator =>
  page.locator(`[data-testid="tasks-item"]${attr('data-title', title)}`).getByTestId('tasklist-item').and(page.locator(attr('data-title', itemTitle)));

/** Waits until the app has synced and holds its live connection, so a change made elsewhere cannot slip past it. */
async function ready(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => `${document.documentElement.dataset.deviceStore}/${document.documentElement.dataset.liveConnected}`), { timeout: 15_000 }).toBe('synced/true');
}

Given('the app is open on a second device', async function (this: World) {
  const context = await this.newDeviceContext();
  second = await context.newPage();
  await second.goto(new URL(this.page.url()).pathname);
  // the Canvas is a tab of the Tasks view, not an address of its own
  if (await this.page.getByTestId('tasks-canvas').isVisible()) await second.getByTestId('tasks-tab-canvas').click();
  await ready(second);
  // the worker controls the page only then are the lazy chunks (dialogs) kept for a later offline use, like on the first device
  await expect.poll(() => second!.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 15_000 }).toBe(true);
});

/** The page of the first device while "I switch to the second device" has made the other one current. */
let first: Page | null = null;

When('I switch to the second device', async function (this: World) {
  first ??= this.page;
  this.page = secondPage();
  this.context = this.page.context();
});

When('I switch back to the first device', async function (this: World) {
  if (!first) throw new Error('No "I switch to the second device" step before');
  this.page = first;
  this.context = first.context();
});

Then('the second device does not show the event {string}', async function (this: World, title: string) {
  await expect(secondPage().locator(`[data-testid="event-chip"]${attr('data-title', title)}`)).toHaveCount(0);
});

Then('within a second the second device shows the event {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(chip(secondPage(), title, date)).toBeVisible({ timeout: WITHIN_A_SECOND_MS });
});

Then('within a second the second device uses the dark theme', async function (this: World) {
  await expect(secondPage().locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: WITHIN_A_SECOND_MS });
});

Then('within a second the second device shows the Canvas area {string}', async function (this: World, name: string) {
  await expect(secondPage().locator(`[data-testid="canvas-area"]${attr('data-name', name)}`)).toBeVisible({ timeout: WITHIN_A_SECOND_MS });
});

Then('within a second I see the event {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(chip(this.page, title, date)).toBeVisible({ timeout: WITHIN_A_SECOND_MS });
});

Then('within {int} seconds I see the event {string} on {date}', async function (this: World, seconds: number, title: string, date: string) {
  this.extendTimeout(seconds * 1000);
  await expect(chip(this.page, title, date)).toBeVisible({ timeout: seconds * 1000 + 2000 });
});

Then('within a second the item {string} of the task list {string} in the Tasks view is ticked', async function (this: World, itemTitle: string, title: string) {
  await expect(checkedItem(this.page, itemTitle, title)).toHaveAttribute('data-done', 'true', { timeout: WITHIN_A_SECOND_MS });
});

Given('the server asks Google for changes every {int} seconds', async function (this: World, seconds: number) {
  await this.api.setConfig({ googlePollMs: seconds * 1000 });
});

Given('Google is not asked for changes during the next {int} seconds', async function (this: World, seconds: number) {
  this.extendTimeout(seconds * 1000);
  lookupsBefore = await lookups(this);
  await this.page.waitForTimeout(seconds * 1000);
  expect(await lookups(this), 'change lookups while no app is open').toBe(lookupsBefore);
});

Then('Google is asked for changes within {int} seconds', async function (this: World, seconds: number) {
  // the interval itself is the wait: one more second covers the baseline look the server takes first
  await expect.poll(() => lookups(this), { timeout: seconds * 1000 + 1000 }).toBeGreaterThan(lookupsBefore);
});

Given('the live connection is blocked', async function (this: World) {
  await this.context.route('**/api/events/stream', (route) => route.abort());
});
