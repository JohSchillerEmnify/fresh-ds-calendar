/** Year view and month picker steps (STEPS.md "Year view and month picker"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box, touchDrag } from './support/ui.js';
import { attr, type World } from './support/world.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December',
];

When('I open the year view for {int}', async function (this: World, year: number) {
  await this.page.goto(`/year/${year}`);
});

Then('the year view shows {int} months', async function (this: World, count: number) {
  await expect(this.page.getByTestId('year-view')).toBeVisible();
  await expect(this.page.getByTestId('year-month')).toHaveCount(count);
});

Then('the density of {date} in the year view is {int}', async function (this: World, date: string, density: number) {
  await expect(this.byTestId('year-day', attr('data-date', date))).toHaveAttribute('data-density', String(density));
});

When('I click the month {string} in the year view', async function (this: World, name: string) {
  const index = MONTHS.indexOf(name);
  if (index < 0) throw new Error(`Unknown month name "${name}"`);
  const month = this.page.locator(`[data-testid="year-month"][data-month$="-${String(index + 1).padStart(2, '0')}"]`);
  await expect(month).toBeVisible();
  // Click the month's name if it has one (a click on a day cell might open that day instead), else the tile itself.
  const title = month.getByText(name, { exact: true });
  await (((await title.count()) > 0 ? title.first() : month).click());
});

Then('the year view\'s {string} shows no circle for days of other months', async function (this: World, name: string) {
  const index = MONTHS.indexOf(name);
  if (index < 0) throw new Error(`Unknown month name "${name}"`);
  const month = this.page.locator(`[data-testid="year-month"][data-month$="-${String(index + 1).padStart(2, '0')}"]`);
  const out = month.getByTestId('year-day-out');
  await expect(out.first(), 'the month has leading or trailing cells').toBeAttached();
  const n = await out.count();
  for (let i = 0; i < n; i++) {
    const cell = out.nth(i);
    await expect(cell, `cell ${i + 1} has no density mark`).not.toHaveAttribute('data-density', /.*/);
    await expect(cell, `cell ${i + 1} has no number`).toHaveText('');
    await expect(cell, `cell ${i + 1} has no background`).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(cell, `cell ${i + 1} has no ring`).toHaveCSS('box-shadow', 'none');
  }
});

// --- month picker -------------------------------------------------------------------------------------------------

const picker = (w: World) => w.page.getByTestId('month-picker');
const pickerTitle = (w: World) => w.page.getByTestId('month-picker-title');

When('I open the month picker', async function (this: World) {
  // The title toggles the picker (STEPS.md), so closing it with this step is valid: no visibility assertion here.
  await this.page.getByTestId('period-title').click();
});

Then('the month picker is open', async function (this: World) {
  await expect(picker(this)).toBeVisible();
});

Then('the month picker is closed', async function (this: World) {
  await expect(picker(this)).toBeHidden();
});

Then('the month picker shows {string}', async function (this: World, title: string) {
  await expect(pickerTitle(this)).toHaveText(title);
});

/** Run a navigation action and wait for the picker title to change. */
async function changeMonth(world: World, act: () => Promise<void>) {
  const before = await pickerTitle(world).innerText();
  await act();
  await expect(pickerTitle(world)).not.toHaveText(before);
}

When('I go to the next month in the month picker', async function (this: World) {
  await changeMonth(this, () => this.page.getByTestId('month-picker-next').click());
});

When('I go to the previous month in the month picker', async function (this: World) {
  await changeMonth(this, () => this.page.getByTestId('month-picker-prev').click());
});

/** Horizontal swipe across the picker (touch where available, else mouse drag). */
async function swipePicker(world: World, dx: number) {
  const b = await box(picker(world));
  const y = b.y + b.height / 2;
  const from = { x: b.x + b.width / 2 - dx / 2, y };
  const to = { x: b.x + b.width / 2 + dx / 2, y };
  await changeMonth(world, async () => {
    if (world.testInfo.project.use.hasTouch) return touchDrag(world.page, from, to, { durationMs: 150 });
    await world.page.mouse.move(from.x, from.y);
    await world.page.mouse.down();
    // a quick flick, like the touch swipe (each step is a round trip, ~60 ms on a busy machine)
    await world.page.mouse.move(to.x, to.y, { steps: 2 });
    await world.page.mouse.up();
  });
}

When('I slowly drag left with the mouse in the month picker', async function (this: World) {
  const b = await box(picker(this));
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await changeMonth(this, async () => {
    await this.page.mouse.move(x + 100, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x, y, { steps: 2 });
    await this.page.waitForTimeout(900);
    await this.page.mouse.move(x - 100, y, { steps: 2 });
    await this.page.mouse.up();
  });
});

When('I swipe left in the month picker', async function (this: World) {
  await swipePicker(this, -200);
});

When('I swipe right in the month picker', async function (this: World) {
  await swipePicker(this, 200);
});

const pickerDay = (w: World, date: string) => w.byTestId('picker-day', attr('data-date', date));

When('I pick {date} in the month picker', async function (this: World, date: string) {
  await pickerDay(this, date).click();
});

Then('{date} is selected in the month picker', async function (this: World, date: string) {
  await expect(pickerDay(this, date)).toHaveAttribute('aria-selected', 'true');
});

Then('{date} is marked as having items in the month picker', async function (this: World, date: string) {
  await expect(pickerDay(this, date)).toHaveAttribute('data-has-items', 'true');
});

Then('{date} is not marked as having items in the month picker', async function (this: World, date: string) {
  await expect(pickerDay(this, date)).toBeVisible();
  await expect(pickerDay(this, date)).not.toHaveAttribute('data-has-items', 'true');
});

When('I drag up and down inside the month picker', async function (this: World) {
  const b = await box(this.page.getByTestId('month-picker').locator('.grid'));
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await touchDrag(this.page, { x, y }, { x, y: y - 150 }, { durationMs: 300 });
  await touchDrag(this.page, { x, y: y - 150 }, { x, y }, { durationMs: 300 });
});

Then('the page is not scrolled', async function (this: World) {
  const m = await this.page.evaluate(() => {
    const e = document.scrollingElement!;
    return { top: e.scrollTop, over: e.scrollHeight - window.innerHeight };
  });
  expect(m).toEqual({ top: 0, over: 0 });
});

Then('the bottom bar ends at the bottom of the viewport', async function (this: World) {
  const b = await box(this.page.getByTestId('bottom-bar'));
  const h = await this.page.evaluate(() => window.innerHeight);
  expect(Math.abs(b.y + b.height - h)).toBeLessThanOrEqual(1);
});
