/** Approaching card and approach bar steps (STEPS.md "Labs"): the track that replaces the card's "Next" line. */
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

Given('the approaching track is off', async function (this: World) {
  await this.api.patch('/api/prefs', { approachBar: false });
});

/** Opens the settings page (from the app's start page when no page is open yet). */
async function openSettings(w: World) {
  if (!w.page.url().startsWith('http')) {
    await w.page.goto('/');
    await w.calendarShown();
  }
  await w.page.getByTestId('settings-button').click();
  await expect(w.page.getByTestId('settings-view')).toBeVisible();
}

const prefsSaved = (w: World) =>
  w.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');

When('I set the approaching window to {int} hours in the settings', async function (this: World, hours: number) {
  await openSettings(this);
  const field = this.page.getByTestId('settings-approach-window-custom');
  await field.fill(String(hours));
  const saved = prefsSaved(this);
  await field.press('Enter');
  expect((await saved).status(), 'prefs saved').toBe(200);
  await this.page.getByTestId('settings-back').click();
});

When('I switch off the Approaching card in the settings', async function (this: World) {
  await openSettings(this);
  const control = this.page.getByTestId('settings-approaching-card');
  await expect(control).toHaveAttribute('aria-checked', 'true');
  const saved = prefsSaved(this);
  await control.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
  await this.page.getByTestId('settings-back').click();
});

Then('I do not see the Approaching card', async function (this: World) {
  await expect(this.page.getByTestId('now-card')).toHaveCount(0);
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

Given('the approach bar is on with a window of {int} hours', async function (this: World, hours: number) {
  await this.api.patch('/api/prefs', { approachBar: true, approachWindowHours: hours });
});

Then('the approach bar shows {string} at its end', async function (this: World, title: string) {
  await expect(items(this)).toHaveCount(1);
  await expect(item(this, title)).toHaveAttribute('data-at-end', 'true');
  // its left edge is in the last quarter of the track
  await expect.poll(async () => {
    const bar = await this.page.getByTestId('now-card').getByTestId('approach-bar').boundingBox();
    const it = await item(this, title).boundingBox();
    if (!bar || !it) return -1;
    return (it.x - bar.x) / bar.width;
  }).toBeGreaterThanOrEqual(0.75);
});

Then('the approach bar shows {string} and {string}', async function (this: World, a: string, b: string) {
  await expect.poll(async () => (await items(this).evaluateAll((els) => els.map((e) => e.getAttribute('data-title')))).sort()).toEqual([a, b].sort());
});

/** Width in px of an entry's block on the approach bar (NaN while it is not shown, so a poll keeps trying). */
async function blockWidth(w: World, title: string): Promise<number> {
  return (await item(w, title).getByTestId('approach-block').boundingBox())?.width ?? NaN;
}

Then('on the approach bar {string} is {int} times as long as {string}', async function (this: World, a: string, n: number, b: string) {
  // factor N ± 10 %
  await expect.poll(async () => Math.abs((await blockWidth(this, a)) / (await blockWidth(this, b)) / n - 1)).toBeLessThanOrEqual(0.1);
});

Then('the title of {string} is shown next to its block', async function (this: World, title: string) {
  await expect(item(this, title)).toHaveAttribute('data-title-outside', 'true');
  const label = item(this, title).getByTestId('approach-title');
  await expect(label).toBeVisible();
  // the title's left edge is at or right of the block's right edge
  await expect.poll(async () => {
    const block = await item(this, title).getByTestId('approach-block').boundingBox();
    const text = await label.boundingBox();
    return block && text ? text.x - (block.x + block.width) : -1;
  }).toBeGreaterThanOrEqual(0);
});

/** Track scale in px per minute, from the first and last HH:MM tick (centred on their time). */
async function pxPerMinute(w: World): Promise<number> {
  const ticks = await w.page.getByTestId('now-card').getByTestId('approach-tick').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, label: e.textContent?.trim() ?? '' }; }));
  if (ticks.length < 2) return NaN;
  const min = (l: string) => Number(l.slice(0, 2)) * 60 + Number(l.slice(3, 5));
  const a = ticks[0], b = ticks[ticks.length - 1];
  const span = (((min(b.label) - min(a.label)) % 1440) + 1440) % 1440;
  return span > 0 ? (b.x - a.x) / span : NaN;
}

Then('on the approach bar {string} starts at now and shows {int} minutes', async function (this: World, title: string, minutes: number) {
  // the server clock may have moved: make the app re-read it (a focus triggers a sync with config)
  await this.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(item(this, title)).toHaveAttribute('data-running', 'true');
  // left edge of the block at the now dot (± 2 px; blocks start just right of the dot)
  await expect.poll(async () => {
    const now = await this.page.getByTestId('now-card').getByTestId('approach-now').boundingBox();
    const block = await item(this, title).getByTestId('approach-block').boundingBox();
    return now && block ? Math.abs(block.x - (now.x + now.width)) : NaN;
  }).toBeLessThanOrEqual(2);
  // width = N minutes on the track scale (± 10 %)
  await expect.poll(async () => Math.abs((await blockWidth(this, title)) / ((await pxPerMinute(this)) * minutes) - 1)).toBeLessThanOrEqual(0.1);
});
