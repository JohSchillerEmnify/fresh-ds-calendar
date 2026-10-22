/** Resize handle steps (STEPS.md "Drag and drop", resize). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { minutesOf } from './support/dates.js';
import { box, touchDrag } from './support/ui.js';
import type { World } from './support/world.js';

const useTouch = (w: World) => !!w.testInfo.project.use.hasTouch;
const entry = (w: World, title: string): Locator => w.eventChips(title).or(w.taskCards(title)).first();
const handles = (card: Locator) => [card.getByTestId('resize-handle-top'), card.getByTestId('resize-handle-bottom')];

async function hourHeight(w: World): Promise<number> {
  const grid = w.page.getByTestId('time-grid').first();
  await expect(grid).toHaveAttribute('data-hour-height', /\d/);
  return Number(await grid.getAttribute('data-hour-height'));
}

/** Pick the entry up (long press / mouse press-and-hold) and release it on the spot. */
async function pickUpAndRelease(w: World, card: Locator) {
  await card.scrollIntoViewIfNeeded();
  const b = await box(card);
  const at = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 8) };
  if (useTouch(w)) {
    await touchDrag(w.page, at, at, { holdMs: 500, steps: 1, durationMs: 0 });
    return;
  }
  const { mouse } = w.page;
  await mouse.move(at.x, at.y);
  await mouse.down();
  await w.page.waitForTimeout(500);
  await mouse.up();
}

async function showHandles(w: World, view: 'day' | 'week', date: string, card: () => Locator) {
  await w.page.goto(`/${view}/${date}`);
  await w.settled();
  await pickUpAndRelease(w, card());
  for (const h of handles(card())) await expect(h).toBeVisible();
}

Given('the event {string} shows resize handles in the day view for {date}', async function (this: World, title: string, date: string) {
  await showHandles(this, 'day', date, () => entry(this, title));
});
Given('the event {string} shows resize handles in the week view for {date}', async function (this: World, title: string, date: string) {
  await showHandles(this, 'week', date, () => entry(this, title));
});
Given('the task list {string} shows resize handles in the day view for {date}', async function (this: World, title: string, date: string) {
  await showHandles(this, 'day', date, () => entry(this, title));
});

/** Drag a handle by N minutes of grid height (no long press), then wait for the save (PATCH response); `hold` keeps the pointer down instead. */
async function dragHandle(w: World, title: string, which: 'top' | 'bottom', minutes: number, hold = false) {
  const handle = entry(w, title).getByTestId(`resize-handle-${which}`);
  await handle.scrollIntoViewIfNeeded();
  const b = await box(handle);
  const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const to = { x: from.x, y: from.y + (minutes / 60) * (await hourHeight(w)) };
  const saved = hold ? null : w.page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/(events|tasklists)\//.test(r.url()));
  if (useTouch(w)) {
    await touchDrag(w.page, from, to, { steps: 10, durationMs: 300, release: !hold });
  } else {
    const { mouse } = w.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move(to.x, to.y, { steps: 10 });
    if (!hold) await mouse.up();
  }
  await saved;
}

/** Minutes from the entry's real end (its `data-end-time`) to `time`. */
async function toEnd(w: World, title: string, time: string): Promise<number> {
  const end = (await entry(w, title).getAttribute('data-end-time'))!;
  return minutesOf(time) - minutesOf(end);
}

When('I drag the bottom handle of {string} down by {int} minutes', async function (this: World, title: string, minutes: number) {
  await dragHandle(this, title, 'bottom', minutes);
});
When('I drag the bottom handle of {string} up by {int} minutes', async function (this: World, title: string, minutes: number) {
  await dragHandle(this, title, 'bottom', -minutes);
});
When('I drag the top handle of {string} up by {int} minutes', async function (this: World, title: string, minutes: number) {
  await dragHandle(this, title, 'top', -minutes);
});

When('I hold the end handle of {string} at {time}', async function (this: World, title: string, time: string) {
  await dragHandle(this, title, 'bottom', await toEnd(this, title, time), true);
});
When('I drag the end handle of {string} to {time} in the day view', async function (this: World, title: string, time: string) {
  await dragHandle(this, title, 'bottom', await toEnd(this, title, time));
});

/** STEPS.md: a tap inside the neighbour's box, 3 px from its left edge, at the height of the other entry's bottom handle. */
When('I tap the event {string} right beside the bottom handle of {string}', async function (this: World, title: string, other: string) {
  const n = await box(entry(this, title));
  const h = await box(entry(this, other).getByTestId('resize-handle-bottom'));
  const at = { x: n.x + 3, y: h.y + h.height / 2 };
  expect(at.y > n.y && at.y < n.y + n.height, `the handle's height ${Math.round(at.y)} lies inside ${title}`).toBe(true);
  // the premise: a 44 px handle centred on the other entry (the old width) would have covered this point
  const o = await box(entry(this, other));
  expect(Math.abs(at.x - (o.x + o.width / 2)) <= 22, `a centred 44 px handle on ${other} would cover x ${Math.round(at.x)}`).toBe(true);
  if (useTouch(this)) await this.page.touchscreen.tap(at.x, at.y);
  else await this.page.mouse.click(at.x, at.y);
});

Then('the event {string} shows resize handles', async function (this: World, title: string) {
  for (const h of handles(entry(this, title))) await expect(h).toBeVisible();
});
Then('the event {string} shows no resize handles', async function (this: World, title: string) {
  for (const h of handles(entry(this, title))) await expect(h).toBeHidden();
});
