/** Drag and drop steps (STEPS.md "Drag and drop"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import { iosFinger } from './support/iosTouch.js';
import { box, touchDrag, type Box } from './support/ui.js';
import type { View } from './parameters.js';
import { attr, tid, type ProbeWindow, type World } from './support/world.js';

interface Point { x: number; y: number }
const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const useTouch = (w: World) => !!w.testInfo.project.use.hasTouch;
/** iPhone project: WebKit has no touch moves in Playwright, a model of iOS WebKit is the finger (support/iosTouch.ts). */
const useIosModel = (w: World) => w.testInfo.project.use.browserName === 'webkit';

/** Finger down at `from`, held `holdMs` (0: no long press); the returned function lets go. */
async function fingerDown(w: World, from: Point, holdMs: number): Promise<{ move: (to: Point, steps: number, ms: number) => Promise<void>; up: () => Promise<void> }> {
  if (useIosModel(w)) {
    const f = iosFinger(w.page);
    if (holdMs) await f.press(from, holdMs, !w.stillFinger);
    else await f.down(from);
    let at = from;
    return {
      move: async (to, steps, ms) => { await f.moves(at, to, steps, ms); at = to; },
      up: () => f.up(),
    };
  }
  const cdp = await w.context.newCDPSession(w.page);
  const point = (p: Point) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  if (holdMs) await w.page.waitForTimeout(holdMs);
  let at = from;
  return {
    move: async (to, steps, ms) => {
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point({ x: at.x + ((to.x - at.x) * i) / steps, y: at.y + ((to.y - at.y) * i) / steps }) });
        await w.page.waitForTimeout(ms / steps);
      }
      at = to;
    },
    up: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await cdp.detach().catch(() => {});
    },
  };
}

async function hourHeight(w: World): Promise<number> {
  const grid = w.page.getByTestId('time-grid').first();
  await expect(grid).toHaveAttribute('data-hour-height', /\d/);
  return Number(await grid.getAttribute('data-hour-height'));
}

/**
 * Where to grab a card. In a time grid the grab point is 5 minutes below the card top (not the centre, see README
 * "assumptions"): the drop time is then the same whether the app positions by pointer or by card top, because
 * snapping to 15 minutes absorbs the offset. Elsewhere (month, all-day area) the centre is used.
 */
async function grabPoint(w: World, card: Locator): Promise<Point & { shift?: number }> {
  const b = await box(card);
  // A multi-day bar moves by (drop day - grabbed day): grab it in the middle of its first day, not at the day boundary.
  if (await isBar(card)) return { x: b.x + b.width / (2 * (await barDays(card))), y: b.y + b.height / 2 };
  const inGrid = (await card.locator('xpath=ancestor::*[@data-testid="week-day-column" or @data-testid="day-column"]').count()) > 0;
  if (!inGrid) return centre(b);
  const offset = Math.min(b.height / 2, (await hourHeight(w)) / 12);
  // a card whose top is hidden above the grid's visible part (short screen) is grabbed in its visible part
  const visibleTop = await card.evaluate((el) => {
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight && getComputedStyle(n).overflowY !== 'visible') return n.getBoundingClientRect().top;
    }
    return 0;
  });
  const y = b.y + offset < visibleTop + 2 ? Math.min(b.y + b.height - 2, visibleTop + offset) : b.y + offset;
  // shift: how much lower than the usual point the card was grabbed (a drop target has to move down by as much)
  return { x: b.x + b.width / 2, y, shift: y - (b.y + offset) };
}

const isBar = async (card: Locator) => (await card.getAttribute('data-testid')) === 'event-bar';

/** Number of days the bar segment spans (data-start/data-end are inclusive). */
async function barDays(bar: Locator): Promise<number> {
  const [s, e] = await Promise.all([bar.getAttribute('data-start'), bar.getAttribute('data-end')]);
  return Math.round((Date.parse(e!) - Date.parse(s!)) / 864e5) + 1;
}

