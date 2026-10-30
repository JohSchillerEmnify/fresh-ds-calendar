/** Tasks archive steps (STEPS.md "Tasks archive"): the Archive tab of the Tasks view. */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { expectJoined, pathname } from './support/ui.js';
import { attr, exactText, type World } from './support/world.js';

/** The date of the Background (`today is …`) that fixtures return the test clock to. */
const BACKGROUND_TODAY = '2026-10-12';

const isTasklistWrite = (method: string, tail = '') => (r: { url(): string; request(): { method(): string } }) =>
  new RegExp(`^/api/tasklists/[^/]+${tail}$`).test(new URL(r.url()).pathname) && r.request().method() === method;

/** Show the Tasks view (through the navigation when the app is open, else by its path). */
async function openTasksView(world: World) {
  if (pathname(world.page) !== '/tasks') {
    const nav = world.page.getByTestId('view-switch-tasks');
    if (world.page.url().startsWith('http') && (await nav.isVisible())) await nav.click();
    else await world.page.goto('/tasks');
  }
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}
async function openTab(world: World, tab: 'open' | 'archive') {
  await openTasksView(world);
  const button = world.page.getByTestId(`tasks-tab-${tab}`);
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}
const archiveItem = (w: World, title: string): Locator => w.byTestId('tasks-archive-item', attr('data-title', title));

/** An undated list whose items are all ticked while the test clock stands on `date` (so `completedOn` = date). */
export async function finishedList(world: World, title: string, date: string, itemTitle: string | { title: string; strokes: unknown[] }[]) {
  const before = (await world.api.get<{ plant: { growth: number; lastWatered: string | null; todayPoints: number } }>('/api/motivation')).plant;
  await world.api.setClock(berlinIso(date, '08:00'));
  const list = await world.api.post<{ id: string; items: { id: string }[] }>('/api/tasklists', { title, date: null, items: typeof itemTitle === 'string' ? [{ title: itemTitle }] : itemTitle });
  for (const i of list.items) await world.api.patch(`/api/tasklists/${list.id}/items/${i.id}`, { done: true });
  await world.api.setClock(berlinIso(BACKGROUND_TODAY, '08:00'));
  await world.api.setMotivation({ plant: { growth: before.growth, lastWatered: before.lastWatered, todayPoints: before.todayPoints } });
}

Given('the calendar contains a task list {string} finished on {date}', async function (this: World, title: string, date: string) {
  await finishedList(this, title, date, 'Done');
});

Given('the calendar contains a task list {string} finished on {date} with the item {string}', async function (this: World, title: string, date: string, itemTitle: string) {
  await finishedList(this, title, date, itemTitle);
});

Given('the setting {string} is {string}', async function (this: World, setting: string, value: string) {
  expect(setting).toBe('Finished list without a date');
  await this.api.patch('/api/prefs', { undatedDone: value === 'Archive only' ? 'archive' : 'calendar' });
});

When('I open the Archive', async function (this: World) {
  await openTab(this, 'archive');
});

When('I search the Archive for {string}', async function (this: World, text: string) {
  await openTab(this, 'archive');
  await this.page.getByTestId('tasks-archive-search').fill(text);
});

When('I untick the item {string} of the task list {string} in the Archive', async function (this: World, itemTitle: string, title: string) {
  await openTab(this, 'archive');
  const row = archiveItem(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  await expect(row).toHaveAttribute('data-done', 'true');
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH', '/items/[^/]+'));
  await row.getByTestId('tasklist-item-checkbox').click();
  expect((await saved).status(), 'untick saved').toBe(200);
});

When('I choose {string} for the task list {string} in the Archive', async function (this: World, choice: string, title: string) {
  expect(['Copy', 'Save as template']).toContain(choice);
  await openTab(this, 'archive');
  // "Save as template" (feature tasklist-templates) only opens the name sheet; the next steps fill and confirm it
  if (choice === 'Save as template') {
    await archiveItem(this, title).getByTestId('tasklist-save-template').click();
    await expect(this.page.getByTestId('template-save-dialog')).toBeVisible();
    return;
  }
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
  await archiveItem(this, title).getByTestId('tasks-archive-duplicate').click();
  expect((await saved).status(), 'copy created').toBe(201);
});

Then('the task list {string} in the Archive offers {string} and {string}', async function (this: World, title: string, copy: string, save: string) {
  await openTab(this, 'archive');
  await expect(archiveItem(this, title).getByTestId('tasks-archive-duplicate')).toHaveText(exactText(copy));
  await expect(archiveItem(this, title).getByTestId('tasklist-save-template')).toHaveText(exactText(save));
});

Then('the Archive lists {string}', async function (this: World, titles: string) {
  await openTab(this, 'archive');
  await expectJoined(this.byTestId('tasks-archive-item'), titles, 'data-title');
});

Then('the Archive does not list {string}', async function (this: World, title: string) {
  await openTab(this, 'archive');
  await expect(archiveItem(this, title)).toHaveCount(0);
});

Then('the Open tab lists {string}', async function (this: World, title: string) {
  await openTab(this, 'open');
  await expect(this.byTestId('tasks-item', attr('data-title', title))).toHaveCount(1);
});

Then('the Open tab does not list {string}', async function (this: World, title: string) {
  await openTab(this, 'open');
  await expect(this.byTestId('tasks-item', attr('data-title', title))).toHaveCount(0);
});

Then('the open task list {string} has no date and {int} open item(s)', async function (this: World, title: string, count: number) {
  await openTab(this, 'open');
  const list = this.byTestId('tasks-item', attr('data-title', title));
  await expect(list).toHaveAttribute('data-date', '');
  await expect(list.getByTestId('tasklist-item')).toHaveCount(count);
  await expect(list.locator('[data-testid="tasklist-item"][data-done="false"]')).toHaveCount(count);
});
