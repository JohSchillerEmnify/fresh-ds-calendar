/** Task list dialog, cards and expanded list steps (STEPS.md "Task lists"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Then, When } from './fixtures.js';
import { field, fillField, readField, type FieldKind } from './support/forms.js';
import { expectPositioned } from './support/grid.js';
import { expandTaskList } from './support/tasklist.js';
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
  await this.page.getByTestId('create-menu-tasklist').click();
  await expect(dialog(this)).toBeVisible();
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

Then('the collapsed task list {string} shows {string}', async function (this: World, title: string, text: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-items')).toHaveText(exactText(text));
});

Then('the task list {string} shows the time {string}', async function (this: World, title: string, time: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-time')).toContainText(time);
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

/** Stable locator for an item: resolved once by title, then addressed by data-item-id (survives edit mode). */
async function itemById(world: World, title: string) {
  const item = world.expandedItem(title);
  await expect(item).toHaveCount(1);
  const id = await item.getAttribute('data-item-id');
  return id ? world.expanded.locator(`${tid('tasklist-item')}${attr('data-item-id', id)}`) : item;
}

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
