/** Labs horizontal view steps (STEPS.md "Labs (`@labs`)": horizontal view). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { World } from './support/world.js';
import { touchDrag } from './support/ui.js';

const view = (w: World) => w.byTestId('htime-view');
const port = (w: World) => w.byTestId('htime-port');
const zoomOf = async (w: World, axis: 'x' | 'y') => Number(await view(w).getAttribute(`data-zoom-${axis}`));
/** The event chip or task list card with this title inside the view. */
const entry = (w: World, title: string) =>
  view(w).locator(`[data-testid="event-chip"][data-title="${title}"], [data-testid="tasklist-card"][data-title="${title}"]`);
type Box = { x: number; y: number; width: number; height: number; row: string | null };
const boxOf = async (l: Locator): Promise<Box> => {
  await expect(l).toHaveCount(1);
  return l.evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height, row: e.closest('[data-testid="htime-row"]')?.getAttribute('data-date') ?? null };
  });
};
/** Widths and row height noted before a zoom, per scenario world. */
const widths = new WeakMap<World, Record<string, number>>();
const rowHeights = new WeakMap<World, number>();

async function open(w: World, date: string, query = '') {
  await w.page.goto(`/horizontal/${date}${query}`);
  await expect(view(w)).toBeVisible();
  // the rows are there once the viewport is measured
  await expect(w.byTestId('htime-row').first()).toBeVisible();
}
When('I open the horizontal view for {date}', async function (this: World, date: string) { await open(this, date); });
When('I open the horizontal day view for {date}', async function (this: World, date: string) { await open(this, date, '?mode=day'); });

Then('the horizontal view shows {int} day rows', async function (this: World, n: number) {
  await expect(this.byTestId('htime-row')).toHaveCount(n);
});

Then('in the horizontal view {string} is left of {string} in the same row', async function (this: World, a: string, b: string) {
  const [x, y] = [await boxOf(entry(this, a)), await boxOf(entry(this, b))];
  expect(x.row).not.toBeNull();
  expect(x.row).toBe(y.row);
  expect(x.x + x.width).toBeLessThanOrEqual(y.x + 1);
});

Then('in the horizontal view {string} and {string} are in separate lanes of the same row', async function (this: World, a: string, b: string) {
  const [x, y] = [await boxOf(entry(this, a)), await boxOf(entry(this, b))];
  expect(x.row).toBe(y.row);
  // they overlap in time (x) and do not in y
  expect(x.x).toBeLessThan(y.x + y.width);
  expect(y.x).toBeLessThan(x.x + x.width);
  expect(x.y + x.height <= y.y + 1 || y.y + y.height <= x.y + 1).toBe(true);
});

When('I note the width of {string} in the horizontal view', async function (this: World, title: string) {
  widths.set(this, { ...widths.get(this), [title]: (await boxOf(entry(this, title))).width });
});

Then('{string} is wider in the horizontal view than noted', async function (this: World, title: string) {
  const before = widths.get(this)?.[title];
  expect(before).toBeGreaterThan(0);
  await expect.poll(async () => (await boxOf(entry(this, title))).width).toBeGreaterThan(before! * 1.05);
});

Then('in the horizontal view {string} is about {int} times as wide as {string}', async function (this: World, a: string, n: number, b: string) {
  const ratio = (await boxOf(entry(this, a))).width / (await boxOf(entry(this, b))).width;
  expect(ratio).toBeGreaterThan(n * 0.85);
  expect(ratio).toBeLessThan(n * 1.15);
});

When('I note the height of the day rows of the horizontal view', async function (this: World) {
  rowHeights.set(this, (await this.byTestId('htime-row').first().boundingBox())!.height);
});

Then('the day rows of the horizontal view are taller than noted', async function (this: World) {
  const before = rowHeights.get(this)!;
  await expect.poll(async () => (await this.byTestId('htime-row').first().boundingBox())!.height).toBeGreaterThan(before * 1.05);
});

/** A wheel event on the port, as a trackpad or mouse wheel sends it. */
const wheel = (w: World, init: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }) =>
  port(w).evaluate((el, i) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true, ...i }));
  }, init);

When('I zoom the horizontal view in time with Ctrl+wheel', async function (this: World) {
  const before = await zoomOf(this, 'x');
  await wheel(this, { deltaY: -300, ctrlKey: true });
  await expect.poll(() => zoomOf(this, 'x')).toBeGreaterThan(before);
  // the zoom is committed (and remembered) a moment after the last wheel event
  await expect.poll(() => this.page.evaluate(() => (JSON.parse(sessionStorage.getItem('cal.zoomHTime') ?? '{}') as { x?: number }).x ?? 0)).toBeGreaterThan(before);
});