/** Event element to grab: its chip, or its first visible multi-day bar segment when it is drawn as a bar. */
function eventHandle(w: World, title: string): Locator {
  return w.eventChip(title).or(w.eventBars(title).locator('visible=true').first()).first();
}

/** Point on the page for "{date}" [at "{time}"], relative to the card being dragged. */
async function targetPoint(w: World, card: Locator, from: Point, date: string, time?: string): Promise<Point> {
  if (time) {
    const [h, m] = time.split(':').map(Number);
    const slot = w.page.locator(
      [String(h), String(h).padStart(2, '0'), `${String(h).padStart(2, '0')}:00`]
        .map((v) => `${tid('time-slot')}${attr('data-date', date)}${attr('data-hour', v)}`)
        .join(', '),
    ).first();
    await slot.scrollIntoViewIfNeeded();
    const b = await box(slot);
    return { x: b.x + b.width / 2, y: b.y + (m / 60) * b.height + 1 };
  }
  const month = w.byTestId('month-cell', attr('data-date', date));
  if (await month.isVisible()) return centre(await box(month));
  const allDayCell = w.page.locator(`${tid('week-allday-cell')}${attr('data-date', date)}, ${tid('day-allday-area')}${attr('data-date', date)}`).first();
  const inAllDay = (await isBar(card)) || (await card.locator('xpath=ancestor::*[@data-testid="week-allday-cell" or @data-testid="day-allday-area"]').count()) > 0;
  if (inAllDay) return centre(await box(allDayCell));
  // Timed card moved to another day without a time: same height in that day's column.
  const col = await box(w.dayColumn(date));
  return { x: col.x + col.width / 2, y: from.y };
}

/** Press, move in 10 steps, release. Touch uses a 500 ms long press first. */
async function dragBetween(w: World, from: Point, to: Point) {
  if (useIosModel(w)) {
    const f = await fingerDown(w, from, 500);
    await f.move(to, 10, 300);
    await f.up();
    return;
  }
  if (useTouch(w)) {
    await touchDrag(w.page, from, to, { steps: 10, durationMs: 300, holdMs: 500 });
    return;
  }
  const { mouse } = w.page;
  await mouse.move(from.x, from.y);
  await mouse.down();
  await mouse.move(to.x, to.y, { steps: 10 });
  await mouse.up();
}

const isPersist = (url: string, method: string) => method === 'PATCH' && /\/api\/(events|tasklists)\//.test(url);

/** Drag a card and wait for its PATCH response and for it to settle (data-dragging gone). */
async function drag(
  w: World,
  card: Locator,
  target: (card: Locator, from: Point) => Promise<Point>,
  expectPersist = true,
) {
  // Both the card and the target must be on screen: scroll the grid so their midpoint is centred.
  const guess = centre(await box(card));
  const toFirst = await target(card, guess);
  const cardBox = await box(card);
  const mid = (cardBox.y + cardBox.height / 2 + toFirst.y) / 2;
  // scroll when the card is outside the viewport or outside its scroll container's visible part (a banner above the
  // grid on a short screen hides cards that are still inside the viewport)
  await card.evaluate((el, midY) => {
    const b = el.getBoundingClientRect();
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight && getComputedStyle(n).overflowY !== 'visible') {
        const r = n.getBoundingClientRect();
        if (b.top >= Math.max(0, r.top) && b.bottom <= Math.min(innerHeight, r.bottom)) return;
        n.scrollTop += midY - (r.top + r.height / 2);
        return;
      }
    }
  }, mid);
  // the target lookup may scroll its slot into view: settle that scroll before taking the grab point
  await target(card, centre(await box(card)));
  const { shift = 0, ...from } = await grabPoint(w, card);
  const t = await target(card, { x: from.x, y: from.y - shift });
  const to = { x: t.x, y: t.y + shift };
  const saved = expectPersist ? w.page.waitForResponse((r) => isPersist(r.url(), r.request().method())) : null;
  await dragBetween(w, from, to);
  await saved;
  await expect(w.page.locator(`${tid('event-chip')}[data-dragging], ${tid('tasklist-card')}[data-dragging]`)).toHaveCount(0);
}

