/** Expanded task list card steps (STEPS.md "Task lists", expanded card): the card that grows in place over the calendar. */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { attr, exactText, tid, type World } from './support/world.js';

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

const grown = (w: World, title?: string) =>
  w.byTestId('tasklist-expanded', attr('data-presentation', 'overlay') + (title ? attr('data-title', title) : ''));
const rectOf = (l: Locator) => l.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; });
/** Boxes of events noted before the expansion, per scenario world. */
const notedEvents = new WeakMap<World, Record<string, Rect>>();

When('I tap the expanded task list {string}', async function (this: World, title: string) {
  // the grown card covers the collapsed one: a tap anywhere on it
  await grown(this, title).getByTestId('tasklist-card-grown').click();
});

When('I tap the item {string} of the expanded task list', async function (this: World, item: string) {
  await grown(this).getByTestId('tasklist-card-item').filter({ hasText: exactText(item) }).click();
});

When('I note where the event {string} is', async function (this: World, title: string) {
  notedEvents.set(this, { ...notedEvents.get(this), [title]: await rectOf(this.eventChip(title)) });
});

Then('the event {string} has not moved', async function (this: World, title: string) {
  const before = notedEvents.get(this)?.[title];
  expect(before, 'event noted before').toBeTruthy();
  await expect.poll(async () => { const n = await rectOf(this.eventChip(title)); return ['x', 'y', 'width', 'height'].every((k) => Math.abs(n[k as keyof Rect] - before![k as keyof Rect]) <= 1); }).toBe(true);
});

Then('the expanded task list overlaps the event {string}', async function (this: World, title: string) {
  const g = await rectOf(grown(this));
  const e = await rectOf(this.eventChip(title));
  expect(g.bottom, 'grown card reaches into the event').toBeGreaterThan(e.y + 4);
  // and it is on top there
  const onTop = await this.page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="tasklist-expanded"]'), { x: e.x + e.width / 2, y: e.y + 2 });
  expect(onTop, 'the grown card is above the event').toBe(true);
});

Then('the expanded task list has the left and width of the card {string}', async function (this: World, title: string) {
  const c = await rectOf(this.taskCard(title));
  await expect.poll(async () => { const g = await rectOf(grown(this, title).getByTestId('tasklist-card-grown')); return Math.max(Math.abs(g.x - c.x), Math.abs(g.width - c.width)); }).toBeLessThanOrEqual(2);
});

Then('the expanded task list shows the full title {string}', async function (this: World, title: string) {
  const t = grown(this).getByTestId('tasklist-card-title');
  await expect(t).toHaveText(exactText(title));
  const clipped = await t.evaluate((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
  expect(clipped, 'title is not clipped').toBe(false);
  // inside the card box, not cut by it
  const g = await rectOf(grown(this).getByTestId('tasklist-card-grown'));
  const r = await rectOf(t);
  expect(r.right).toBeLessThanOrEqual(g.right + 1);
  expect(r.bottom).toBeLessThanOrEqual(g.bottom + 1);
});

Then('the expanded task list shows the real time block of the card {string} and a slimmer extension starting at its end', async function (this: World, title: string) {
  const collapsed = await rectOf(this.taskCard(title));
  const g = grown(this, title);
  await expect(g.getByTestId('tasklist-grown-ext')).toHaveCount(1);
  const real = await rectOf(g.getByTestId('tasklist-grown-real'));
  const ext = await rectOf(g.getByTestId('tasklist-grown-ext'));
  expect(Math.abs(real.height - collapsed.height), 'real block has the height of the collapsed card').toBeLessThanOrEqual(2);
  expect(Math.abs(ext.y - (real.y + real.height)), 'extension starts at the real end').toBeLessThanOrEqual(2);
  expect(ext.width, 'extension is narrower than the real block').toBeLessThan(real.width);
  expect(ext.height, 'extension has height').toBeGreaterThan(4);
});

Then('the task list card {string} is still the one-row inline card of its time block', async function (this: World, title: string) {
  const card = this.taskCard(title);
  await expect(card).toHaveAttribute('data-fit', 'inline');
  const h = await card.evaluate((e) => ({ card: e.getBoundingClientRect().height, block: e.parentElement!.getBoundingClientRect().height }));
  expect(Math.abs(h.card - h.block)).toBeLessThanOrEqual(2);
});

Then('the task list {string} opens as the list sheet', async function (this: World, title: string) {
  await expect(this.page.locator(`${tid('tasklist-expanded')}${attr('data-title', title)}:not(${attr('data-presentation', 'overlay')})`)).toBeVisible();
  await expect(grown(this)).toHaveCount(0);
});

When('I tap outside the expanded task list', async function (this: World) {
  const exp = await grown(this).boundingBox();
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
  const exp = grown(this, title);
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
  const item = (n: string) => grown(this).getByTestId('tasklist-card-item').filter({ hasText: exactText(n) });
  await expect(item(done)).toHaveAttribute('data-done', 'true');
  await expect(item(open)).toHaveAttribute('data-done', 'false');
});

Then('the expanded task list has no checkboxes', async function (this: World) {
  await expect(grown(this).getByTestId('tasklist-card-item').first()).toBeVisible();
  await expect(grown(this).locator('input, [role="checkbox"], [data-testid="tasklist-item-checkbox"], [data-testid="tasklist-edit"], [data-testid="tasklist-close"]')).toHaveCount(0);
});

Then('the focus is inside the expanded task list', async function (this: World) {
  await expect.poll(() => grown(this).evaluate((e) => e.contains(document.activeElement))).toBe(true);
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
