/** Tasks view steps (STEPS.md "Tasks view"): the view of every open task list, with and without a date. */
import { expect, type Locator } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { itemsFrom } from './support/tables.js';
import { chooseOption, expectJoined, pathname, selectedLabel } from './support/ui.js';
import { attr, exactText, type World } from './support/world.js';

const isTasklistWrite = (method: string, tail = '') => (r: { url(): string; request(): { method(): string } }) =>
  new RegExp(`^/api/tasklists/[^/]+${tail}$`).test(new URL(r.url()).pathname) && r.request().method() === method;
const isPrefsPatch = (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH';

/** Show the Tasks view: through the navigation when the app is open, else by its path. */
async function openTasksView(world: World) {
  if (pathname(world.page) === '/tasks') return;
  const nav = world.page.getByTestId('view-switch-tasks');
  if (world.page.url().startsWith('http') && (await nav.isVisible())) await nav.click();
  else await world.page.goto('/tasks');
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}

const item = (w: World, title: string): Locator => w.byTestId('tasks-item', attr('data-title', title));

Given('the calendar contains an undated task list {string} with items:', async function (this: World, title: string, table: DataTable) {
  // a fixture is not user activity: the plant state is restored afterwards (STEPS.md, A-T2)
  const before = (await this.api.get<{ plant: { growth: number; lastWatered: string | null; todayPoints: number } }>('/api/motivation')).plant;
  await this.api.post('/api/tasklists', { title, date: null, items: itemsFrom(table) });
  await this.api.setMotivation({ plant: { growth: before.growth, lastWatered: before.lastWatered, todayPoints: before.todayPoints } });
});

When('I open the Tasks view', async function (this: World) {
  await openTasksView(this);
});

When('I create the task list {string} in the Tasks view', async function (this: World, title: string) {
  await openTasksView(this);
  await this.page.getByTestId('create-button').click();
  const dialog = this.page.getByTestId('tasklist-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('tasklist-title').fill(title);
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
  await dialog.getByTestId('tasklist-save').click();
  expect((await saved).status(), 'task list saved').toBe(201);
});

When('I choose {string} for the task list {string} in the Tasks view', async function (this: World, choice: string, title: string) {
  await openTasksView(this);
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  await item(this, title).getByTestId(choice === 'Today' ? 'tasks-today' : 'tasks-tomorrow').click();
  expect((await saved).status(), 'date saved').toBe(200);
});

When('I remove the date of the task list {string} in the Tasks view', async function (this: World, title: string) {
  await openTasksView(this);
  await item(this, title).getByTestId('tasklist-expanded-title').click();
  const dialog = this.page.getByTestId('tasklist-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('tasklist-no-date').click();
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  await dialog.getByTestId('tasklist-save').click();
  expect((await saved).status(), 'task list saved').toBe(200);
});

When('I group the Tasks view by {string}', async function (this: World, label: string) {
  await openTasksView(this);
  const control = this.page.getByTestId('tasks-group-by');
  if ((await selectedLabel(control)) === label) return;
  const saved = this.page.waitForResponse(isPrefsPatch);
  await chooseOption(control, label);
  expect((await saved).status(), 'grouping saved').toBe(200);
});

When('I sort the Tasks view by {string}', async function (this: World, label: string) {
  await openTasksView(this);
  const control = this.page.getByTestId('tasks-sort-by');
  if ((await selectedLabel(control)) === label) return;
  const saved = this.page.waitForResponse(isPrefsPatch);
  await chooseOption(control, label);
  expect((await saved).status(), 'sorting saved').toBe(200);
});

When('I tick the item {string} of the task list {string} in the Tasks view', async function (this: World, itemTitle: string, title: string) {
  await openTasksView(this);
  const row = item(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  await expect(row).toHaveAttribute('data-done', 'false');
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH', '/items/[^/]+'));
  await row.getByTestId('tasklist-item-checkbox').click();
  expect((await saved).status(), 'tick saved').toBe(200);
});

Then('the Tasks view lists {string} under {string}', async function (this: World, title: string, group: string) {
  const g = this.byTestId('tasks-group').filter({ has: this.page.getByTestId('tasks-group-title').filter({ hasText: exactText(group) }) });
  await expect(g.locator(`[data-testid="tasks-item"]${attr('data-title', title)}`)).toHaveCount(1);
});

Then('the Tasks view lists {string}', async function (this: World, titles: string) {
  await expectJoined(this.byTestId('tasks-item'), titles, 'data-title');
});

Then('the Tasks view groups are {string}', async function (this: World, titles: string) {
  await expectJoined(this.byTestId('tasks-group-title'), titles);
});

Then('the Tasks view is grouped by {string}', async function (this: World, label: string) {
  await expect.poll(() => selectedLabel(this.page.getByTestId('tasks-group-by'))).toBe(label);
});

Then('the calendar shows the task list {string} on {date}', async function (this: World, title: string, date: string) {
  await this.page.goto(`/day/${date}`);
  await expect(this.taskCard(title, date)).toBeVisible();
});

Then('neither the calendar on {date} nor the open tasks tray shows the task list {string}', async function (this: World, date: string, title: string) {
  // the tray's own fetch must have finished, or "not listed" would pass on an empty tray
  const trayLoaded = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists/open');
  await this.page.goto(`/day/${date}`);
  await trayLoaded;
  await this.settled();
  await expect(this.taskCards(title).locator('visible=true')).toHaveCount(0);
  const rows = this.page.getByTestId('task-tray-item');
  const toggle = this.page.getByTestId('task-tray-toggle');
  if (!(await rows.first().isVisible()) && (await toggle.isVisible())) await toggle.click();
  await expect(this.byTestId('task-tray-item', attr('data-title', title))).toHaveCount(0);
});