When('I drag the event {string} to {date} at {time}', async function (this: World, title: string, date: string, time: string) {
  await drag(this, this.eventChip(title), (c, f) => targetPoint(this, c, f, date, time));
});

When('I drag the event {string} to {date}', async function (this: World, title: string, date: string) {
  await drag(this, eventHandle(this, title), (c, f) => targetPoint(this, c, f, date));
});

When('I drag the event {string} down by {int} minutes', async function (this: World, title: string, minutes: number) {
  const dy = (minutes / 60) * (await hourHeight(this));
  await drag(this, this.eventChip(title), async (_c, f) => ({ x: f.x, y: f.y + dy }));
});

When('I drag the task list {string} to {date}', async function (this: World, title: string, date: string) {
  await drag(this, this.taskCard(title), (c, f) => targetPoint(this, c, f, date));
});

When('I drag the task list {string} to {date} at {time}', async function (this: World, title: string, date: string, time: string) {
  await drag(this, this.taskCard(title), (c, f) => targetPoint(this, c, f, date, time));
});

When('I drag the event {string} back and forth {int} times', async function (this: World, title: string, times: number) {
  this.extendTimeout(times * 3_000);
  // A single-column day view (phone) has no neighbouring day to drop on: switch to the week view client-side
  // (no reload, so recorded memory baselines stay valid).
  if (await this.page.getByTestId('day-view').isVisible()) {
    await this.page.getByTestId('view-switch-week').click();
    await expect(this.page.getByTestId('week-view')).toBeVisible();
  }
  for (let i = 0; i < times; i++) {
    const chip = this.eventChip(title);
    const current = (await chip.getAttribute('data-date'))!;
    const next = addDays(current, i % 2 === 0 ? 1 : -1);
    await drag(this, chip, (c, f) => targetPoint(this, c, f, next));
    await expect(this.eventChip(title, next)).toBeVisible();
  }
});

/** Press and hold the event's chip (scrolled into view) and keep it held; "I release ..." lets go. */
async function pickUp(w: World, title: string) {
  const chip = w.eventChip(title);
  await chip.scrollIntoViewIfNeeded();
  const from = await grabPoint(w, chip);
  w.heldAt = from;
  if (useIosModel(w)) {
    const f = await fingerDown(w, from, 500);
    w.held = async () => {
      await f.up();
      w.held = undefined;
      w.heldAt = undefined;
    };
  } else if (useTouch(w)) {
    // Touch stays down: keep the CDP session until "I release the event without moving it".
    const cdp = await w.context.newCDPSession(w.page);
    const touch = [{ x: Math.round(from.x), y: Math.round(from.y), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch });
    w.held = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await cdp.detach().catch(() => {});
      w.held = undefined;
      w.heldAt = undefined;
    };
    await w.page.waitForTimeout(500);
  } else {
    const { mouse } = w.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await w.page.waitForTimeout(500);
    // A mouse drag starts after > 4 px of movement: wiggle sideways and return, so the net movement is zero.
    await mouse.move(from.x + 6, from.y, { steps: 2 });
    await mouse.move(from.x, from.y, { steps: 2 });
    w.held = async () => {
      await mouse.up();
      w.held = undefined;
      w.heldAt = undefined;
    };
  }
}

When('I pick up the event {string}', async function (this: World, title: string) {
  await pickUp(this, title);
});

When('I pick up the event {string} in the {view} view for {date}', async function (this: World, title: string, view: View, date: string) {
  if (view !== 'week' && view !== 'day') throw new Error(`picking up in the ${view} view needs a time grid (week or day)`);
  await this.page.goto(`/${view}/${date}`);
  await this.settled();
  await pickUp(this, title);
});

