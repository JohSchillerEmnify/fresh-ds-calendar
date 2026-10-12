/** Labs timeline view steps (STEPS.md "Labs": timeline). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box } from './support/ui.js';
import type { World } from './support/world.js';

When('I open the timeline view', async function (this: World) {
  await this.page.goto('/timeline');
  // `settled()` waits for a calendar view; here the axis itself and the first loaded item are the signal.
  await expect(this.page.getByTestId('timeline-now')).toBeVisible();
  await expect(this.page.getByTestId('timeline-item').first()).toBeAttached();
});

/** Horizontal position of a timeline item (left edge) or of the now marker. */
async function xOf(w: World, title: string | null): Promise<number> {
  const loc = title === null ? w.page.getByTestId('timeline-now') : w.page.locator(`[data-testid="timeline-item"][data-title="${title}"]`);
  await expect(loc.first()).toHaveCount(1);
  return (await box(loc)).x;
}

Then('{string} comes before {string} on the timeline', async function (this: World, a: string, b: string) {
  expect(await xOf(this, a)).toBeLessThan(await xOf(this, b));
});

Then('the now marker is before {string} on the timeline', async function (this: World, title: string) {
  expect(await xOf(this, null)).toBeLessThan(await xOf(this, title));
});

Then(
  'on the timeline {string} is farther from {string} than {string} is from the now marker',
  async function (this: World, far: string, from: string, near: string) {
    const d = Math.abs((await xOf(this, far)) - (await xOf(this, from)));
    const n = Math.abs((await xOf(this, near)) - (await xOf(this, null)));
    expect(d).toBeGreaterThan(n);
  },
);
