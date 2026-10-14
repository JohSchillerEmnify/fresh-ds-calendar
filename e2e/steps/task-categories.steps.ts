/** Task categories switch steps (STEPS.md "Task categories switch"): the per-person setting that hides every category UI. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { inSheet } from './support/tasks-sheets.js';
import { attr, type World } from './support/world.js';
import { pathname } from './support/ui.js';

const isPrefsPatch = (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH';

When('I turn the task categories {string}', async function (this: World, state: string) {
  if (state !== 'on' && state !== 'off') throw new Error(`Expected "on" or "off", got "${state}"`);
  const control = this.page.getByTestId('settings-task-categories');
  await expect(control).toBeVisible();
  if (((await control.getAttribute('aria-checked')) === 'true') === (state === 'on')) return;
  const saved = this.page.waitForResponse(isPrefsPatch);
  await control.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
});

Then('the settings page shows no categories', async function (this: World) {
  await expect(this.page.getByTestId('settings-task-categories')).toBeVisible();
  await expect(this.page.getByTestId('settings-category')).toHaveCount(0);
  await expect(this.page.getByTestId('settings-category-add')).toHaveCount(0);
});

Then('the Tasks view offers no category filter, grouping or sorting', async function (this: World) {
  if (pathname(this.page) !== '/tasks') await this.page.goto('/tasks');
  await expect(this.page.getByTestId('tasks-view')).toBeVisible();
  await inSheet(this, 'filter', async () => {
    await expect(this.page.getByTestId('tasks-filter-when')).toBeVisible();
    await expect(this.page.getByTestId('tasks-filter-category')).toHaveCount(0);
  });
  await inSheet(this, 'sort', async () => {
    await expect(this.page.getByTestId('tasks-group-by')).toBeVisible();
    await expect(this.page.getByTestId('tasks-group-by').getByRole('button', { name: 'Category' })).toHaveCount(0);
    await expect(this.page.getByTestId('tasks-sort-by')).not.toContainText('Category');
  });
});

Then('the task list dialog has no category field', async function (this: World) {
  const dialog = this.page.getByTestId('tasklist-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('tasklist-category')).toHaveCount(0);
});

Then('the task lists {string} and {string} have the same color', async function (this: World, a: string, b: string) {
  const color = await this.taskCard(a).getAttribute('data-color');
  expect(color).toBeTruthy();
  await expect(this.taskCard(b)).toHaveAttribute('data-color', color!);
});

When('I retitle the task list {string} to {string} in the Tasks view', async function (this: World, from: string, to: string) {
  if (pathname(this.page) !== '/tasks') await this.page.goto('/tasks');
  await this.byTestId('tasks-item', attr('data-title', from)).getByTestId('tasklist-expanded-title').click();
  const dialog = this.page.getByTestId('tasklist-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('tasklist-title').fill(to);
  const saved = this.page.waitForResponse((r) => /^\/api\/tasklists\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH');
  await dialog.getByTestId('tasklist-save').click();
  expect((await saved).status(), 'task list saved').toBe(200);
});

When('I open the new task list dialog in the Tasks view', async function (this: World) {
  if (pathname(this.page) !== '/tasks') await this.page.goto('/tasks');
  await this.page.getByTestId('create-button').click();
  await expect(this.page.getByTestId('tasklist-dialog')).toBeVisible();
});