/**
 * STEPS.md "Drag helper cat": desktop mouse press on the card, move down in steps, keep the pointer down (released by
 * "I drop the dragged event"). The release time is kept in the page (`__dropAt`, native clock) for "is gone within".
 */
When('I pick up the event {string} and move it down by {int} hours', async function (this: World, title: string, hours: number) {
  const chip = this.eventChip(title);
  const from = await grabPoint(this, chip);
  const dy = hours * (await hourHeight(this));
  const { mouse } = this.page;
  await mouse.move(from.x, from.y);
  await mouse.down();
  await mouse.move(from.x, from.y + dy, { steps: 12 });
  await expect(this.eventChips(title).first()).toHaveAttribute('data-dragging', 'true');
  this.heldAt = from;
  this.held = async () => {
    await this.page.evaluate(() => { (window as unknown as { __dropAt?: number }).__dropAt = new Event('t').timeStamp; });
    await mouse.up();
    this.held = undefined;
    this.heldAt = undefined;
  };
});

When('I hold the dragged card still for {int} second(s)', async function (this: World, seconds: number) {
  if (!this.held) throw new Error('nothing is picked up');
  await this.page.waitForTimeout(seconds * 1000);
});

When('I release the event without moving it', async function (this: World) {
  if (!this.held) throw new Error('nothing is picked up');
  await this.held();
});

Then('the event {string} is lifted', async function (this: World, title: string) {
  await expect(this.eventChips(title).first()).toHaveAttribute('data-dragging', 'true');
});

/** STEPS.md "the finger is on the event": the card is lifted and, settled, still covers the point where it was pressed. */
Then('the finger is on the event {string}', async function (this: World, title: string) {
  const at = this.heldAt;
  if (!this.held || !at) throw new Error('nothing is picked up');
  const chip = this.eventChips(title).first();
  await expect(chip).toHaveAttribute('data-dragging', 'true');
  // the premise is a card that does not fill its column (side by side): a full-width card never moved sideways
  const col = await box(this.dayColumn((await chip.getAttribute('data-date'))!));
  expect((await box(chip)).width / col.width, `${title} is narrower than its day column`).toBeLessThan(0.9);
  // the lifted card springs to its target: wait until its box stops changing before judging where it is
  let last = '';
  await expect.poll(async () => {
    const b = await box(chip);
    const now = [b.x, b.y, b.width, b.height].map(Math.round).join(',');
    const settled = now === last;
    last = now;
    return settled;
  }, { timeout: 3_000, intervals: [150] }).toBe(true);
  const b = await box(chip);
  expect(at.x >= b.x && at.x <= b.x + b.width && at.y >= b.y && at.y <= b.y + b.height,
    `pressed at ${Math.round(at.x)},${Math.round(at.y)}, card at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`).toBe(true);
});

Then('the event {string} is not lifted', async function (this: World, title: string) {
  await expect(this.eventChips(title).first()).toBeVisible();
  await expect(this.eventChips(title).first()).not.toHaveAttribute('data-dragging', 'true');
});

Then('a haptic tick was requested', async function (this: World) {
  await expect
    .poll(async () => {
      const calls = await this.page.evaluate(() => (window as unknown as ProbeWindow).__haptics ?? []);
      return calls.some((c) => (Array.isArray(c) ? c : [c]).every((n) => n > 0 && n <= 30));
    }, { message: 'navigator.vibrate called with a duration <= 30 ms' })
    .toBe(true);
});

/** STEPS.md "I hold the event X over D": long press, move onto D's month cell, finger kept down. */
When('I hold the event {string} over {date}', async function (this: World, title: string, date: string) {
  if (!useTouch(this)) throw new Error('needs a finger (phone project)');
  const chip = this.eventChip(title);
  const from = await grabPoint(this, chip);
  const to = centre(await box(this.byTestId('month-cell', attr('data-date', date))));
  const f = await fingerDown(this, from, 500);
  await f.move(to, 10, 300);
  this.heldAt = to;
  this.held = async () => {
    await f.up();
    this.held = undefined;
    this.heldAt = undefined;
  };
});

