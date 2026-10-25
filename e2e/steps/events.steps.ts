/** Event display and event dialog steps (STEPS.md "Events: display", "Events: dialog", "Event colors"). */
import { expect, type Locator } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Then, When } from './fixtures.js';
import { field, fillField, readField } from './support/forms.js';
import { expectPositioned } from './support/grid.js';
import { addDays, datesBetween, weekdayOffset, type Weekday } from './support/dates.js';
import { cellValue, formRows } from './support/tables.js';
import { box, expectBottomSheet, expectInViewport, expectJoined, optionLabels } from './support/ui.js';
import { attr, exactText, tid, type World } from './support/world.js';

async function weekdayDate(world: World, name: Weekday): Promise<string> {
  return addDays(await world.weekStart(), weekdayOffset(name));
}

// --- display ---------------------------------------------------------------------------------------------------

Then('I see the event {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(this.eventChip(title, date)).toBeVisible();
});

Then('I see the event {string} on {weekday}', async function (this: World, title: string, day: Weekday) {
  await expect(this.eventChip(title, await weekdayDate(this, day))).toBeVisible();
});

Then(
  'I see the event {string} on each day from {date} to {date}',
  async function (this: World, title: string, from: string, to: string) {
    for (const d of datesBetween(from, to)) {
      await expect.poll(async () => (await this.eventChips(title, d).locator('visible=true').count()) > 0 || (await this.barCovers(title, d)), `${title} on ${d}`).toBe(true);
    }
  },
);

Then('I see the event {string} as a bar from {date} to {date}', async function (this: World, title: string, from: string, to: string) {
  await expect(this.eventBars(title).and(this.page.locator(`[data-start="${from}"][data-end="${to}"]`)).locator('visible=true').first()).toBeVisible();
});

Then('the event {string} is a bar in lane {int}', async function (this: World, title: string, lane: number) {
  await expect(this.eventBars(title).locator('visible=true').first()).toHaveAttribute('data-lane', String(lane));
});

/** First visible chip or task list card inside the month cell of a date (never a bar: bars are drawn outside the cells). */
const firstEntry = (w: World, date: string) =>
  w.byTestId('month-cell', attr('data-date', date)).locator(`${tid('event-chip')}, ${tid('tasklist-card')}`).locator('visible=true').first();
const firstBar = (w: World, title: string) => w.eventBars(title).locator('visible=true').first();

Then('the first entry of the month cell of {date} is at the height of the bar {string}', async function (this: World, date: string, title: string) {
  await expect.poll(async () => Math.abs((await box(firstEntry(this, date))).y - (await box(firstBar(this, title))).y), 'top offset in px').toBeLessThanOrEqual(3);
});

Then('the first entry of the month cell of {date} is in the slot below the bar {string}', async function (this: World, date: string, title: string) {
  await expect.poll(async () => {
    const [e, b] = [await box(firstEntry(this, date)), await box(firstBar(this, title))];
    const gap = e.y - (b.y + b.height);
    return gap >= -0.5 && gap <= e.height + 4;
  }, 'entry top is below the bar, within one chip height + 4 px').toBe(true);
});

Then('the all-day event {string} on {date} is at the height of the bar {string}', async function (this: World, title: string, date: string, bar: string) {
  // Day view: the bar is clipped away (not covering the date), so the band top is the reference.
  const chip = this.eventChips(title, date).locator('visible=true').first();
  const top = async () => ((await firstBar(this, bar).count()) ? (await box(firstBar(this, bar))).y : (await box(this.page.locator(`${tid('week-allday-cell')}${attr('data-date', date)}, ${tid('day-allday-area')}${attr('data-date', date)}`).first())).y);
  await expect.poll(async () => Math.abs((await box(chip)).y - (await top())), 'top offset in px').toBeLessThanOrEqual(3);
});

