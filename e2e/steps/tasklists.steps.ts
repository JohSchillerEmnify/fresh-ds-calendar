/** Task list dialog, cards and expanded list steps (STEPS.md "Task lists"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Then, When } from './fixtures.js';
import { field, fillField, readField, type FieldKind } from './support/forms.js';
import { expectPositioned } from './support/grid.js';
import { dragItem, expandTaskList, itemById } from './support/tasklist.js';
import { cellValue, formRows } from './support/tables.js';
import { box, chooseListAction, expectInViewport, expectJoined } from './support/ui.js';
import { attr, exactText, tid, type World } from './support/world.js';

const dialog = (w: World) => w.page.getByTestId('tasklist-dialog');

const TASKLIST_FIELDS: Record<string, string> = {
  title: 'tasklist-title',
  date: 'tasklist-date',
  time: 'tasklist-time',
  items: 'tasklist-items',
  category: 'tasklist-category',
  estimate: 'tasklist-estimate',
  repeat: 'tasklist-repeat',
};
const kindOf = (name: string): FieldKind => (name === 'category' || name === 'repeat' ? 'choice' : 'text');
/** `items` cells are "; "-separated and typed one item per line. */
const typed = (name: string, cell: string) => {
  const v = cellValue(cell);
  return name === 'items' && v ? v.split('; ').join('\n') : v;
};

// --- dialog ----------------------------------------------------------------------------------------------------

When('I start creating a task list', async function (this: World) {
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-tasklist').click();
  await expect(dialog(this)).toBeVisible();
});

When('I switch the new dialog to {string}', async function (this: World, kind: string) {
  await this.page.getByTestId(kind === 'Task list' ? 'new-kind-tasklist' : 'new-kind-event').click();
  await expect(this.page.getByTestId(kind === 'Task list' ? 'tasklist-dialog' : 'event-dialog')).toBeVisible();
});

When('I fill in the task list form with:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    await fillField(field(dialog(this), TASKLIST_FIELDS, name), kindOf(name), typed(name, cell));
  }
});

Then('the task list form shows:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    const control = field(dialog(this), TASKLIST_FIELDS, name);
    await expect.poll(() => readField(control, kindOf(name)), { message: `task list field "${name}"` }).toBe(typed(name, cell));
  }
});

When('I press Enter in the task list field {string}', async function (this: World, name: string) {
  await field(dialog(this), TASKLIST_FIELDS, name).press('Enter');
});

Then('the task list field {string} has focus', async function (this: World, name: string) {
  await expect(field(dialog(this), TASKLIST_FIELDS, name)).toBeFocused();
});

When('I save the task list', async function (this: World) {
  await dialog(this).getByTestId('tasklist-save').click();
});

When('I cancel the task list dialog', async function (this: World) {
  await dialog(this).getByTestId('tasklist-cancel').click();
});

Then('the task list dialog is open', async function (this: World) {
  await expect(dialog(this)).toBeVisible();
});

Then('the task list dialog is closed', async function (this: World) {
  await expect(dialog(this)).toBeHidden();
});

Then('the task list dialog shows the error {string}', async function (this: World, message: string) {
  await expect(dialog(this).getByTestId('tasklist-error')).toHaveText(message);
});

// --- cards -----------------------------------------------------------------------------------------------------

Then('I see the task list {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(this.taskCard(title, date)).toBeVisible();
});

Then('I do not see the task list {string}', async function (this: World, title: string) {
  await this.settled();
  await expect(this.taskCards(title).locator('visible=true')).toHaveCount(0);
});

Then('the task list {string} shows the done count {string}', async function (this: World, title: string, count: string) {
  const expanded = this.byTestId('tasklist-expanded', attr('data-title', title));
  const target = (await expanded.count())
    ? expanded.getByTestId('tasklist-expanded-count')
    : this.taskCard(title).getByTestId('tasklist-card-count');
  await expect(target).toHaveText(exactText(count));
});

Then('the task list {string} shows no done count', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-count')).toHaveCount(0);
});

Then('the task list {string} shows the progress ring', async function (this: World, title: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-progress-ring')).toHaveCount(1);
});

Then('the task list {string} shows no progress ring', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-progress-ring')).toHaveCount(0);
});

Then('the task list {string} shows no progress bar', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-bar')).toHaveCount(0);
});

Then('the task list {string} shows the progress bar', async function (this: World, title: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-bar')).toHaveCount(1);
});

Then('the task list {string} is announced as {string}', async function (this: World, title: string, label: string) {
  await expect(this.taskCard(title)).toHaveAttribute('aria-label', label);
});

Then('the collapsed task list {string} lists the items {string}', async function (this: World, title: string, items: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-items')).toHaveText(exactText(items));
});