Then('the dragged event is drawn visibly in the day under the finger', async function (this: World) {
  const at = this.heldAt;
  if (!this.held || !at) throw new Error('nothing is held');
  const lifted = this.page.locator(`${tid('event-chip')}[data-dragging="true"]`);
  await expect(lifted).toHaveCount(1);
  await expect.poll(() => lifted.evaluate((el, p) => {
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const cellAt = (q: { x: number; y: number }) => document.elementsFromPoint(q.x, q.y).find((e) => (e as HTMLElement).dataset.testid === 'month-cell');
    const top = document.elementFromPoint(c.x, c.y);
    if (!cellAt(p) || cellAt(c) !== cellAt(p)) return 'the chip is not in the day under the finger';
    return top === el || (!!top && el.contains(top)) ? 'ok' : `covered or clipped: ${top?.className}`;
  }, at), { message: 'the lifted chip is drawn on top in the day under the finger' }).toBe('ok');
});

/** Scroll position of the time grid's scroll container, noted by "I swipe up quickly ..." */
const gridScrollTop = (w: World) => w.page.getByTestId('time-grid').first().evaluate((el) => {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible') return e.scrollTop;
  }
  return 0;
});

When('I swipe up quickly starting on the event {string}', async function (this: World, title: string) {
  if (!useTouch(this)) throw new Error('needs a finger (phone project)');
  const chip = this.eventChip(title);
  await chip.scrollIntoViewIfNeeded();
  this.gridScrollBefore = await gridScrollTop(this);
  const from = await grabPoint(this, chip);
  const f = await fingerDown(this, from, 0);
  await f.move({ x: from.x, y: from.y - 240 }, 8, 150);
  await f.up();
});

Then('the time grid has scrolled down', async function (this: World) {
  await expect.poll(async () => (await gridScrollTop(this)) - (this.gridScrollBefore ?? 0), { message: 'scrolled by at least 40 px' }).toBeGreaterThanOrEqual(40);
});

When('I drag the event {string} to {date} with a finger held perfectly still', async function (this: World, title: string, date: string) {
  if (!useTouch(this)) throw new Error('needs a finger (phone project)');
  // the browser takes a touch over for scrolling with a pointercancel: note any during the drag
  await this.page.evaluate(() => {
    const w = window as unknown as { __pointerCancels: number };
    w.__pointerCancels = 0;
    window.addEventListener('pointercancel', () => { w.__pointerCancels++; }, true);
  });
  this.stillFinger = true;
  try {
    await drag(this, eventHandle(this, title), (c, f) => targetPoint(this, c, f, date));
  } finally {
    this.stillFinger = false;
  }
});

Then('the browser did not take the touch over for scrolling', async function (this: World) {
  expect(await this.page.evaluate(() => (window as unknown as { __pointerCancels?: number }).__pointerCancels), 'pointercancel events during the drag').toBe(0);
});

// ---------------------------------------------------------------- turning the day or week while dragging (A)

/**
 * Picks the card up at its usual grab point and moves it (10 steps) to `to`, keeping it held for `ms`; the pointer or
 * finger stays down ("held"), can move on ("heldMove") and is released by a drop step or the world's cleanup.
 */