Then('the bar {string} has the height of the chip {string}', async function (this: World, bar: string, chip: string) {
  await expect.poll(async () => Math.abs((await box(firstBar(this, bar))).height - (await box(this.eventChip(chip))).height), 'height difference in px').toBeLessThanOrEqual(1);
});

Then('the bar {string} shows no continuation arrows', async function (this: World, title: string) {
  await expect(firstBar(this, title)).toBeVisible();
  const bars = this.eventBars(title);
  await expect(bars.locator('.arr')).toHaveCount(0);
  expect(((await bars.allTextContents()).join('')), 'arrow text in the bar').not.toMatch(/[◂▸]/);
});

Then('I see the all-day event {string} on {date}', async function (this: World, title: string, date: string) {
  // A multi-day all-day event is drawn as a bar, not as per-day chips.
  await expect.poll(async () => (await this.eventChips(title, date).and(this.page.locator('[data-all-day="true"]')).locator('visible=true').count()) > 0 || (await this.barCovers(title, date)), `${title} on ${date}`).toBe(true);
});

Then('I do not see the event {string}', async function (this: World, title: string) {
  await this.settled();
  await expect(this.eventChips(title).locator('visible=true')).toHaveCount(0);
});

Then('I do not see the event {string} on {date}', async function (this: World, title: string, date: string) {
  await this.settled();
  await expect(this.eventChips(title, date).locator('visible=true')).toHaveCount(0);
  expect(await this.barCovers(title, date), `bar of ${title} covers ${date}`).toBe(false);
});

Then('the event {string} shows the time {string}', async function (this: World, title: string, time: string) {
  await expect(this.eventChip(title).getByTestId('event-chip-time')).toContainText(time);
});

Then('the event {string} shows the location {string}', async function (this: World, title: string, location: string) {
  await expect(this.eventChip(title).getByTestId('event-chip-location')).toHaveText(location);
});

// Where the block is drawn; its end may lie past the real end under a minimum event length (min-event-length).
Then('the event {string} is positioned from {time} to {time}', async function (this: World, title: string, from: string, to: string) {
  const chip = this.eventChip(title);
  await expect(chip).toHaveAttribute('data-start-time', from);
  await expectPositioned(this, chip, from, to);
});

Then(
  'the event {string} is positioned on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    const chip = this.eventChip(title, date);
    await expect(chip).toHaveAttribute('data-start-time', from);
    await expect(chip).toHaveAttribute('data-end-time', to);
    await expectPositioned(this, chip, from, to);
  },
);

Then('the events {string} and {string} do not overlap', async function (this: World, a: string, b: string) {
  const [ba, bb] = [await box(this.eventChip(a)), await box(this.eventChip(b))];
  const tol = 0.5;
  const intersect =
    ba.x + tol < bb.x + bb.width && bb.x + tol < ba.x + ba.width && ba.y + tol < bb.y + bb.height && bb.y + tol < ba.y + ba.height;
  expect(intersect, `boxes ${JSON.stringify(ba)} and ${JSON.stringify(bb)} intersect`).toBe(false);
});

Then('the title of the event {string} is not covered', async function (this: World, title: string) {
  const t = this.eventChip(title).getByTestId('event-chip-title');
  await expect(t).toBeVisible();
  await t.scrollIntoViewIfNeeded();
  // Whatever is on top at the middle of the title must belong to this event's chip.
  await expect.poll(() => t.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && el.closest('[data-testid="event-chip"]')!.contains(top);
  })).toBe(true);
});

Then('the events {string} and {string} are side by side', async function (this: World, a: string, b: string) {
  const [ba, bb] = [await box(this.eventChip(a)), await box(this.eventChip(b))];
  const within = (y: number, r: typeof ba) => y >= r.y && y <= r.y + r.height;
  expect(within(ba.y, bb) || within(bb.y, ba), 'vertical spans overlap').toBe(true);
  expect(Math.abs(ba.x - bb.x), 'different left edges').toBeGreaterThan(1);
});

