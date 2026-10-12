/** Mobile layout and gesture steps (STEPS.md "Mobile"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box, touchDrag, viewport } from './support/ui.js';
import type { World } from './support/world.js';

Then('the page has no horizontal scroll', async function (this: World) {
  await this.settled();
  await expect
    .poll(() => this.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0);
});

async function expectAtBottom(world: World, loc: Locator) {
  const vh = viewport(world.page).height;
  const b = await box(loc);
  const bottom = b.y + b.height;
  expect(bottom, 'bottom edge within the lowest 120 px of the viewport').toBeGreaterThanOrEqual(vh - 120);
  expect(bottom, 'bottom edge inside the viewport').toBeLessThanOrEqual(vh + 1);
}

Then('the view switcher is at the bottom of the screen', async function (this: World) {
  await expectAtBottom(this, this.page.getByTestId('view-switcher'));
});

Then('the create button is at the bottom of the screen', async function (this: World) {
  await expectAtBottom(this, this.page.getByTestId('create-button'));
});

const TOUCH_TARGETS = [
  'nav-prev', 'nav-next', 'nav-today', 'view-switch-month', 'view-switch-week', 'view-switch-day', 'create-button',
];

Then(
  'the navigation, view switcher and create buttons are at least {int} by {int} pixels',
  async function (this: World, width: number, height: number) {
    for (const id of TOUCH_TARGETS) {
      const b = await box(this.page.getByTestId(id).first());
      expect.soft(b.width, `${id} width`).toBeGreaterThanOrEqual(width);
      expect.soft(b.height, `${id} height`).toBeGreaterThanOrEqual(height);
    }
  },
);

/** Swipe on calendar-swipe-area: horizontal 200 px / 150 ms, vertical 300 px. Waits for the route change if any. */
async function swipe(world: World, dx: number, dy: number) {
  const area = await box(world.page.getByTestId('calendar-swipe-area'));
  const cx = area.x + area.width / 2;
  const cy = area.y + Math.min(area.height / 2, 400);
  const before = world.page.url();
  await touchDrag(world.page, { x: cx - dx / 2, y: cy - dy / 2 }, { x: cx + dx / 2, y: cy + dy / 2 }, { durationMs: 150 });
  if (dx !== 0) await expect.poll(() => world.page.url(), { message: 'swipe changes the period' }).not.toBe(before);
}

When('I swipe left on the calendar', async function (this: World) {
  await swipe(this, -200, 0);
});

When('I swipe right on the calendar', async function (this: World) {
  await swipe(this, 200, 0);
});

When('I swipe up on the calendar', async function (this: World) {
  await swipe(this, 0, -300);
});

Then('the viewport meta tag contains {string}', async function (this: World, text: string) {
  await expect(this.page.locator('meta[name="viewport"]')).toHaveAttribute('content', new RegExp(escape(text)));
});

Then('the bottom bar reserves the safe-area inset at the bottom', async function (this: World) {
  await expect(this.page.getByTestId('bottom-bar')).toHaveAttribute('data-safe-area', 'true');
});

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