async function holdAt(w: World, card: Locator, to: (from: Point) => Promise<Point>, ms: number, approach = 0) {
  // in the middle of the grid: a pointer resting near its top or bottom would start the auto-scroll during the hold
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await w.page.waitForTimeout(100);
  const from = await grabPoint(w, card);
  const dest = await to(from);
  // an edge hold stops `approach` px short of the zone first, then enters it in one move: the hold counts from there
  const near = { x: dest.x - approach, y: dest.y };
  if (useTouch(w)) {
    const f = await fingerDown(w, from, 500);
    await f.move(near, 10, 300);
    if (approach) await f.move(dest, 1, 0);
    w.heldMove = (p, steps, t) => f.move(p, steps, t);
    w.held = async () => { await f.up(); w.held = undefined; w.heldMove = undefined; w.heldAt = undefined; };
  } else {
    const { mouse } = w.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move(near.x, near.y, { steps: 10 });
    if (approach) await mouse.move(dest.x, dest.y);
    let at = dest;
    w.heldMove = async (p, steps) => { await mouse.move(p.x, p.y, { steps }); at = p; };
    w.held = async () => { await mouse.move(at.x, at.y); await mouse.up(); w.held = undefined; w.heldMove = undefined; w.heldAt = undefined; };
  }
  w.heldAt = dest;
  await w.page.waitForTimeout(ms);
}

/** Presses and holds a task list's card in the grid until it is lifted, then moves 10 px so the drag starts; the pointer stays down. */
When('I pick up the task list {string}', async function (this: World, title: string) {
  const card = this.page.locator(`.tg:not(.fit) ${attr('data-title', title)}`).locator('visible=true').first();
  await expect(card).toBeVisible();
  await holdAt(this, card, async (from) => ({ x: from.x, y: from.y + 10 }), 0);
  await expect(this.page.locator('[data-dragging="true"]').first()).toBeAttached();
});

/** The visible (not fit) time grid's day columns: left edge of the first, right edge of the last. */
async function columnsEdges(w: World): Promise<{ left: number; right: number }> {
  const cols = w.page.locator('.tg:not(.fit) [data-testid="week-day-column"], .tg:not(.fit) [data-testid="day-column"]').locator('visible=true');
  const first = await box(cols.first());
  const last = await box(cols.last());
  return { left: first.x, right: last.x + last.width };
}

const edgePoint = (w: World, side: 'left' | 'right') => async (from: Point) => {
  const e = await columnsEdges(w);
  return { x: side === 'right' ? e.right - 6 : e.left + 6, y: from.y };
};
/** How far short of an edge zone a hold stops before entering it (signed: towards the middle). */
const APPROACH = { right: 40, left: -40 } as const;

When('I hold the event {string} at the right edge of the time grid for {int} ms', async function (this: World, title: string, ms: number) {
  await holdAt(this, this.eventChip(title), edgePoint(this, 'right'), ms, APPROACH.right);
});

When('I hold the event {string} at the left edge of the time grid for {int} ms', async function (this: World, title: string, ms: number) {
  await holdAt(this, this.eventChip(title), edgePoint(this, 'left'), ms, APPROACH.left);
});

When('I hold the task list {string} at the right edge of the time grid for {int} ms', async function (this: World, title: string, ms: number) {
  await holdAt(this, this.taskCard(title), edgePoint(this, 'right'), ms, APPROACH.right);
});

When('I hold the all-day event {string} at the right edge of the all-day row for {int} ms', async function (this: World, title: string, ms: number) {
  await holdAt(this, eventHandle(this, title), edgePoint(this, 'right'), ms, APPROACH.right);
});

When('I hold the event {string} over {date} at {time} for {int} ms', async function (this: World, title: string, date: string, time: string, ms: number) {
  const chip = this.eventChip(title);
  await holdAt(this, chip, async (from) => {
    const p = await targetPoint(this, chip, from, date, time);
    // a phone's day column is about 49 px wide: its middle sits on the 24 px edge zone; stay 4 px clear of it
    const e = await columnsEdges(this);
    return { x: Math.min(Math.max(p.x, e.left + 28), e.right - 28), y: p.y };
  }, ms);
});

When('I keep holding the dragged item for {int} ms', async function (this: World, ms: number) {
  if (!this.held) throw new Error('nothing is held');
  await this.page.waitForTimeout(ms);
});

Then('the edge band says {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('drag-edge-band')).toHaveText(text);
});

Then('I see no edge band', async function (this: World) {
  await expect(this.page.getByTestId('drag-edge-band')).toHaveCount(0);
});

