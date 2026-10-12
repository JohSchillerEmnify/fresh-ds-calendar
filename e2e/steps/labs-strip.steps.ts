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
  await expect(column(this, date).locator(`[data-testid="event-chip"][data-title="${title}"]`)).toBeVisible();
});

When('I scroll the strip one day to the right', async function (this: World) {
  await this.byTestId('strip').evaluate((el) => {
    const w = el.firstElementChild!.getBoundingClientRect().width;
    el.scrollBy({ left: w });
  });
});

Then('the strip column of {date} is in front', async function (this: World, date: string) {
  await expect
    .poll(async () => {
      const s = await this.byTestId('strip').boundingBox();
      const c = await column(this, date).boundingBox();
      return s && c ? Math.abs(c.x - s.x) <= 8 : false;
    })
    .toBe(true);
});

Then('the page did not reload', async function (this: World) {
  expect(await this.page.evaluate(() => (window as unknown as { __stripNoReload?: boolean }).__stripNoReload)).toBe(true);
});
