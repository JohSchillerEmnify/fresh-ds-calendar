/** Navigation and view steps (STEPS.md "Navigation"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { View } from './parameters.js';
import { attr, tid, type World } from './support/world.js';
import { expectJoined, pathname } from './support/ui.js';

When('I open the app', async function (this: World) {
  await this.page.goto('/');
});

When('I open the path {string}', async function (this: World, path: string) {
  await this.page.goto(path);
});

When('I open the month view for {month}', async function (this: World, month: string) {
  await this.page.goto(`/month/${month}`);
  await this.settled(); // data loaded: later "Google ..." changes must not race the first fetch
});

When('I open the week view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/week/${date}`);
  await this.settled(); // data loaded: later "Google ..." changes must not race the first fetch
});

When('I open the day view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/day/${date}`);
  await this.settled(); // data loaded: later "Google ..." changes must not race the first fetch
});

/** Click a period navigation button and wait until the route changed. */
async function navigate(world: World, testId: string) {
  const before = world.page.url();
  // An open bottom sheet (e.g. an expanded task list) covers the toolbar; a user dismisses it first.
  if (await world.page.getByTestId('sheet-scrim').isVisible()) {
    await world.page.keyboard.press('Escape');
    await expect(world.page.getByTestId('sheet-scrim')).toHaveCount(0);
  }
  await world.page.getByTestId(testId).click();
  if (testId !== 'nav-today') await expect.poll(() => world.page.url()).not.toBe(before);
}

When('I go to the next period', async function (this: World) {
  await navigate(this, 'nav-next');
});

When('I go to the previous period', async function (this: World) {
  await navigate(this, 'nav-prev');
});

When('I go to today', async function (this: World) {
  await navigate(this, 'nav-today');
});

When('I switch to the {view} view', async function (this: World, view: View) {
  await this.page.getByTestId(`view-switch-${view}`).click();
  await expect(this.page.getByTestId(`${view}-view`)).toBeVisible();
});

When('I go back in the browser', async function (this: World) {
  await this.page.goBack();
});

When('I reload the page', async function (this: World) {
  await this.page.reload();
});

When('I click the day number of {date}', async function (this: World, date: string) {
  await this.byTestId('month-cell', attr('data-date', date)).getByTestId('month-cell-day-number').click();
});

When('I click empty space in the month cell of {date}', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  const box = (await cell.boundingBox())!;
  await cell.click({ position: { x: box.width - 6, y: box.height - 6 } }); // bottom-right corner: below any entries
});

When('I click the week header of {date}', async function (this: World, date: string) {
  await this.byTestId('week-header', attr('data-date', date)).click();
});

When('I tap the day {date} in the month view', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  if (this.testInfo.project.use.hasTouch) await cell.tap();
  else await cell.getByTestId('month-cell-day-number').click(); // desktop: a cell body does not open the day (A-E2)
});

Then('the {view} view is shown', async function (this: World, view: View) {
  await expect(this.page.getByTestId(`${view}-view`)).toBeVisible();
});

Then('the URL path is {string}', async function (this: World, path: string) {
  await expect.poll(() => pathname(this.page)).toBe(path);
});

Then('the period title is {string}', async function (this: World, title: string) {
  await expect(this.page.getByTestId('period-title')).toHaveText(title);
});

Then('the weekday headers are {string}', async function (this: World, list: string) {
  await expectJoined(this.page.getByTestId('month-weekday-header'), list);
});

Then('the month grid starts on {date} and ends on {date}', async function (this: World, first: string, last: string) {
  const cells = this.page.getByTestId('month-cell');
  await expect(cells.first()).toHaveAttribute('data-date', first);
  await expect(cells.last()).toHaveAttribute('data-date', last);
});

Then('{date} is shown as outside the current month', async function (this: World, date: string) {
  await expect(this.byTestId('month-cell', attr('data-date', date))).toHaveAttribute('data-outside-month', 'true');
});

Then('{date} is shown as inside the current month', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  await expect(cell).toBeVisible();
  await expect(cell).not.toHaveAttribute('data-outside-month', 'true');
});

Then('the week columns are {string}', async function (this: World, list: string) {
  await expectJoined(this.page.getByTestId('week-header'), list);
});

const TODAY_HOLDERS = ['month-cell', 'week-header', 'day-header', 'year-day'];
const todaySelector = (date?: string) =>
  TODAY_HOLDERS.map((t) => `${tid(t)}[data-today="true"]${date ? attr('data-date', date) : ''}`).join(', ');

Then('{date} is highlighted as today', async function (this: World, date: string) {
  await expect(this.page.locator(todaySelector(date)).first()).toBeVisible();
});

Then('exactly one day is highlighted as today', async function (this: World) {
  await expect(this.page.locator(TODAY_HOLDERS.map(tid).join(', ')).first()).toBeVisible();
  await expect(this.page.locator(todaySelector())).toHaveCount(1);
});

Then('no day is highlighted as today', async function (this: World) {
  // Wait until the view rendered its days, otherwise "none" would pass on an empty page.
  await expect(this.page.locator(TODAY_HOLDERS.map(tid).join(', ')).first()).toBeVisible();
  await expect(this.page.locator(todaySelector())).toHaveCount(0);
});

/** Computed mask of an element, `none` when absent (the WebKit-prefixed property counts too). */
const maskOf = (el: Element) => { const c = getComputedStyle(el); return c.maskImage && c.maskImage !== 'none' ? c.maskImage : c.webkitMaskImage; };

Then('the entries on {date} fade out towards the bottom of the month cell', async function (this: World, date: string) {
  const box = this.byTestId('month-cell', attr('data-date', date)).getByTestId('month-cell-entries');
  await expect.poll(() => box.evaluate(maskOf)).toContain('linear-gradient');
  // the last entry is cut off or at least reaches into the faded band (the bottom 18 px)
  const reaches = await box.evaluate((el) => {
    const last = el.lastElementChild!.getBoundingClientRect();
    return last.bottom > el.getBoundingClientRect().bottom - 18;
  });
  expect(reaches).toBe(true);
});

Then('the month cell of {date} shows no overflow count', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  await expect(cell.getByTestId('month-cell-more')).toHaveCount(0);
  expect(await cell.innerText()).not.toMatch(/\+\d|\bmore\b/);
});