Then('{string} is still being dragged', async function (this: World, title: string) {
  await expect(this.page.locator(`${attr('data-title', title)}[data-dragging="true"]`).locator('visible=true')).toHaveCount(1);
});

/** Moves the held card to a point, lets go there and waits for the save and for nothing to be lifted any more. */
async function dropAt(w: World, to: Point | (() => Promise<Point>)) {
  if (!w.held || !w.heldMove) throw new Error('nothing is held');
  // out of an edge zone at once (no further turn while the target is looked up), then to the target
  const e = await columnsEdges(w);
  await w.heldMove({ x: (e.left + e.right) / 2, y: w.heldAt?.y ?? (await w.page.viewportSize())!.height / 2 }, 1, 0);
  await w.heldMove(typeof to === 'function' ? await to() : to, 10, 300);
  const saved = w.page.waitForResponse((r) => isPersist(r.url(), r.request().method()));
  await w.held();
  await saved;
  await expect(w.page.locator('[data-dragging="true"]')).toHaveCount(0);
}

When('I drop the dragged item on {date} at {time}', async function (this: World, date: string, time: string) {
  const [h, m] = time.split(':').map(Number);
  await dropAt(this, async () => {
    const slot = this.page.locator(`${tid('time-slot')}${attr('data-date', date)}${attr('data-hour', String(h))}`).first();
    await expect(slot).toBeAttached();
    // the slot is brought into view the way the auto-scroll would, without moving the pointer
    await slot.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await this.page.waitForTimeout(100);
    const b = await box(slot);
    // the card is held 5 minutes below its top (grabPoint): the pointer goes 5 minutes below the slot time
    return { x: b.x + b.width / 2, y: b.y + ((m + 5) / 60) * b.height };
  });
});

When('I drop the dragged item in the all-day row on {date}', async function (this: World, date: string) {
  const cell = this.page.locator(`${tid('week-allday-cell')}${attr('data-date', date)}, ${tid('day-allday-area')}${attr('data-date', date)}`).first();
  await dropAt(this, async () => centre(await box(cell)));
});

/**
 * Holds X at the right edge until the view has turned once, then moves out of the edge zone to the middle of the grid at
 * once (no second turn on a slow device): the turn is waited for, not timed.
 */
When('I hold the event {string} at the right edge of the time grid until the view turns', async function (this: World, title: string) {
  const before = new URL(this.page.url()).pathname;
  await holdAt(this, this.eventChip(title), edgePoint(this, 'right'), 0, APPROACH.right);
  await expect.poll(() => new URL(this.page.url()).pathname, { timeout: 5_000, intervals: [50] }).not.toBe(before);
  const e = await columnsEdges(this);
  await this.heldMove!({ x: (e.left + e.right) / 2, y: this.heldAt!.y }, 1, 0);
});

// ---------------------------------------------------------------- drawing a block on the empty time grid (C)

/** Page point of a time on a day's column of the visible time grid (exact, so off-quarter times test the snapping). */
async function gridPoint(w: World, date: string, time: string): Promise<Point> {
  const col = await box(w.dayColumn(date));
  const grid = await box(w.page.locator('.tg:not(.fit) [data-testid="time-grid"]').first());
  const [h, m] = time.split(':').map(Number);
  return { x: col.x + col.width / 2, y: grid.y + ((h * 60 + m) / 60) * (await hourHeight(w)) };
}

const toMin = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

/** Scrolls the grid so minute `min` of the day sits at `at` (0 top .. 1 bottom) of its scroll area, instantly. */
async function scrollTo(w: World, min: number, at = 0.5) {
  const hh = await hourHeight(w);
  await w.page.locator('.tg:not(.fit) [data-scroll-area]').first().evaluate((sc, [y, f]) => { sc.scrollTop = Math.max(0, y - sc.clientHeight * f); }, [(min / 60) * hh, at] as const);
  await w.page.waitForTimeout(80);
}
const centreTime = (w: World, time: string) => scrollTo(w, toMin(time));

