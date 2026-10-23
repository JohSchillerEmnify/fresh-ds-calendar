/** Labs bedtime runway steps (STEPS.md "Labs (`@labs`)": runway). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { World } from './support/world.js';

const entry = (w: World, title: string): Locator => w.byTestId('runway-bar').locator(`[data-testid="runway-entry"][data-title="${title}"]`);
/** The rendered box of one runway entry. */
const boxOf = async (w: World, title: string) => {
  const l = entry(w, title);
  await expect(l).toHaveCount(1);
  return l.evaluate((e) => { const b = e.getBoundingClientRect(); return { y: b.y, height: b.height }; });
};
/** Heights noted before time passes, per scenario world. */
const heights = new WeakMap<World, Record<string, number>>();

When('I open the runway', async function (this: World) {
  await this.page.goto('/runway');
  await expect(this.byTestId('runway-view')).toBeVisible();
});

Then('the runway reads {string}', async function (this: World, text: string) {
  await expect(this.byTestId('runway-header')).toHaveText(text);
});

Then('the runway says {string}', async function (this: World, text: string) {
  await expect(this.byTestId('runway-message')).toHaveText(text);
});

Then('{string} is above {string} on the runway', async function (this: World, a: string, b: string) {
  // the bar is measured after the first render: wait until the entries have their size
  await expect.poll(async () => (await boxOf(this, b)).height).toBeGreaterThan(0);
  const [x, y] = [await boxOf(this, a), await boxOf(this, b)];
  expect(x.y + x.height).toBeLessThanOrEqual(y.y + 1);
});

When('I tap {string} on the runway', async function (this: World, title: string) {
  await entry(this, title).click();
});

Then('on the runway {string} is about {int} times as tall as {string}', async function (this: World, a: string, n: number, b: string) {
  // the bar is measured after the first render: wait until the entries have their size
  await expect.poll(async () => (await boxOf(this, b)).height).toBeGreaterThan(0);
  const ratio = (await boxOf(this, a)).height / (await boxOf(this, b)).height;
  expect(ratio).toBeGreaterThan(n * 0.85);
  expect(ratio).toBeLessThan(n * 1.15);
});

When('I note the height of {string} on the runway', async function (this: World, title: string) {
  await expect.poll(async () => (await boxOf(this, title)).height).toBeGreaterThan(0);
  heights.set(this, { ...heights.get(this), [title]: (await boxOf(this, title)).height });
});

Then('{string} is taller on the runway than noted', async function (this: World, title: string) {
  const before = heights.get(this)?.[title];
  expect(before).toBeGreaterThan(0);
  await expect.poll(async () => (await boxOf(this, title)).height).toBeGreaterThan(before! * 1.05);
});