/** The one collapsed card of a list without a title (`data-untitled`), matched by its marker, never by a title. */
const titlelessCard = (world: World) => world.page.locator(`${tid('tasklist-card')}${attr('data-untitled', 'true')}`);

Then('the collapsed titleless task list lists the items {string}', async function (this: World, items: string) {
  await expect(titlelessCard(this)).toHaveCount(1);
  await expect(titlelessCard(this).getByTestId('tasklist-card-items')).toHaveText(exactText(items));
});

Then('the titleless task list has no title row and shows no item as its title', async function (this: World) {
  const card = titlelessCard(this);
  await expect(card.getByTestId('tasklist-card-title')).toHaveCount(0);
  await expect(card).toHaveAttribute('data-title', '');
  // the accessible name is neutral: a count, none of the items
  const label = (await card.getAttribute('aria-label')) ?? '';
  expect(label).toBe('Task list, 0 of 2 done');
  for (const item of await card.getByTestId('tasklist-card-item').all()) expect(label).not.toContain((await item.getAttribute('data-title')) ?? '');
});

/** Where an item sits in the collapsed card, relative to the title; null when it is hidden or outside the card. */
async function itemPlacement(world: World, list: string, item: string): Promise<'below' | 'beside' | null> {
  const card = world.taskCard(list);
  const el = card.getByTestId('tasklist-card-item').and(world.page.locator(attr('data-title', item)));
  if (!(await el.count()) || !(await el.isVisible())) return null;
  return el.evaluate((e, titleSel) => {
    const c = e.closest('[data-testid="tasklist-card"]')!.getBoundingClientRect();
    const t = e.closest('[data-testid="tasklist-card"]')!.querySelector(titleSel)!.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    const inside = r.width > 0 && r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
    if (!inside) return null;
    return r.top >= t.bottom - 1 ? 'below' : 'beside';
  }, '[data-testid="tasklist-card-title"]');
}

Then('the task list {string} shows the item {string} below its title', async function (this: World, list: string, item: string) {
  await expect.poll(() => itemPlacement(this, list, item)).toBe('below');
});

Then('the task list {string} shows the item {string} next to its title', async function (this: World, list: string, item: string) {
  await expect.poll(() => itemPlacement(this, list, item)).toBe('beside');
});

Then('the task list {string} does not show the item {string}', async function (this: World, list: string, item: string) {
  await expect(this.taskCard(list)).toBeVisible();
  const el = this.taskCard(list).getByTestId('tasklist-card-item').and(this.page.locator(attr('data-title', item)));
  await expect(el).toHaveCount(1);
  await expect(el).toBeHidden();
});

Then('the task list {string} shows its title without overlap', async function (this: World, list: string) {
  const card = this.taskCard(list);
  await expect(card.getByTestId('tasklist-card-title')).toBeVisible();
  // Poll until the layout settled: no visible text part of the card may intersect the title box.
  await expect.poll(() => card.evaluate((c) => {
    const box = (e: Element) => e.getBoundingClientRect();
    const t = box(c.querySelector('[data-testid="tasklist-card-title"]')!);
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    return ['tasklist-card-time', 'tasklist-card-items', 'tasklist-card-count']
      .flatMap((id) => [...c.querySelectorAll(`[data-testid="${id}"]`)])
      .filter((e) => { const r = box(e); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; })
      .filter((e) => (e.textContent ?? '').trim() !== '' && hit(t, box(e)))
      .map((e) => e.getAttribute('data-testid'));
  })).toEqual([]);
});

Then('the collapsed task list {string} shows {string}', async function (this: World, title: string, text: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-items')).toHaveText(exactText(text));
});

Then('the task list {string} is positioned at {time}', async function (this: World, title: string, time: string) {
  const card = this.taskCard(title);
  await expect(card).toHaveAttribute('data-time', time);
  await expectPositioned(this, card, time);
});

Then('the task list {string} is shown in the all-day area on {date}', async function (this: World, title: string, date: string) {
  const area = this.page.locator(
    `${tid('week-allday-cell')}${attr('data-date', date)}, ${tid('day-allday-area')}${attr('data-date', date)}`,
  );
  await expect(area.locator(`${tid('tasklist-card')}${attr('data-title', title)}`).first()).toBeVisible();
});

// --- expand / collapse -----------------------------------------------------------------------------------------

When('I expand the task list {string}', async function (this: World, title: string) {
  await expandTaskList(this, title);
});

When('I collapse the task list', async function (this: World) {
  await this.expanded.getByTestId('tasklist-close').click();
  await expect(this.expanded).toBeHidden();
});