/**
 * Presses on the empty grid at D1 T1 (a finger: long press), moves to D2 T2 in 10 steps; `release`: lets go there.
 * Both ends are brought on screen together when they fit; otherwise (overnight) the grid is scrolled while the press is
 * held, the end landing in the upper or lower quarter so the pointer really travels.
 */
async function draw(w: World, d1: string, t1: string, d2: string, t2: string, release: boolean) {
  const sc = await box(w.page.locator('.tg:not(.fit) [data-scroll-area]').first());
  const span = Math.abs(toMin(t2) - toMin(t1)) / 60 * (await hourHeight(w));
  const together = d1 === d2 && span < sc.height - 120;
  await scrollTo(w, together ? (toMin(t1) + toMin(t2)) / 2 : toMin(t1));
  const from = await gridPoint(w, d1, t1);
  const later = d2 > d1 || (d2 === d1 && toMin(t2) > toMin(t1));
  const end = async () => {
    if (!together) await scrollTo(w, toMin(t2), later ? 0.75 : 0.25);
    return gridPoint(w, d2, t2);
  };
  if (useTouch(w)) {
    const f = await fingerDown(w, from, 500);
    await f.move(await end(), 10, 300);
    w.held = async () => { await f.up(); w.held = undefined; };
  } else {
    const { mouse } = w.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    const to = await end();
    await mouse.move(to.x, to.y, { steps: 10 });
    w.held = async () => { await mouse.up(); w.held = undefined; };
  }
  if (release) await w.held!();
}

When('I draw a block on {date} from {time} to {time}', async function (this: World, date: string, t1: string, t2: string) {
  await draw(this, date, t1, date, t2, true);
});

When('I draw a block from {date} {time} to {date} {time}', async function (this: World, d1: string, t1: string, d2: string, t2: string) {
  await draw(this, d1, t1, d2, t2, true);
});

When('I hold a drawn block on {date} from {time} to {time}', async function (this: World, date: string, t1: string, t2: string) {
  await draw(this, date, t1, date, t2, false);
});

When('I long-press the empty time grid on {date} at {time} and let go', async function (this: World, date: string, time: string) {
  if (!useTouch(this)) throw new Error('needs a finger (phone project)');
  await centreTime(this, time);
  const f = await fingerDown(this, await gridPoint(this, date, time), 500);
  await f.up();
});

Then('the drawn block is shown on {date} from {time} to {time}', async function (this: World, date: string, from: string, to: string) {
  const block = this.dayColumn(date).getByTestId('draw-block');
  await expect(block).toHaveAttribute('data-start-time', from);
  await expect(block).toHaveAttribute('data-end-time', to);
  const hh = await hourHeight(this);
  const grid = await box(this.page.locator('.tg:not(.fit) [data-testid="time-grid"]').first());
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const b = await box(block);
  expect(Math.abs(b.y - (grid.y + (mins(from) / 60) * hh)), 'top on the grid').toBeLessThanOrEqual(3);
  expect(Math.abs(b.height - ((mins(to) - mins(from)) / 60) * hh), 'height on the grid').toBeLessThanOrEqual(3);
});

Then('no drawn block is shown', async function (this: World) {
  await expect(this.page.getByTestId('draw-block')).toHaveCount(0);
});

When('I swipe up on the empty time grid of {date}', async function (this: World, date: string) {
  if (!useTouch(this)) throw new Error('needs a finger (phone project)');
  await centreTime(this, '12:00');
  this.gridScrollBefore = await gridScrollTop(this);
  const from = await gridPoint(this, date, '12:00');
  const f = await fingerDown(this, from, 0);
  await f.move({ x: from.x, y: from.y - 200 }, 10, 200);
  await f.up();
});

Then('the time grid has scrolled', async function (this: World) {
  await expect.poll(async () => Math.abs((await gridScrollTop(this)) - (this.gridScrollBefore ?? 0)), { message: 'scrolled' }).toBeGreaterThan(20);
});
