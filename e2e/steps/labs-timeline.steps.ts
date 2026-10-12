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

/** True when the timeline runs top to bottom (phone). */
async function isVertical(w: World): Promise<boolean> {
  return (await w.page.getByTestId('timeline-view').getAttribute('data-orientation')) === 'vertical';
}

/** Position along the timeline's axis of an item (start edge) or of the now marker. */
async function xOf(w: World, title: string | null): Promise<number> {
  const loc = title === null ? w.page.getByTestId('timeline-now') : w.page.locator(`[data-testid="timeline-item"][data-title="${title}"]`);
  await expect(loc.first()).toHaveCount(1);
  const b = await box(loc);
  return (await isVertical(w)) ? b.y : b.x;
}

Then('the timeline runs from top to bottom', async function (this: World) {
  await expect(this.page.getByTestId('timeline-view')).toHaveAttribute('data-orientation', 'vertical');
});

Then('the title of {string} on the timeline reads left to right in one line', async function (this: World, title: string) {
  const t = this.page.locator(`[data-testid="timeline-item"][data-title="${title}"] [data-testid="event-chip-title"]`);
  await expect(t).toHaveCount(1);
  const writing = await t.evaluate((e) => {
    const cs = getComputedStyle(e);
    return { mode: cs.writingMode, transform: cs.transform };
  });
  expect(writing.mode).toBe('horizontal-tb');
  expect(writing.transform).toBe('none');
  const b = await box(t);
  expect(b.width).toBeGreaterThan(b.height);
});

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

/** Rendered length of a timeline item along the timeline's axis. */
async function widthOf(w: World, title: string): Promise<number> {
  const loc = w.page.locator(`[data-testid="timeline-item"][data-title="${title}"]`);
  await expect(loc).toHaveCount(1);
  const b = await box(loc);
  return (await isVertical(w)) ? b.height : b.width;
}

Then('on the timeline {string} is about {int} times as long as {string}', async function (this: World, a: string, n: number, b: string) {
  const ratio = (await widthOf(this, a)) / (await widthOf(this, b));
  expect(ratio).toBeGreaterThan(n * 0.85);
  expect(ratio).toBeLessThan(n * 1.15);
});

Then('{string} is in the all-day band above the timed entries', async function (this: World, title: string) {
  const band = this.page.getByTestId('timeline-allday');
  const entry = band.locator(`[data-testid="timeline-item"][data-title="${title}"]`);
  await expect(entry).toHaveCount(1);
  const y = (await box(entry)).y;
  // Vertical: every day has its own band, so only the same day's timed entries count.
  const vertical = await isVertical(this);
  const date = await entry.getAttribute('data-date');
  const timed = this.page.locator(`[data-testid="timeline-item"]${vertical ? `[data-date="${date}"]` : ''}:not([data-testid="timeline-allday"] *)`);
  const ys = await timed.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y));
  if (!vertical) expect(ys.length).toBeGreaterThan(0);
  for (const t of ys) expect(y).toBeLessThan(t);
});
