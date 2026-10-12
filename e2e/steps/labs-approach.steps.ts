/** Labs approach bar steps (STEPS.md "Labs"). */
import { expect } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import type { World } from './support/world.js';

const item = (w: World, title: string) => w.page.getByTestId('approach-item').and(w.page.locator(`[data-title="${title}"]`));

/** Distance in px between the approach-now marker and the item's left edge. */
async function distance(w: World, title: string): Promise<number> {
  const now = await w.page.getByTestId('approach-now').boundingBox();
  const it = await item(w, title).boundingBox();
  if (!now || !it) throw new Error('approach bar not visible');
  return it.x - now.x;
}

const before = new WeakMap<World, number>();

Given('the approach bar is on', async function (this: World) {
  await this.api.patch('/api/prefs', { approachBar: true });
});

Then('the approach bar shows {string} in {int} minutes', async function (this: World, title: string, minutes: number) {
  await expect(item(this, title)).toHaveAttribute('data-minutes', String(minutes));
  before.set(this, await distance(this, title));
});

Then('{string} is closer to now on the approach bar', async function (this: World, title: string) {
  const was = before.get(this);
  if (was === undefined) throw new Error('needs "the approach bar shows ..." first');
  // the server clock moved: make the app re-read it (a focus triggers a sync with config)
  await this.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => distance(this, title)).toBeLessThan(was - 1);
});
