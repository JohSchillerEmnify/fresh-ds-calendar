/** All-day row steps (STEPS.md "Header layout"): the row only when it has something to show, its switch only with task lists. */
import { expect } from '@playwright/test';
import { Then } from './fixtures.js';
import type { World } from './support/world.js';

/** The first (not fit) time grid: the day view or the week view. */
const grid = (w: World) => w.page.locator('.tg:not(.fit)').first();

Then('the all-day row is shown', async function (this: World) {
  const cell = grid(this).locator('[data-testid="day-allday-area"], [data-testid="week-allday-cell"]').first();
  await expect(cell).toBeVisible();
  await expect.poll(async () => (await cell.boundingBox())?.height ?? 0, { message: 'all-day row height' }).toBeGreaterThanOrEqual(18);
});

Then('the all-day row is not shown', async function (this: World) {
  await this.settled();
  await expect(grid(this)).toBeVisible();
  await expect.poll(() => grid(this).evaluate((g) => {
    const band = g.querySelector<HTMLElement>('.alldays');
    if (!band) return 0;
    const r = band.getBoundingClientRect();
    return getComputedStyle(band).visibility === 'hidden' ? 0 : r.height;
  }), { message: 'all-day band height' }).toBe(0);
});

Then('the tasks section switch is shown', async function (this: World) {
  await expect(grid(this).getByTestId('tasks-section-toggle')).toBeVisible();
});

Then('the tasks section switch is not shown', async function (this: World) {
  await this.settled();
  await expect(grid(this).getByTestId('tasks-section-toggle').locator('visible=true')).toHaveCount(0);
});
