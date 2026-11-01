/** Labs timeline view steps (STEPS.md "Labs": timeline). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box } from './support/ui.js';
import type { World } from './support/world.js';

When('I open the timeline view', async function (this: World) {
  await this.page.goto('/timeline');
  // `settled()` waits for a calendar view; here the axis itself and, when the calendar has entries, the first loaded one are the signal.
  await expect(this.page.getByTestId('timeline-now')).toBeVisible();
  if ((await this.api.remoteEvents()).length > 0) await expect(this.page.getByTestId('timeline-item').first()).toBeAttached();
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

Then('on the timeline {string} and {string} are side by side', async function (this: World, a: string, b: string) {
  const at = (t: string) => this.page.locator(`[data-testid="timeline-item"][data-title="${t}"]`);
  await expect(at(a)).toHaveCount(1);
  await expect(at(b)).toHaveCount(1);
  const [p, q] = [await box(at(a)), await box(at(b))];
  // they share some height (overlap in time) but no width (1 px tolerance for borders)
  expect(p.y < q.y + q.height && q.y < p.y + p.height, 'overlap vertically').toBe(true);
  expect(p.x + p.width <= q.x + 1 || q.x + q.width <= p.x + 1, 'do not overlap horizontally').toBe(true);
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

/** Scrolls the vertical timeline by `days` whole days (negative: back), letting the range grow at the edges in between. */
async function scrollDays(w: World, days: number): Promise<void> {
  const scroll = w.page.getByTestId('timeline-scroll');
  const dayH = (await box(w.page.getByTestId('timeline-day').first())).height;
  const step = Math.sign(days);
  for (let i = 0; i < Math.abs(days); i++) {
    await scroll.evaluate((el, dy) => { el.scrollTop += dy; }, step * dayH);
    // one frame for the scroll event and a grown range at the edge
    await w.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
}

When('I scroll the timeline {int} days ahead', async function (this: World, days: number) {
  await scrollDays(this, days);
});

When('I scroll the timeline {int} days back', async function (this: World, days: number) {
  await scrollDays(this, -days);
});

Then('{string} is visible on the timeline', async function (this: World, title: string) {
  const item = this.page.locator(`[data-testid="timeline-item"][data-title="${title}"]`);
  await expect(item).toHaveCount(1);
  const port = await box(this.page.getByTestId('timeline-scroll'));
  await expect
    .poll(async () => {
      const b = await item.boundingBox();
      if (!b) return 'no box';
      return b.y >= port.y - 1 && b.y + b.height <= port.y + port.height + 1 ? 'inside' : `item at ${b.y.toFixed(0)}..${(b.y + b.height).toFixed(0)}, scroller ${port.y.toFixed(0)}..${(port.y + port.height).toFixed(0)}`;
    })
    .toBe('inside');
});
