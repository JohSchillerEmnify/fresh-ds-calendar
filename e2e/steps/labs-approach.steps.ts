/** Labs approach bar steps (STEPS.md "Labs"): the track that replaces the now card's "Next" line. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { World } from './support/world.js';
import { turnOnLabsSwitch } from './support/ui.js';

const items = (w: World) => w.page.getByTestId('now-card').getByTestId('approach-item');
const item = (w: World, title: string) => items(w).and(w.page.locator(`[data-title="${title}"]`));

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

When('I turn on the approach bar and open the week view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/week/${date}`);
  await this.settled();
  await turnOnLabsSwitch(this.page, 'settings-approach-bar');
  await expect(this.page).toHaveURL(new RegExp(`/week/${date}$`));
});

Then(
  'the approach bar shows {string}, {string} and {string} in this order',
  async function (this: World, a: string, b: string, c: string) {
    await expect(this.page.getByTestId('now-card').getByTestId('approach-now')).toBeVisible();
    // exactly these chips, ordered by distance from approach-now
    await expect.poll(async () => {
      const shown = await items(this).evaluateAll((els) => els.map((e) => ({ t: e.getAttribute('data-title'), x: e.getBoundingClientRect().left })));
      return shown.sort((p, q) => p.x - q.x).map((e) => e.t);
    }).toEqual([a, b, c]);
  },
);

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
