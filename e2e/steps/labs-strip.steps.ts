/** Labs strip view steps (STEPS.md "Labs (`@labs`)": strip). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { World } from './support/world.js';

const column = (w: World, date: string) => w.byTestId('strip-column', `[data-date="${date}"]`);

When('I open the strip view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/strip/${date}`);
  await expect(column(this, date)).toBeVisible();
  // marker that a full page load would wipe
  await this.page.evaluate(() => { (window as unknown as { __stripNoReload: boolean }).__stripNoReload = true; });
});

Then('I see the event {string} in the strip column of {date}', async function (this: World, title: string, date: string) {
  // chips of a day live in its all-day cell or its time column, both tagged with the date
  await expect(this.byTestId('strip').locator(`[data-date="${date}"] [data-testid="event-chip"][data-title="${title}"]`)).toBeVisible();
});

When('I scroll the strip one day to the right', async function (this: World) {
  await this.byTestId('strip').evaluate((el) => {
    const w = el.querySelector('[data-testid="strip-column"]')!.getBoundingClientRect().width;
    el.scrollBy({ left: w });
  });
});

Then('the strip column of {date} is in front', async function (this: World, date: string) {
  await expect
    .poll(async () => {
      const s = await this.byTestId('strip').boundingBox();
      const c = await column(this, date).boundingBox();
      // the hour gutter (30px) sits left of the first day column
      return s && c ? Math.abs(c.x - s.x - 30) <= 8 : false;
    })
    .toBe(true);
});

Then('the page did not reload', async function (this: World) {
  expect(await this.page.evaluate(() => (window as unknown as { __stripNoReload?: boolean }).__stripNoReload)).toBe(true);
});

/** Rendered height of the event block inside the strip. */
async function heightOf(w: World, title: string): Promise<number> {
  const loc = w.byTestId('strip').locator(`[data-testid="event-chip"][data-title="${title}"]`);
  await expect(loc).toHaveCount(1);
  return (await loc.evaluate((e) => e.getBoundingClientRect().height));
}

Then('in the strip {string} is about {int} times as tall as {string}', async function (this: World, a: string, n: number, b: string) {
  const ratio = (await heightOf(this, a)) / (await heightOf(this, b));
  expect(ratio).toBeGreaterThan(n * 0.85);
  expect(ratio).toBeLessThan(n * 1.15);
});

Then("{string} is in the strip's all-day band", async function (this: World, title: string) {
  await expect(this.byTestId('strip-allday').locator(`[data-testid="event-chip"][data-title="${title}"]`)).toHaveCount(1);
});

/** Top edge of the 12:00 hour line of a strip column. */
const hourLineTop = async (w: World, date: string) => (await column(w, date).locator('[data-testid="strip-hour-line"][data-hour="12"]').boundingBox())!.y;

Then('the hour lines of the strip columns of {date} and {date} are at the same height', async function (this: World, a: string, b: string) {
  expect(Math.abs((await hourLineTop(this, a)) - (await hourLineTop(this, b)))).toBeLessThanOrEqual(1);
});

Then('the all-day bands of the strip columns of {date} and {date} are equally tall', async function (this: World, a: string, b: string) {
  const h = async (d: string) => (await this.byTestId('strip-allday', `[data-date="${d}"]`).boundingBox())!.height;
  expect(Math.abs((await h(a)) - (await h(b)))).toBeLessThanOrEqual(1);
});