/** The grown card over the calendar when there is one, else the list sheet or popover. */
const shownList = async (w: World) => ((await w.byTestId('tasklist-expanded', attr('data-presentation', 'overlay')).count()) ? w.byTestId('tasklist-expanded', attr('data-presentation', 'overlay')) : w.expanded);

Then('the expanded task list items are {string}', async function (this: World, list: string) {
  const shown = await shownList(this);
  const overlay = (await shown.getAttribute('data-presentation')) === 'overlay';
  await expectJoined(shown.getByTestId(overlay ? 'tasklist-card-item' : 'tasklist-item-title'), list);
});

Then('the expanded task list fits within the viewport', async function (this: World) {
  await expectInViewport(this.page, await shownList(this));
});

Then('the task list {string} is expanded', async function (this: World, title: string) {
  await expect(this.byTestId('tasklist-expanded', attr('data-title', title))).toBeVisible();
});

Then('the task list {string} is collapsed', async function (this: World, title: string) {
  await expect(this.byTestId('tasklist-expanded', attr('data-title', title))).toBeHidden();
  await expect(this.taskCard(title)).toBeVisible();
});

Then('no task list is expanded', async function (this: World) {
  // the grown card only: the list sheet has the same test id but is not an expansion
  await expect(this.page.locator(`${tid('tasklist-expanded')}${attr('data-presentation', 'overlay')}`)).toHaveCount(0);
});

// --- items (act on the expanded list) -------------------------------------------------------------------------

When('I tick the item {string}', async function (this: World, title: string) {
  // an open add field closes on blur and the sheet shrinks under the tap: let it close first
  await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  const item = await itemById(this, title);
  await expect(item).not.toHaveAttribute('data-done', 'true');
  await item.getByTestId('tasklist-item-checkbox').click();
});

When('I untick the item {string}', async function (this: World, title: string) {
  const item = await itemById(this, title);
  await expect(item).toHaveAttribute('data-done', 'true');
  await item.getByTestId('tasklist-item-checkbox').click();
});

Then('the item {string} is ticked', async function (this: World, title: string) {
  await expect(this.expandedItem(title)).toHaveAttribute('data-done', 'true');
});

Then('the item {string} is not ticked', async function (this: World, title: string) {
  const item = this.expandedItem(title);
  await expect(item).toHaveCount(1);
  await expect(item).not.toHaveAttribute('data-done', 'true');
});

When('I add the item {string}', async function (this: World, title: string) {
  // The add field sits behind the "+ Add item" button until opened.
  if (!(await this.expanded.getByTestId('tasklist-new-item').isVisible())) await this.expanded.getByTestId('tasklist-add').click();
  const input = this.expanded.getByTestId('tasklist-new-item');
  await input.fill(title);
  await input.press('Enter');
  // a repeating list asks "This week / All weeks" first (feature tasklist-repeating): the item shows once that is answered
  if (title.trim()) await expect(this.expandedItem(title.trim()).or(this.page.getByTestId('repeat-scope-dialog')).first()).toBeVisible();
});

async function editItemTitle(world: World, from: string, to: string, key: 'Enter' | 'Escape') {
  const item = await itemById(world, from);
  await item.getByTestId('tasklist-item-title').click();
  const input = item.getByTestId('tasklist-item-title-input');
  await input.fill(to);
  await input.press(key);
  await expect(input).toBeHidden();
}

When('I rename the item {string} to {string}', async function (this: World, from: string, to: string) {
  await editItemTitle(this, from, to, 'Enter');
});

When('I rename the item {string} to {string} but press Escape', async function (this: World, from: string, to: string) {
  await editItemTitle(this, from, to, 'Escape');
});

When('I delete the item {string}', async function (this: World, title: string) {
  const item = await itemById(this, title);
  await item.getByTestId('tasklist-item-delete').click();
  // a repeating list asks "This week / All weeks" first (feature tasklist-repeating)
  const asked = this.page.getByTestId('repeat-scope-dialog');
  await expect.poll(async () => (await item.count()) === 0 || (await asked.isVisible())).toBe(true);
});

When('I drag the item {string} above the item {string}', async function (this: World, title: string, above: string) {
  await dragItem(this, this.expanded, title, { above });
});

When('I long-press the item {string} and drag it above the item {string}', async function (this: World, title: string, above: string) {
  if (!this.testInfo.project.use.hasTouch) throw new Error('a long press needs the touch (mobile) project');
  await dragItem(this, this.expanded, title, { above });
});

When('I drag the item {string} and drop it where it was', async function (this: World, title: string) {
  await dragItem(this, this.expanded, title, 'home');
});

