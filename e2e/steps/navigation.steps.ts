/** Navigation and view steps (STEPS.md "Navigation"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { View } from './parameters.js';
import { attr, tid, type World } from './support/world.js';
import { expectJoined, goToPeriod, pathname } from './support/ui.js';

When('I open the app', async function (this: World) {
  // the app checks in on first open in the background (plant, streak): a later server read waits for it
  this.firstCheckIn = this.page
    .waitForResponse((r) => new URL(r.url()).pathname === '/api/streak/checkin', { timeout: 15_000 })
    .catch(() => undefined);
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

/** Dismiss what covers the toolbar, then move: Today by its button, next and previous as a person does (`goToPeriod`). */
async function navigate(world: World, testId: 'nav-next' | 'nav-prev' | 'nav-today') {
  // An open bottom sheet (e.g. an expanded task list) covers the toolbar; a user dismisses it first.
  if (await world.page.getByTestId('sheet-scrim').isVisible()) {
    await world.page.keyboard.press('Escape');
    await expect(world.page.getByTestId('sheet-scrim')).toHaveCount(0);
  }
  if (testId === 'nav-today') return world.page.getByTestId(testId).click();
  await goToPeriod(world.page, testId === 'nav-next' ? 'next' : 'prev');
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
  await cell.click({ position: { x: box.width - 6, y: 6 } }); // top-right corner, beside the day number: a crowded cell has entries down to its bottom edge
});

When('I click the week header of {date}', async function (this: World, date: string) {
  await this.byTestId('week-header', attr('data-date', date)).click();
});

When('I tap the day {date} in the month view', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  if (this.testInfo.project.use.hasTouch) await cell.tap();
  else await cell.getByTestId('month-cell-day-number').click(); // desktop: a cell body does not open the day
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

const TODAY_HOLDERS = ['month-cell', 'week-header', 'year-day'];
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

Then('every entry in the month cell of {date} can be seen at least in part', async function (this: World, date: string) {
  const box = this.byTestId('month-cell', attr('data-date', date)).getByTestId('month-cell-entries');
  // the left-out entries are counted (`data-more`); every entry still built starts above the box's bottom edge, and the
  // first left-out one (2 px gap below the last built one) would have started at or below it: nothing visible is left out
  await expect.poll(() => box.evaluate((el) => {
    const bottom = el.getBoundingClientRect().bottom;
    const rects = [...el.querySelectorAll(':scope > [data-title]')].map((c) => c.getBoundingClientRect());
    return Number(el.getAttribute('data-more')) > 0 && rects.length > 0 && rects.every((r) => r.top < bottom)
      && rects[rects.length - 1].bottom + 2 >= bottom - 0.5;
  })).toBe(true);
});

Then('the month cell of {date} leaves out the entry {string}', async function (this: World, date: string, title: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  await expect(cell.locator(attr('data-title', title))).toHaveCount(0);
});

When('the browser window is {int} by {int} pixels wide and high', async function (this: World, width: number, height: number) {
  await this.page.setViewportSize({ width, height });
});

Then('the month cell of {date} shows its first entry', async function (this: World, date: string) {
  const box = this.byTestId('month-cell', attr('data-date', date)).getByTestId('month-cell-entries');
  // a visible entry: the container has room for a chip and the first entry starts inside it, above the faded band
  await expect.poll(() => box.evaluate((el) => {
    const first = el.firstElementChild?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return !!first && r.height >= 16 && first.top >= r.top - 1 && first.top < r.bottom - 10;
  })).toBe(true);
});

Then('the month cells stay unchanged for {int} seconds', async function (this: World, seconds: number) {
  // layout tiers (`data-tier`, `data-fit`, `data-fade`) and cell content must settle: a measuring loop flips them every frame
  await this.page.getByTestId('month-view').evaluate((root) => {
    const w = window as unknown as { __churn: string[] };
    w.__churn = [];
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'childList') w.__churn.push(`childList ${(r.target as Element).className}`);
        else if (r.attributeName?.startsWith('data-') && (r.target as Element).getAttribute(r.attributeName) !== r.oldValue) w.__churn.push(`${r.attributeName} ${r.oldValue} -> ${(r.target as Element).getAttribute(r.attributeName)}`);
      }
    }).observe(root, { subtree: true, childList: true, attributes: true, attributeOldValue: true });
  });
  await this.page.waitForTimeout(seconds * 1000);
  const churn = await this.page.evaluate(() => (window as unknown as { __churn: string[] }).__churn);
  expect(churn.slice(0, 5), `${churn.length} DOM changes while idle`).toEqual([]);
});
