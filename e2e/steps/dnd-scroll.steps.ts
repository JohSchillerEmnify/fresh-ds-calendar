/** Drag and drop while the time grid scrolls (STEPS.md "Drag and drop", draft): auto-scroll and mouse wheel. Mouse only. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box } from './support/ui.js';
import { tid, type World } from './support/world.js';

/** Time label of the drop indicator just before the drop ("HH:MM"). One worker, so a module variable is enough. */
let shownTime: string | null = null;

const centreY = async (w: World, sel: string) => {
  const b = await box(w.page.locator(sel).first());
  return b.y + b.height / 2;
};

When('I hold the event {string} at the bottom edge of the time grid for {int} ms', async function (this: World, title: string, ms: number) {
  const chip = this.eventChip(title);
  const b = await box(chip);
  const from = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 5) };
  const sc = await box(this.page.locator('[data-scroll-area]').first());
  const { mouse } = this.page;
  await mouse.move(from.x, from.y);
  await mouse.down();
  // inside the 56 px auto-scroll edge zone of the scroll container
  await mouse.move(from.x, sc.y + sc.height - 12, { steps: 10 });
  await this.page.waitForTimeout(ms);
  this.held = async () => {
    await mouse.up();
    this.held = undefined;
  };
});

When('I move the dragged event to the middle of the time grid', async function (this: World) {
  if (!this.held) throw new Error('nothing is picked up');
  const sc = await box(this.page.locator('[data-scroll-area]').first());
  const b = await box(this.page.locator('[data-dragging="true"]').first());
  await this.page.mouse.move(b.x + b.width / 2, sc.y + sc.height / 2, { steps: 5 });
});

When('I scroll the mouse wheel up by {int} pixels while dragging', async function (this: World, px: number) {
  if (!this.held) throw new Error('nothing is picked up');
  const scroller = this.page.locator('[data-scroll-area]').first();
  const before = await scroller.evaluate((e) => e.scrollTop);
  await this.page.mouse.wheel(0, -px);
  // the wheel must still scroll the grid during a drag
  await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeLessThan(before - px / 2);
});

Then('the dragged event is drawn on the drop indicator', async function (this: World) {
  // Centres, not tops: the lifted card is scaled about its centre. The spring may still be settling: poll.
  await expect
    .poll(async () => Math.abs((await centreY(this, '[data-dragging="true"]')) - (await centreY(this, tid('drop-indicator')))), { timeout: 3_000 })
    .toBeLessThan(4);
});

When('I drop the dragged event', async function (this: World) {
  if (!this.held) throw new Error('nothing is picked up');
  shownTime = await this.page.getByTestId('drop-indicator').first().getAttribute('data-time');
  const saved = this.page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/events\//.test(r.url()));
  await this.held();
  await saved;
});

Then('the event {string} starts at the time the drop indicator showed', async function (this: World, title: string) {
  expect(shownTime).toMatch(/^\d\d:\d\d$/);
  await expect(this.eventChip(title)).toHaveAttribute('data-start-time', shownTime!);
});