When('I drag the item {string} over the gap between {string} and {string} and hold', async function (this: World, title: string, upper: string, lower: string) {
  const grip = (await box((await itemById(this, title)).getByTestId('tasklist-item-grip')));
  const from = { x: Math.round(grip.x + grip.width / 2), y: Math.round(grip.y + grip.height / 2) };
  // just inside the upper half of the lower item: the place right after the upper one
  const lowerBox = await box(await itemById(this, lower));
  const to = { x: from.x, y: Math.round(lowerBox.y + 6) };
  void upper;
  if (this.testInfo.project.use.hasTouch) {
    const cdp = await this.context.newCDPSession(this.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    await this.page.waitForTimeout(500);
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: Math.round(from.y + ((to.y - from.y) * i) / 10), id: 1 }] });
    }
    this.held = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await cdp.detach().catch(() => {});
      this.held = undefined;
    };
  } else {
    const { mouse } = this.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move(to.x, to.y, { steps: 10 });
    this.held = async () => { await mouse.up(); this.held = undefined; };
  }
  // the card follows by spring and the other rows glide: wait until the lifted row is at rest
  await this.page.waitForTimeout(900);
});

Then('the items {string} and {string} do not overlap the dragged item {string} and it lies between them', async function (this: World, upper: string, lower: string, dragged: string) {
  const [u, l, d] = await Promise.all([upper, lower, dragged].map(async (t) => box(await itemById(this, t))));
  // the lifted card is drawn 5% larger (scale 1.05): a few px of tolerance for that
  expect(u.y + u.height, `"${upper}" ends above "${dragged}"`).toBeLessThanOrEqual(d.y + 4);
  expect(d.y + d.height, `"${dragged}" ends above "${lower}"`).toBeLessThanOrEqual(l.y + 4);
});

When('I tap the item {string}', async function (this: World, title: string) {
  await (await itemById(this, title)).getByTestId('tasklist-item-checkbox').tap();
});

When('I pick up the item {string}', async function (this: World, title: string) {
  const row = await itemById(this, title);
  const b = await box(row.getByTestId('tasklist-item-title'));
  const from = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  const cdp = await this.context.newCDPSession(this.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  this.heldAt = from;
  this.held = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
    await cdp.detach().catch(() => {});
    this.held = undefined;
    this.heldAt = undefined;
  };
  await this.page.waitForTimeout(500);
});

When('I release the item without moving it', async function (this: World) {
  if (!this.held) throw new Error('nothing is picked up');
  await this.held();
});

Then('the item {string} is lifted', async function (this: World, title: string) {
  await expect(this.expandedItem(title)).toHaveAttribute('data-dragging', 'true');
});

Then('the item {string} has the drag handle {string}', async function (this: World, title: string, label: string) {
  await expect(this.expandedItem(title).getByTestId('tasklist-item-grip')).toHaveAttribute('aria-label', label);
});

When('I edit the task list details', async function (this: World) {
  await chooseListAction(this.page, this.expanded, 'tasklist-edit');
  await expect(dialog(this)).toBeVisible();
});

When('I delete the task list', async function (this: World) {
  await chooseListAction(this.page, this.expanded, 'tasklist-delete');
});

const cardOf = (w: World, title: string) => w.page.getByTestId('tasklist-card').filter({ has: w.page.getByTestId('tasklist-card-title').getByText(title, { exact: true }) }).first();

Then('the items of the task list {string} fade out towards the bottom', async function (this: World, title: string) {
  const items = cardOf(this, title).getByTestId('tasklist-card-items');
  await expect.poll(() => items.evaluate((el) => { const c = getComputedStyle(el); return c.maskImage !== 'none' ? c.maskImage : c.webkitMaskImage; })).toContain('linear-gradient');
  // at least one visible item reaches into the faded band (the bottom 14 px)
  const reaches = await items.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll('[data-testid=tasklist-card-item]')].some((i) => { const r = i.getBoundingClientRect(); return r.height > 0 && r.bottom > box.bottom - 14; });
  });
  expect(reaches).toBe(true);
});

Then('the task list {string} shows no overflow count', async function (this: World, title: string) {
  const card = cardOf(this, title);
  await expect(card.getByTestId('tasklist-card-more')).toHaveCount(0);
  expect(await card.innerText()).not.toMatch(/\+\d|\bmore\b/);
});

Then('the title of the task list {string} is not covered', async function (this: World, list: string) {
  const t = this.taskCard(list).getByTestId('tasklist-card-title');
  await expect(t).toBeVisible();
  await t.scrollIntoViewIfNeeded();
  // Whatever is on top at the middle of the title must belong to this list's card.
  await expect.poll(() => t.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && el.closest('[data-testid="tasklist-card"]')!.contains(top);
  })).toBe(true);
});
