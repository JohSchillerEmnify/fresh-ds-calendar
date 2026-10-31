/** Two-row week overview steps (STEPS.md "Two-row week overview"). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import { box, pathname, viewport } from './support/ui.js';
import type { World } from './support/world.js';

const chipIn = (scope: Locator, title: string) => scope.locator(`[data-testid="event-chip"][data-title="${title}"]`);
const overview = (w: World) => w.byTestId('week-view');
const day = (w: World, date: string) => w.byTestId('week-day-column', `[data-date="${date}"]`);
const rowOf = (w: World, row: number) => w.byTestId('week-overview-row', `[data-row="${row}"]`);
const tapOrClick = (w: World, loc: Locator) => (w.testInfo.project.use.hasTouch ? loc.tap() : loc.click());

/** The dates of the day columns in one row (0 = top, 1 = bottom). */
async function rowDates(w: World, row: number): Promise<string[]> {
  const days = rowOf(w, row).locator('[data-testid="week-day-column"]');
  await expect(days.first()).toBeVisible();
  return days.evaluateAll((els) => els.map((e) => e.getAttribute('data-date') ?? ''));
}
/** Asserts that the week's days `from` to `to` (0 = first day) are exactly the columns of `row`. */
async function expectRow(w: World, row: number, from: number, to: number) {
  const start = await w.weekStart();
  const want = Array.from({ length: to - from + 1 }, (_, i) => addDays(start, from + i));
  expect(await rowDates(w, row)).toEqual(want);
}

Given('the two-row week overview is on', async function (this: World) {
  await this.api.patch('/api/prefs', { weekTwoRow: true });
});
Given('the split is set to three days on top', async function (this: World) {
  await this.api.patch('/api/prefs', { weekTwoRowTop: 3 });
});
When('I open the week of {date} on a phone', async function (this: World, date: string) {
  await this.page.setViewportSize({ width: 375, height: 812 });
  await this.page.goto(`/week/${date}`);
  await this.settled();
});

Then('all seven days are laid out in two rows', async function (this: World) {
  const rows = this.byTestId('week-overview-row');
  await expect(rows).toHaveCount(2);
  await expect(this.byTestId('week-day-column')).toHaveCount(7);
  expect((await box(rows.nth(1))).y).toBeGreaterThan((await box(rows.nth(0))).y);
});
Then('I see both {string} and {string} without scrolling', async function (this: World, a: string, b: string) {
  const vp = viewport(this.page);
  for (const title of [a, b]) {
    const r = await box(chipIn(overview(this), title));
    expect(r.y, `${title} top`).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height, `${title} bottom`).toBeLessThanOrEqual(vp.height);
  }
  // each TimeGrid row clips internally, so the window itself must not scroll
  const clipped = await this.page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(clipped).toBeLessThanOrEqual(1);
});

Then('I see {string}', async function (this: World, title: string) {
  const target = overview(this).locator(`[data-title="${title}"]`).locator('visible=true').first();
  await expect(target).toBeVisible();
});

Then('Monday to Thursday are on the top row', async function (this: World) { await expectRow(this, 0, 0, 3); });
Then('Friday to Sunday are on the bottom row', async function (this: World) { await expectRow(this, 1, 4, 6); });
Then('Monday to Wednesday are on the top row', async function (this: World) { await expectRow(this, 0, 0, 2); });
Then('Thursday to Sunday are on the bottom row', async function (this: World) { await expectRow(this, 1, 3, 6); });

const heightOf = async (w: World, title: string) => (await box(chipIn(overview(w), title))).height;
Then('{string} is about {int} times as tall as {string}', async function (this: World, a: string, n: number, b: string) {
  const ratio = (await heightOf(this, a)) / (await heightOf(this, b));
  expect(ratio).toBeGreaterThan(n * 0.85);
  expect(ratio).toBeLessThan(n * 1.15);
});

Then("every day spans the same hours, from the week's earliest entry to its latest", async function (this: World) {
  // both rows share one fit window: the earliest entry sits flush to the top of row 0's visible area
  const scroll = rowOf(this, 0).locator('.scroll');
  const chip = chipIn(rowOf(this, 0), 'Standup');
  expect(Math.abs((await box(chip)).y - (await box(scroll)).y)).toBeLessThanOrEqual(6);
  const labels = (row: number) => rowOf(this, row).locator('[data-testid="time-axis"] .hl').allTextContents();
  expect(await labels(1)).toEqual(await labels(0));
});
Then('no empty hours are shown before {string} or after {string}', async function (this: World, first: string, last: string) {
  const f = chipIn(rowOf(this, 0), first);
  const fs = rowOf(this, 0).locator('.scroll');
  expect(Math.abs((await box(f)).y - (await box(fs)).y)).toBeLessThanOrEqual(6);
  const l = chipIn(rowOf(this, 1), last);
  const ls = rowOf(this, 1).locator('.scroll');
  const lb = await box(l);
  const sb = await box(ls);
  expect(Math.abs(sb.y + sb.height - (lb.y + lb.height))).toBeLessThanOrEqual(6);
});

When('I tap {string}', async function (this: World, title: string) {
  // a task list is a tasklist-card, anything else an event chip
  const card = this.taskCard(title);
  const target = (await card.count()) > 0 ? card : this.eventChip(title);
  await tapOrClick(this, target);
});
Then('{string} expands in place and shows {string}', async function (this: World, title: string, item: string) {
  const open = this.byTestId('tasklist-expanded', '[data-presentation="overlay"]');
  await expect(open).toBeVisible();
  await expect(open).toContainText(title);
  await expect(open).toContainText(item);
});
Then('the week is still shown behind it, not replaced by a separate sheet', async function (this: World) {
  await expect(this.byTestId('week-view')).toBeVisible();
  await expect(this.byTestId('tasklist-expanded', '[data-presentation="sheet"]')).toHaveCount(0);
});
Then('the event {string} opens', async function (this: World, _title: string) {
  await expect(this.byTestId('event-dialog')).toBeVisible();
});
When('I tap the empty area of {date}', async function (this: World, date: string) {
  const slot = day(this, date).locator('[data-testid="time-slot"]').last();
  await tapOrClick(this, slot);
});
Then('the day view for {date} opens', async function (this: World, date: string) {
  await expect(this.byTestId('day-view')).toBeVisible();
  await expect.poll(() => pathname(this.page)).toBe(`/day/${date}`);
});

Then('{string} is in the all-day band of {date}, above the timed entries', async function (this: World, title: string, date: string) {
  const trip = chipIn(this.byTestId('week-allday-cell', `[data-date="${date}"]`), title);
  await expect(trip).toHaveCount(1);
  const timed = day(this, date).locator('[data-testid="event-chip"]');
  await expect(timed.first()).toBeVisible();
  expect((await box(trip)).y + (await box(trip)).height).toBeLessThanOrEqual((await box(timed.first())).y + 1);
});

Then('the seven days are side by side in a single row', async function (this: World) {
  await expect(this.byTestId('week-overview-row')).toHaveCount(0);
  const heads = this.byTestId('week-header');
  await expect(heads).toHaveCount(7);
  const tops = await heads.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

Given('tapping a task list grows it in place', async function (this: World) {
  await this.api.patch('/api/prefs', { taskOpen: 'inline' });
});
Given('tapping a task list opens the list sheet', async function (this: World) {
  await this.api.patch('/api/prefs', { taskOpen: 'drawer' });
});
