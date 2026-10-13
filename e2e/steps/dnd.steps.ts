/** Drag and drop steps (STEPS.md "Drag and drop"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import { box, touchDrag, type Box } from './support/ui.js';
import { attr, tid, type ProbeWindow, type World } from './support/world.js';

interface Point { x: number; y: number }
const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const useTouch = (w: World) => !!w.testInfo.project.use.hasTouch;

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
async function grabPoint(w: World, card: Locator): Promise<Point> {
  const b = await box(card);
  // A multi-day bar moves by (drop day - grabbed day): grab it in the middle of its first day, not at the day boundary.
  if (await isBar(card)) return { x: b.x + b.width / (2 * (await barDays(card))), y: b.y + b.height / 2 };
  const inGrid = (await card.locator('xpath=ancestor::*[@data-testid="week-day-column" or @data-testid="day-column"]').count()) > 0;
  if (!inGrid) return centre(b);
  const offset = Math.min(b.height / 2, (await hourHeight(w)) / 12);
  return { x: b.x + b.width / 2, y: b.y + offset };
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
  const vh = w.page.viewportSize()?.height ?? 800;
  if (cardBox.y < 0 || cardBox.y + cardBox.height > vh) {
    const mid = (cardBox.y + cardBox.height / 2 + toFirst.y) / 2;
    await card.evaluate((el, midY) => {
      for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight && getComputedStyle(n).overflowY !== 'visible') {
          const r = n.getBoundingClientRect();
          n.scrollTop += midY - (r.top + r.height / 2);
          return;
        }
      }
    }, mid);
  }
  const from = await grabPoint(w, card);
  const to = await target(card, from);
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
  // (no reload, so recorded memory baselines stay valid). See ASSUMPTIONS A-T1.
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

When('I pick up the event {string}', async function (this: World, title: string) {
  const chip = this.eventChip(title);
  const from = await grabPoint(this, chip);
  if (useTouch(this)) {
    // Touch stays down: keep the CDP session until "I release the event without moving it".
    const cdp = await this.context.newCDPSession(this.page);
    const touch = [{ x: Math.round(from.x), y: Math.round(from.y), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch });
    this.held = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await cdp.detach().catch(() => {});
      this.held = undefined;
    };
    await this.page.waitForTimeout(500);
  } else {
    const { mouse } = this.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await this.page.waitForTimeout(500);
    // A mouse drag starts after > 4 px of movement: wiggle sideways and return, so the net movement is zero.
    await mouse.move(from.x + 6, from.y, { steps: 2 });
    await mouse.move(from.x, from.y, { steps: 2 });
    this.held = async () => {
      await mouse.up();
      this.held = undefined;
    };
  }
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
  this.held = async () => {
    await this.page.evaluate(() => { (window as unknown as { __dropAt?: number }).__dropAt = new Event('t').timeStamp; });
    await mouse.up();
    this.held = undefined;
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
