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
