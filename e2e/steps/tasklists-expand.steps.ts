/** Expanded task list card steps (STEPS.md "Task lists", expanded card): the card that grows in place over the calendar. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { attr, tid, type World } from './support/world.js';

type Rect = { x: number; y: number; width: number; height: number };
/** Boxes of the task list cards noted before the expansion, per scenario world. */
const noted = new WeakMap<World, Record<string, Rect>>();

const cardRects = (w: World) =>
  w.page.locator(tid('tasklist-card')).evaluateAll((els) =>
    Object.fromEntries(els.map((e, i) => {
      const b = e.getBoundingClientRect();
      return [`${e.getAttribute('data-tasklist-id')}@${e.getAttribute('data-date')}#${i}`, { x: b.x, y: b.y, width: b.width, height: b.height }];
    })));

When('I tap the task list {string}', async function (this: World, title: string) {
  await this.taskCard(title).click();
});

When('I tap the task list {string} again', async function (this: World, title: string) {
  // the expansion covers the card: its head is where the card was
  await this.byTestId('tasklist-expanded', attr('data-title', title)).getByTestId('tasklist-expanded-title').click();
});

When('I tap outside the expanded task list', async function (this: World) {
  const exp = await this.expanded.boundingBox();
  // a point that is neither inside the expansion nor on something clickable
  const p = await this.page.evaluate((r) => {
    const w = innerWidth, h = innerHeight;
    for (const [fx, fy] of [[0.97, 0.5], [0.03, 0.5], [0.5, 0.97], [0.97, 0.3], [0.03, 0.7], [0.5, 0.03]] as const) {
      const x = Math.round(w * fx), y = Math.round(h * fy);
      const inside = r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
      const el = document.elementFromPoint(x, y);
      if (!inside && el && !el.closest('button, a, input, select, textarea, [role="button"], [data-testid="tasklist-card"]')) return { x, y };
    }
    return null;
  }, exp);
  expect(p, 'a spot outside the expanded task list').not.toBeNull();
  await this.page.mouse.click(p!.x, p!.y);
});

When('I note where the task list cards are', async function (this: World) {
  noted.set(this, await cardRects(this));
});

Then('the task list cards have not moved', async function (this: World) {
  const before = noted.get(this);
  expect(before, 'cards noted before').toBeTruthy();
  const near = (a: Rect, b: Rect) => ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k as keyof Rect] - b[k as keyof Rect]) <= 1);
  await expect.poll(async () => {
    const now = await cardRects(this);
    return Object.entries(before!).filter(([k, r]) => !now[k] || !near(r, now[k]!)).map(([k]) => k);
  }).toEqual([]);
});

Then('the task list {string} is expanded over the calendar', async function (this: World, title: string) {
  const exp = this.byTestId('tasklist-expanded', attr('data-title', title));
  await expect(exp).toBeVisible();
  await expect(exp).toHaveAttribute('data-presentation', 'overlay');
  await expect(this.taskCard(title)).toHaveAttribute('aria-expanded', 'true');
  // it is the top element at its own centre: it covers what lies below
  await expect.poll(() => exp.evaluate((e) => {
    const b = e.getBoundingClientRect();
    const top = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40));
    return !!top && e.contains(top);
  })).toBe(true);
});

Then('the expanded task list shows the item {string} as done and the item {string} as open', async function (this: World, done: string, open: string) {
  await expect(this.expandedItem(done)).toHaveAttribute('data-done', 'true');
  await expect(this.expandedItem(open)).toHaveAttribute('data-done', 'false');
});

Then('the expanded task list has no checkboxes', async function (this: World) {
  await expect(this.expanded.getByTestId('tasklist-item').first()).toBeVisible();
  await expect(this.expanded.getByTestId('tasklist-item-checkbox')).toHaveCount(0);
});

Then('the focus is inside the expanded task list', async function (this: World) {
  await expect.poll(() => this.expanded.evaluate((e) => e.contains(document.activeElement))).toBe(true);
});

Then('the card of the task list {string} has the focus', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeFocused();
});

Then('the card of the task list {string} says it is expanded', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toHaveAttribute('aria-expanded', 'true');
});

Then('the card of the task list {string} says it is collapsed', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toHaveAttribute('aria-expanded', 'false');
});
