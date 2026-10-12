/** Task list dialog, cards and expanded list steps (STEPS.md "Task lists"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Then, When } from './fixtures.js';
import { field, fillField, readField, type FieldKind } from './support/forms.js';
import { expectPositioned } from './support/grid.js';
import { expandTaskList, itemById } from './support/tasklist.js';
import { cellValue, formRows } from './support/tables.js';
import { expectBottomSheet, expectInViewport, expectJoined } from './support/ui.js';
import { attr, exactText, tid, type World } from './support/world.js';

const dialog = (w: World) => w.page.getByTestId('tasklist-dialog');

const TASKLIST_FIELDS: Record<string, string> = {
  title: 'tasklist-title',
  date: 'tasklist-date',
  time: 'tasklist-time',
  items: 'tasklist-items',
  category: 'tasklist-category',
  tags: 'tasklist-tags',
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

Then('the collapsed task list {string} lists the items {string}', async function (this: World, title: string, items: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-items')).toHaveText(exactText(items));
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

Then('the task list {string} is expanded', async function (this: World, title: string) {
  await expect(this.byTestId('tasklist-expanded', attr('data-title', title))).toBeVisible();
});

Then('the task list {string} is collapsed', async function (this: World, title: string) {
  await expect(this.byTestId('tasklist-expanded', attr('data-title', title))).toBeHidden();
  await expect(this.taskCard(title)).toBeVisible();
});

Then('the expanded task list items are {string}', async function (this: World, list: string) {
  await expectJoined(this.expanded.getByTestId('tasklist-item-title'), list);
});

Then('the expanded task list is shown as a bottom sheet', async function (this: World) {
  await expectBottomSheet(this.page, this.expanded);
});

Then('the expanded task list fits within the viewport', async function (this: World) {
  await expectInViewport(this.page, this.expanded);
});

// --- items (act on the expanded list) -------------------------------------------------------------------------

When('I tick the item {string}', async function (this: World, title: string) {
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
  if (title.trim()) await expect(this.expandedItem(title.trim())).toHaveCount(1);
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
  await expect(item).toHaveCount(0);
});

When('I move the item {string} up', async function (this: World, title: string) {
  await (await itemById(this, title)).getByTestId('tasklist-item-up').click();
});

When('I move the item {string} down', async function (this: World, title: string) {
  await (await itemById(this, title)).getByTestId('tasklist-item-down').click();
});

When('I rename the task list to {string}', async function (this: World, title: string) {
  await this.expanded.getByTestId('tasklist-expanded-title').click();
  const input = this.expanded.getByTestId('tasklist-expanded-title-input');
  await input.fill(title);
  await input.press('Enter');
  await expect(input).toBeHidden();
});

When('I edit the task list details', async function (this: World) {
  await this.expanded.getByTestId('tasklist-edit').click();
  await expect(dialog(this)).toBeVisible();
});

When('I delete the task list', async function (this: World) {
  await this.expanded.getByTestId('tasklist-delete').click();
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