When('I zoom the horizontal view in days with Alt+wheel', async function (this: World) {
  const [bx, by] = [await zoomOf(this, 'x'), await zoomOf(this, 'y')];
  await wheel(this, { deltaY: -300, altKey: true });
  await expect.poll(() => zoomOf(this, 'y')).toBeGreaterThan(by);
  // only the day height changed
  expect(await zoomOf(this, 'x')).toBe(bx);
});

When("I press the horizontal view's time zoom in button", async function (this: World) {
  await this.byTestId('htime-time-in').click();
});

When("I press the horizontal view's day zoom in button", async function (this: World) {
  await this.byTestId('htime-day-in').click();
});

Then('the horizontal view is zoomed in time', async function (this: World) {
  await expect.poll(() => zoomOf(this, 'x')).toBeGreaterThan(3.01);
});

/** Whether the axis label of the hour lies inside the viewport's horizontal span. */
async function hourShown(w: World, time: string): Promise<boolean> {
  const label = w.byTestId('htime-hour', `[data-hour="${Number(time.slice(0, 2))}"]`);
  if ((await label.count()) === 0) return false;
  const [l, p] = [(await label.boundingBox())!, (await port(w).boundingBox())!];
  return l.x >= p.x - 1 && l.x + l.width <= p.x + p.width + 1;
}
Then('the horizontal view does not show the hour {time}', async function (this: World, time: string) {
  expect(await hourShown(this, time)).toBe(false);
});
Then('the horizontal view shows the hour {time}', async function (this: World, time: string) {
  await expect.poll(() => hourShown(this, time)).toBe(true);
});

When('I scroll the horizontal view sideways', async function (this: World) {
  await wheel(this, { deltaX: 3000 });
});

When('I tap the day label {date} in the horizontal view', async function (this: World, date: string) {
  await this.byTestId('htime-day-label', `[data-date="${date}"]`).click();
});

/** Zooms the days with the button until it is disabled (the largest zoom). */
When('I zoom the horizontal view in days to the maximum', async function (this: World) {
  const btn = this.byTestId('htime-day-in');
  for (let i = 0; i < 12 && (await btn.isEnabled()); i++) await btn.click();
  await expect(btn).toBeDisabled();
});

Then('the horizontal view shows between {int} and {int} days on screen', async function (this: World, lo: number, hi: number) {
  const [p, r] = [(await port(this).boundingBox())!, (await this.byTestId('htime-row').first().boundingBox())!];
  expect(p.height / r.height).toBeGreaterThanOrEqual(lo - 0.05);
  expect(p.height / r.height).toBeLessThanOrEqual(hi + 0.05);
});

/** Left edge of the hour 00:00 label: it follows the pan of the time axis. */
const panX = async (w: World) => (await w.byTestId('htime-hour', '[data-hour="0"]').boundingBox())!.x;
const panNoted = new WeakMap<World, number>();
When('I note the scroll position of the horizontal view', async function (this: World) { panNoted.set(this, await panX(this)); });

When('I drag the horizontal view sideways with a finger', async function (this: World) {
  const p = (await port(this).boundingBox())!;
  const [x, y] = [p.x + p.width / 2, p.y + p.height / 2];
  await touchDrag(this.page, { x: x + 110, y }, { x: x - 110, y }, { durationMs: 150 });
});

Then('the horizontal view has panned', async function (this: World) {
  await expect.poll(async () => Math.abs((await panX(this)) - panNoted.get(this)!)).toBeGreaterThan(40);
});

Then('in the horizontal view the title of {string} is inside the viewport and inside its card', async function (this: World, title: string) {
  const card = entry(this, title);
  await expect(card).toHaveCount(1);
  // the title is pinned to the viewport's left edge once the card starts left of it
  await expect.poll(() => card.evaluate((c, vp) => {
    const t = c.querySelector('[data-testid$="-title"]')!.getBoundingClientRect();
    const [k, p] = [c.getBoundingClientRect(), (document.querySelector(vp) as HTMLElement).getBoundingClientRect()];
    const inside = (o: DOMRect, r: DOMRect) => o.left >= r.left - 1 && o.right <= r.right + 1;
    return k.left < p.left && inside(t, p) && inside(t, k) && t.width > 20;
  }, '[data-testid="htime-port"]')).toBe(true);
});