Then('the event {string} is stacked on the event {string}', async function (this: World, later: string, earlier: string) {
  const [l, e] = [await box(this.eventChip(later)), await box(this.eventChip(earlier))];
  expect(l.x, 'later block is indented').toBeGreaterThan(e.x + 2);
  expect(l.y, 'later block starts lower').toBeGreaterThan(e.y);
  expect(l.y, 'blocks overlap vertically').toBeLessThan(e.y + e.height);
});

Then('the event {string} spans the full width of its day column', async function (this: World, title: string) {
  const chip = this.eventChip(title);
  const date = (await chip.getAttribute('data-date'))!;
  await expect
    .poll(async () => {
      const [c, col] = [await chip.boundingBox(), await this.dayColumn(date).boundingBox()];
      return c && col ? c.width / col.width : 0;
    })
    .toBeGreaterThanOrEqual(0.9);
});

Then('the event {string} has the color {string}', async function (this: World, title: string, color: string) {
  await expect(this.eventChip(title)).toHaveAttribute('data-color', new RegExp(`^${color}$`, 'i'));
});

Then('the items on {date} are shown in the order {string}', async function (this: World, date: string, list: string) {
  const cell = this.byTestId('month-cell', attr('data-date', date));
  await expectJoined(cell.locator(`${tid('event-chip')}, ${tid('tasklist-card')}`), list, 'data-title');
});

// --- dialog ----------------------------------------------------------------------------------------------------

/** The event dialog, or the same dialog in birthday mode. */
const dialog = (w: World) => w.page.locator(`${tid('event-dialog')}, ${tid('birthday-dialog')}`);

When('I start creating an event', async function (this: World) {
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-event').click();
  await expect(dialog(this)).toBeVisible();
});

When('I click the time slot {time} on {date}', async function (this: World, time: string, date: string) {
  const hour = String(Number(time.slice(0, 2)));
  const slot = this.page
    .locator(`${tid('time-slot')}${attr('data-date', date)}:is(${attr('data-hour', hour)}, ${attr('data-hour', hour.padStart(2, '0'))})`)
    .first();
  await slot.scrollIntoViewIfNeeded();
  await slot.click();
});

/** testid of each event form field (STEPS.md conventions). */
const EVENT_FIELDS: Record<string, string> = {
  title: 'event-title',
  'all day': 'event-all-day',
  'start date': 'event-start-date',
  'start time': 'event-start-time',
  'end date': 'event-end-date',
  'end time': 'event-end-time',
  description: 'event-description',
  location: 'event-location',
  calendar: 'event-calendar',
  color: 'event-color',
};

const eventKind = (name: string) =>
  name === 'all day' ? 'checkbox' : name === 'calendar' || name === 'color' ? 'choice' : 'text';

When('I fill in the event form with:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    await fillField(field(dialog(this), EVENT_FIELDS, name), eventKind(name), cellValue(cell));
  }
});

Then('the event form shows:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    const control = field(dialog(this), EVENT_FIELDS, name);
    await expect.poll(() => readField(control, eventKind(name)), { message: `event field "${name}"` }).toBe(cellValue(cell));
  }
});

When('I press Enter in the event field {string}', async function (this: World, name: string) {
  await field(dialog(this), EVENT_FIELDS, name).press('Enter');
});

Then('the event field {string} has focus', async function (this: World, name: string) {
  await expect(field(dialog(this), EVENT_FIELDS, name)).toBeFocused();
});

When('I save the event', async function (this: World) {
  await dialog(this).getByTestId('event-save').click();
});

When('I cancel the event dialog', async function (this: World) {
  await dialog(this).getByTestId('event-cancel').click();
});

When('I press Escape', async function (this: World) {
  await this.page.keyboard.press('Escape');
});

