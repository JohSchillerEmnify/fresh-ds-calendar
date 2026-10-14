/** Labs zoom month steps (STEPS.md "Labs (`@labs`)": zoom month). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { World } from './support/world.js';

const view = (w: World) => w.byTestId('zoom-view');
const zoomOf = async (w: World) => Number(await view(w).getAttribute('data-zoom'));
const weight = async (w: World, name: 'times' | 'lists') => Number(await view(w).getAttribute(`data-${name}`));

When('I open the zoom month for {date}', async function (this: World, date: string) {
  await this.page.goto(`/zoom/${date}`);
  await expect(view(this)).toBeVisible();
  // the grid is there once the viewport is measured
  await expect(this.byTestId('zoom-cell').first()).toBeVisible();
});

Then('the zoom month shows {string}', async function (this: World, month: string) {
  await expect(view(this)).toHaveAttribute('data-month', month);
});

Then('the zoom month shows the whole month', async function (this: World) {
  await expect.poll(() => zoomOf(this)).toBe(1);
  await expect(this.byTestId('zoom-cell')).not.toHaveCount(0);
  // every cell of the grid is inside the viewport
  const port = (await this.byTestId('zoom-port').boundingBox())!;
  const cells = this.byTestId('zoom-cell');
  const last = (await cells.last().boundingBox())!;
  expect(last.x + last.width).toBeLessThanOrEqual(port.x + port.width + 1);
  expect(last.y + last.height).toBeLessThanOrEqual(port.y + port.height + 1);
});

Then('the zoom month cell of {date} has {int} entries', async function (this: World, date: string, n: number) {
  await expect(this.byTestId('zoom-cell', `[data-date="${date}"]`)).toHaveAttribute('data-count', String(n));
});

Then('the zoom month shows no start times', async function (this: World) {
  await expect(this.byTestId('zoom-time')).toHaveCount(0);
});

/** Presses the + button until the named detail has fully faded in (the zoom steps by a quarter, so a bounded loop reaches it). */
async function zoomUntil(world: World, name: 'times' | 'lists') {
  for (let i = 0; i < 14 && (await weight(world, name)) < 0.99; i++) {
    await world.byTestId('zoom-in').click();
    await expect.poll(() => zoomOf(world)).toBeGreaterThan(0);
  }
  expect(await weight(world, name)).toBeGreaterThanOrEqual(0.99);
}

When('I zoom the zoom month in until the start times show', async function (this: World) {
  await zoomUntil(this, 'times');
});

When('I zoom the zoom month in until the task list items show', async function (this: World) {
  await zoomUntil(this, 'lists');
});

Then('{string} shows its start time {string} in the zoom month', async function (this: World, title: string, time: string) {
  const row = view(this).locator(`[data-testid="zoom-entries"] .row:has([data-testid="event-chip"][data-title="${title}"])`);
  const t = row.locator('[data-testid="zoom-time"]');
  await expect(t).toHaveText(time);
  await expect(t).toBeVisible();
  await expect(t).toHaveAttribute('data-weight', '1.00');
});

Then('the task list {string} shows the item {string} in the zoom month', async function (this: World, title: string, item: string) {
  const card = view(this).locator(`[data-testid="tasklist-card"][data-title="${title}"]`).first();
  await expect(card.getByText(item, { exact: true })).toBeVisible();
});

When('I press the zoom in button of the zoom month', async function (this: World) {
  const before = await zoomOf(this);
  await this.byTestId('zoom-in').click();
  await expect.poll(() => zoomOf(this)).toBeGreaterThan(before);
});

When('I press the zoom out button of the zoom month', async function (this: World) {
  const before = await zoomOf(this);
  await this.byTestId('zoom-out').click();
  await expect.poll(() => zoomOf(this)).toBeLessThan(before);
});

Then('the zoom month is zoomed in', async function (this: World) {
  await expect.poll(() => zoomOf(this)).toBeGreaterThan(1.01);
});

When('I zoom the zoom month in with Ctrl+wheel', async function (this: World) {
  const before = await zoomOf(this);
  // the wheel event goes to the viewport, as a trackpad pinch (Ctrl+wheel) does
  await this.byTestId('zoom-port').evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => zoomOf(this)).toBeGreaterThan(before);
  // the zoom is committed (and remembered) a moment after the last wheel event
  await expect.poll(() => this.page.evaluate(() => Number(sessionStorage.getItem('cal.zoomMonth')))).toBeGreaterThan(before);
});

When('I tap the day number {date} in the zoom month', async function (this: World, date: string) {
  await this.byTestId('zoom-cell', `[data-date="${date}"]`).locator('[data-testid="zoom-cell-number"]').click();
});

When('I zoom the zoom month in to the largest zoom', async function (this: World) {
  for (let i = 0; i < 14 && (await this.byTestId('zoom-in').isEnabled()); i++) {
    const before = await zoomOf(this);
    await this.byTestId('zoom-in').click();
    await expect.poll(() => zoomOf(this)).toBeGreaterThan(before);
  }
  await expect(this.byTestId('zoom-in')).toBeDisabled();
  // the detail layers settle after the layout of the new zoom
  await expect.poll(() => weight(this, 'lists')).toBeGreaterThanOrEqual(0.99);
});

Then('the title of the task list {string} is on top in the zoom month', async function (this: World, title: string) {
  const titles = view(this).locator(`[data-testid="tasklist-card"][data-title="${title}"] [data-testid="tasklist-card-title"]`);
  // the big cell is larger than the screen and the zoom buttons zoom about the middle: pan (wheel) until the title is inside the port
  const port = (await this.byTestId('zoom-port').boundingBox())!;
  await this.page.mouse.move(port.x + port.width / 2, port.y + port.height / 2);
  for (let i = 0; i < 8; i++) {
    const r = await titles.last().boundingBox();
    const dx = r ? r.x + 20 - (port.x + port.width / 2) : 0;
    const dy = r ? r.y + r.height / 2 - (port.y + port.height / 2) : 0;
    if (Math.abs(dx) < port.width / 2 - 30 && Math.abs(dy) < port.height / 2 - 30) break;
    await this.page.mouse.wheel(dx, dy);
    await this.page.waitForTimeout(200);
  }
  // some title of this list is what a tap at the middle of the title hits (the others are hidden layers)
  await expect.poll(() => titles.evaluateAll((els) => els.some((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && !!hit && el.closest('[data-testid="tasklist-card"]')!.contains(hit);
  }))).toBe(true);
});

/** Box of the block of an event in the zoom month's day timeline. */
const blockBox = async (w: World, title: string) => {
  const el = view(w).locator(`[data-testid="zoom-timeline"] [data-testid="event-chip"][data-title="${title}"]`).first();
  await expect(el).toBeVisible();
  return (await el.boundingBox())!;
};

Then('{string} is drawn lower than {string} in the zoom month', async function (this: World, lower: string, upper: string) {
  expect((await blockBox(this, lower)).y).toBeGreaterThan((await blockBox(this, upper)).y);
});

Then('the zoom month heights of {string} and {string} are proportional to their durations', async function (this: World, a: string, b: string) {
  // "Abend zu zweit" lasts 17:15-21:30 (255 min), "Late show" 19:00-22:00 (180 min)
  const ratio = (await blockBox(this, a)).height / (await blockBox(this, b)).height;
  expect(ratio).toBeGreaterThan((255 / 180) * 0.9);
  expect(ratio).toBeLessThan((255 / 180) * 1.1);
});
