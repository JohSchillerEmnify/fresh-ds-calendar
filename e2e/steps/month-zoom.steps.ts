/** Zooming the month view (STEPS.md "Month zoom", feature month-zoom). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box, pathname, viewport } from './support/ui.js';
import { attr, type World } from './support/world.js';

/** The first day of the month the URL names (`/month/YYYY-MM`). */
const firstDay = (w: World): string => {
  const m = /\/month\/(\d{4}-\d{2})/.exec(pathname(w.page));
  if (!m) throw new Error(`not on a month URL: ${pathname(w.page)}`);
  return `${m[1]}-01`;
};

/** The month cell of the month's first day in the month on screen (not a swipe neighbour's grid). */
const firstCell = (w: World) => w.byTestId('month-cell', `${attr('data-date', firstDay(w))}:not([data-outside-month])`).first();

/** Height of one week row: the height of the month cell of the month's first day (all rows share it). */
async function rowHeight(w: World): Promise<number> {
  await expect(firstCell(w)).toBeVisible();
  return (await box(firstCell(w))).height;
}

/** Records, behind every app handler, whether the browser was asked to skip the default of zoom-like events. */
async function watchDefaults(w: World): Promise<void> {
  await w.page.evaluate(() => {
    const win = window as unknown as { __zoomEvents?: Array<{ type: string; prevented: boolean }> };
    win.__zoomEvents = [];
    for (const type of ['touchmove', 'wheel']) {
      window.addEventListener(type, (e) => {
        if (type === 'wheel' && !(e as WheelEvent).ctrlKey) return;
        if (type === 'touchmove' && (e as TouchEvent).touches.length < 2) return;
        win.__zoomEvents!.push({ type, prevented: e.defaultPrevented });
      }, { passive: true });
    }
  });
}

/** A two-finger pinch (CDP touch points, vertically around the middle of the month) from `fromGap` to `toGap` px. */
async function pinch(w: World, fromGap: number, toGap: number): Promise<void> {
  await watchDefaults(w);
  const area = await box(w.page.getByTestId('calendar-swipe-area'));
  const cx = Math.round(area.x + area.width / 2);
  const cy = area.y + area.height / 2;
  const cdp = await w.page.context().newCDPSession(w.page);
  try {
    const at = (gap: number) => [{ x: cx, y: Math.round(cy - gap / 2), id: 1 }, { x: cx, y: Math.round(cy + gap / 2), id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(fromGap) });
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await w.page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(fromGap + ((toGap - fromGap) * i) / steps) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
  // the zoom is committed once the fingers are lifted
  await expect(w.page.locator('[data-month-zooming="true"]')).toHaveCount(0);
}

When('I note the height of the week rows of the month view', async function (this: World) {
  this.monthRowBefore = await rowHeight(this);
});

When('I pinch out on the month view to twice the size', async function (this: World) {
  await pinch(this, 80, 160);
});

When('I pinch in on the month view to half the size', async function (this: World) {
  await pinch(this, 160, 80);
});

When('I zoom the month view in with Ctrl+wheel', async function (this: World) {
  await watchDefaults(this);
  const grid = this.page.locator('[data-testid="month-view"] [role="grid"]').first();
  const b = await box(grid);
  await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await this.page.keyboard.down('Control');
  try {
    await this.page.mouse.wheel(0, -300);
  } finally {
    await this.page.keyboard.up('Control');
  }
  await expect(this.page.locator('[data-month-zooming="true"]')).toHaveCount(0);
});

When('I scroll the month view down to {date}', async function (this: World, date: string) {
  const cell = this.byTestId('month-cell', `${attr('data-date', date)}:not([data-outside-month])`).first();
  await cell.scrollIntoViewIfNeeded();
  await expect(cell).toBeInViewport({ ratio: 0.5 });
});

When('I note the height of the top bar', async function (this: World) {
  this.topBarBefore = (await box(this.page.getByTestId('top-bar'))).height;
});

Then('the week rows of the month view are about twice as tall as noted', async function (this: World) {
  const before = this.monthRowBefore;
  if (before === undefined) throw new Error('no week row height was noted');
  await expect.poll(async () => (await rowHeight(this)) / before, { message: 'week row height relative to the noted one' }).toBeGreaterThanOrEqual(1.8);
  expect((await rowHeight(this)) / before).toBeLessThanOrEqual(2.2);
});

Then('the week rows of the month view are taller than noted', async function (this: World) {
  const before = this.monthRowBefore;
  if (before === undefined) throw new Error('no week row height was noted');
  await expect.poll(() => rowHeight(this)).toBeGreaterThan(before + 2);
});

Then('the week rows of the month view have their default height', async function (this: World) {
  const scroll = await this.page.getByTestId('month-view').first().getAttribute('data-scroll');
  let want: number;
  if (scroll === 'sideways') {
    // a fresh device: the weeks share the month's box, the whole month on one screen
    const port = this.page.locator('[data-testid="month-view"][data-scroll="sideways"]').first().getByTestId('month-scroll');
    const rows = await this.page.locator('[data-testid="month-view"][data-scroll="sideways"]').first().locator('.week').count();
    want = (await port.evaluate((el) => el.clientHeight)) / rows;
  } else {
    // the month list's fixed week height (ADR 0034)
    want = viewport(this.page).width < 768 ? 96 : 128;
  }
  await expect.poll(async () => Math.abs((await rowHeight(this)) - want), { message: `week row height vs default ${want}` }).toBeLessThanOrEqual(2);
});

Then('the month view shows {int} day columns across the screen', async function (this: World, n: number) {
  const week = firstCell(this).locator('xpath=..');
  const cells = week.locator('[role="gridcell"]');
  await expect(cells).toHaveCount(n);
  const first = await box(cells.first());
  const last = await box(cells.last());
  expect(Math.abs(last.x + last.width - first.x - viewport(this.page).width), 'the columns span the viewport').toBeLessThanOrEqual(2);
});

Then('the top bar is as tall as noted', async function (this: World) {
  const before = this.topBarBefore;
  if (before === undefined) throw new Error('no top bar height was noted');
  expect(Math.abs((await box(this.page.getByTestId('top-bar'))).height - before)).toBeLessThanOrEqual(1);
});

Then('the page itself is not zoomed', async function (this: World) {
  expect(await this.page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  const events = await this.page.evaluate(() => (window as unknown as { __zoomEvents?: Array<{ type: string; prevented: boolean }> }).__zoomEvents ?? []);
  expect(events.length, 'the gesture reached the page').toBeGreaterThan(0);
  expect(events.filter((e) => !e.prevented), 'every zoom event of the gesture is kept from the browser').toEqual([]);
});
