/** Task categories switch steps (STEPS.md "Task categories switch"): the per-person setting that hides every category UI. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { inSheet } from './support/tasks-sheets.js';
import { attr, type World } from './support/world.js';
import { pathname } from './support/ui.js';
import { settingControl } from './support/settings.js';

const isPrefsPatch = (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH';

When('I turn the task categories {string}', async function (this: World, state: string) {
  if (state !== 'on' && state !== 'off') throw new Error(`Expected "on" or "off", got "${state}"`);
  const control = (await settingControl(this, 'settings-task-categories'));
  await expect(control).toBeVisible();
  if (((await control.getAttribute('aria-checked')) === 'true') === (state === 'on')) return;
  const saved = this.page.waitForResponse(isPrefsPatch);
  await control.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
});

Then('the settings page shows no categories', async function (this: World) {
  await expect((await settingControl(this, 'settings-task-categories'))).toBeVisible();
  await expect((await settingControl(this, 'settings-category'))).toHaveCount(0);
  await expect((await settingControl(this, 'settings-category-add'))).toHaveCount(0);
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

Given('task categories are off', async function (this: World) {
  await this.api.patch('/api/prefs', { taskCategories: false });
});

/** Labs view name -> path (from the date) and root testid. */
const LABS_VIEWS: Record<string, { path: (d: string) => string; root: string }> = {
  clock: { path: (d) => `/clock/${d}`, root: 'clock-view' },
  timeline: { path: () => '/timeline', root: 'timeline-view' },
  strip: { path: (d) => `/strip/${d}`, root: 'strip-view' },
  'zoom month': { path: (d) => `/zoom/${d}`, root: 'zoom-view' },
  horizontal: { path: (d) => `/horizontal/${d}`, root: 'htime-view' },
};
/** Root testid of the Labs view the page shows (by the first path segment). */
const labsRootOf = (w: World) => Object.values(LABS_VIEWS).find((v) => v.path('x').split('/')[1] === pathname(w.page).split('/')[1])!.root;

When('I open the Labs view {string} for {date}', async function (this: World, name: string, date: string) {
  const v = LABS_VIEWS[name];
  expect(v, `known Labs view "${name}"`).toBeDefined();
  await this.page.goto(v.path(date));
  await expect(this.page.getByTestId(v.root)).toBeVisible();
});

Then('the Labs view draws {string} in the colour of its calendar, never of its category', async function (this: World, title: string) {
  const { items } = await this.api.get<{ items: { kind: string; title: string; color: string; calendarColor: string }[] }>('/api/tasklists/all-open');
  const list = items.find((i) => i.kind === 'tasklist' && i.title === title);
  expect(list, `task list "${title}"`).toBeDefined();
  expect(list!.color.toLowerCase(), 'the category colour differs from the calendar colour').not.toBe(list!.calendarColor.toLowerCase());
  // every colour an element of the view is drawn with, as sRGB hex
  const drawn = () => this.page.getByTestId(labsRootOf(this)).evaluate((root) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const hex = (v: string) => { ctx.fillStyle = '#000'; ctx.fillStyle = v; return ctx.fillStyle; };
    const out = new Set<string>();
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor, cs.outlineColor, cs.fill, cs.stroke, cs.getPropertyValue('--c').trim()]) {
        if (v && v !== 'none' && CSS.supports('color', v)) out.add(hex(v).toLowerCase());
      }
    }
    return [...out];
  });
  await expect.poll(async () => (await drawn()).includes(list!.calendarColor.toLowerCase()), { message: 'drawn in the calendar colour' }).toBe(true);
  expect(await drawn(), 'never in the category colour').not.toContain(list!.color.toLowerCase());
});