When('I open the event {string}', async function (this: World, title: string) {
  // no view open yet (a scenario that only set up Google): open the week of the event first
  if (!this.page.url().startsWith('http')) {
    const found = (await this.api.remoteEvents(title)).find((e) => e.status !== 'cancelled');
    if (!found) throw new Error(`Google has no event "${title}" to open`);
    await this.page.goto(`/week/${(found.start.date ?? found.start.dateTime ?? '').slice(0, 10)}`);
    await this.settled();
  }
  const inMonth = /\/month\//.test(this.page.url());
  await this.eventChip(title).click();
  // phone: a tap on a month chip opens that day first, where the chip opens the dialog
  if (inMonth && (await this.page.waitForURL(/\/day\//, { timeout: 1500 }).then(() => true, () => false))) {
    await this.settled();
    await this.eventChip(title).click();
  }
  await expect(dialog(this)).toBeVisible();
});

When('I delete the event', async function (this: World) {
  await dialog(this).getByTestId('event-delete').click();
});

When('I confirm the deletion', async function (this: World) {
  await this.page.getByTestId('confirm-ok').click();
  await expect(this.page.getByTestId('confirm-dialog')).toBeHidden();
});

When('I cancel the deletion', async function (this: World) {
  await this.page.getByTestId('confirm-cancel').click();
  await expect(this.page.getByTestId('confirm-dialog')).toBeHidden();
});

// --- delete with undo (events, task lists, items; STEPS.md "Undo") ---------------------------------------------

const undoSnackbar = (w: World) => w.page.getByTestId('undo-snackbar');

When('I undo the deletion', async function (this: World) {
  await undoSnackbar(this).getByTestId('undo-action').click();
  await expect(undoSnackbar(this)).toBeHidden();
});

When('the undo time is over', async function (this: World) {
  // A paused fake clock ("the clock is running") only moves on demand: let the 6 s undo window pass.
  if (this.clockNowMs !== undefined) await this.page.clock.runFor(7000);
  await expect(undoSnackbar(this)).toBeHidden({ timeout: 8000 });
  await expect.poll(() => this.page.evaluate(() => (window as { __pendingDeletes?: number }).__pendingDeletes ?? 0)).toBe(0);
});

Then('the snackbar says {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('snackbar-text').filter({ hasText: exactText(text) })).toBeVisible();
});

Then('the event dialog is open', async function (this: World) {
  await expect(dialog(this)).toBeVisible();
});

Then('the event dialog is closed', async function (this: World) {
  await expect(dialog(this)).toBeHidden();
});

/** Clicks the topmost dialog's `sheet-scrim` at the first viewport corner (10 px in) that its panel does not cover. */
When('I tap beside the dialog', async function (this: World) {
  const panel = this.page.locator('[role="dialog"][aria-modal="true"]').last();
  await expect(panel).toBeVisible();
  const p = await box(panel);
  const vp = this.page.viewportSize()!;
  const corners = [[10, 10], [vp.width - 10, 10], [10, vp.height - 10], [vp.width - 10, vp.height - 10]];
  const free = corners.find(([x, y]) => x < p.x || x > p.x + p.width || y < p.y || y > p.y + p.height);
  if (!free) throw new Error('The dialog covers every corner of the viewport');
  await this.page.getByTestId('sheet-scrim').last().click({ position: { x: free[0]!, y: free[1]! } });
});

Then('the event dialog shows the error {string}', async function (this: World, message: string) {
  await expect(dialog(this).getByTestId('event-error')).toHaveText(message);
});

Then('the event dialog is shown as a bottom sheet', async function (this: World) {
  await expectBottomSheet(this.page, dialog(this));
});

Then('the event dialog fits within the viewport', async function (this: World) {
  await expectInViewport(this.page, dialog(this));
});

Then('the event color options are {string}', async function (this: World, list: string) {
  await expect.poll(async () => (await optionLabels(dialog(this).getByTestId('event-color'))).join(', ')).toBe(list);
});
