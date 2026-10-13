/** Tasks filter steps (STEPS.md "Tasks filter"): the one filter row of the Tasks view and how the Canvas dims notes. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { expectJoined, pathname } from './support/ui.js';
import { inSheet } from './support/tasks-sheets.js';
import { attr, exactText, type World } from './support/world.js';

/** The date of the Background (`today is …`) that fixtures return the test clock to. */
const BACKGROUND_TODAY = '2026-10-12';
const WHEN_VALUES: Record<string, string> = {
  All: 'all', 'No date': 'nodate', Dated: 'dated', Overdue: 'overdue', Today: 'today', Tomorrow: 'tomorrow', 'This week': 'week',
};

const isPrefsPatch = (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH';

/** Show the Tasks view (through the navigation when the app is open, else by its path). */
async function openTasksView(world: World) {
  if (pathname(world.page) === '/tasks') return;
  const nav = world.page.getByTestId('view-switch-tasks');
  if (world.page.url().startsWith('http') && (await nav.isVisible())) await nav.click();
  else await world.page.goto('/tasks');
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}

/** A chip's text is the category's icon (when it has one) and its name, so the name is matched at the end. */
const endsWith = (name: string): RegExp => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

/** Runs `act` (a click) and waits for the `PATCH /api/prefs` it sends. */
async function savedPrefs(world: World, act: () => Promise<void>) {
  const saved = world.page.waitForResponse(isPrefsPatch);
  await act();
  expect((await saved).status(), 'filter saved').toBe(200);
}

Given(
  'the calendar contains a task list {string} in the category {string} finished on {date}',
  async function (this: World, title: string, category: string, date: string) {
    const before = (await this.api.get<{ plant: { growth: number; lastWatered: string | null; todayPoints: number } }>('/api/motivation')).plant;
    const categoryId = await this.api.categoryId(category);
    await this.api.setClock(berlinIso(date, '08:00'));
    const list = await this.api.post<{ id: string; items: { id: string }[] }>('/api/tasklists', { title, date: null, categoryId, items: [{ title: 'Done' }] });
    for (const i of list.items) await this.api.patch(`/api/tasklists/${list.id}/items/${i.id}`, { done: true });
    await this.api.setClock(berlinIso(BACKGROUND_TODAY, '08:00'));
    await this.api.setMotivation({ plant: { growth: before.growth, lastWatered: before.lastWatered, todayPoints: before.todayPoints } });
  },
);

When('I filter the Tasks view by the category {string}', async function (this: World, name: string) {
  await openTasksView(this);
  await inSheet(this, 'filter', async () => {
    const chip = this.page.getByTestId('tasks-filter-category').filter({ hasText: endsWith(name) });
    await savedPrefs(this, () => chip.click());
  });
});

When('I choose {string} as the Tasks view When filter', async function (this: World, label: string) {
  await openTasksView(this);
  await inSheet(this, 'filter', async () => {
    const option = this.page.getByTestId('tasks-filter-when-option').filter({ hasText: exactText(label) });
    await savedPrefs(this, () => option.click());
  });
});

When('I clear the Tasks view filters', async function (this: World) {
  await inSheet(this, 'filter', async () => {
    await savedPrefs(this, () => this.page.getByTestId('tasks-filter-clear').click());
    await expect(this.page.getByTestId('tasks-filter-clear')).toHaveCount(0);
  });
});

Then('the Tasks view category filter {string} is on', async function (this: World, name: string) {
  await inSheet(this, 'filter', async () => {
    const chip = this.page.getByTestId('tasks-filter-category').filter({ hasText: endsWith(name) });
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});

Then('the Tasks view When filter is {string}', async function (this: World, label: string) {
  await inSheet(this, 'filter', () => expect(this.page.getByTestId('tasks-filter-when')).toHaveAttribute('data-value', WHEN_VALUES[label]!));
});

async function openSheet(world: World, kind: 'filter' | 'sort') {
  await openTasksView(world);
  await world.page.getByTestId(`tasks-${kind}-open`).click();
  await expect(world.page.getByTestId(`tasks-${kind}-sheet`)).toBeVisible();
}

When('I open the Tasks view filter sheet', async function (this: World) {
  await openSheet(this, 'filter');
});

When('I open the Tasks view sort sheet', async function (this: World) {
  await openSheet(this, 'sort');
});

When('I close the Tasks view sheet', async function (this: World) {
  await this.page.getByTestId('tasks-sheet-done').click();
  await expect(this.page.getByTestId('tasks-sheet-done')).toHaveCount(0);
});

Then('the Tasks view shows the active filters {string}', async function (this: World, labels: string) {
  await expectJoined(this.page.getByTestId('tasks-filter-active'), labels);
});

When('I remove the active filter {string}', async function (this: World, label: string) {
  await savedPrefs(this, () => this.page.getByTestId('tasks-filter-active').filter({ hasText: exactText(label) }).click());
});

Then('the note {string} is dimmed', async function (this: World, title: string) {
  await expect(this.byTestId('canvas-note', attr('data-title', title))).toHaveAttribute('data-dimmed', 'true');
});

Then('the note {string} is not dimmed', async function (this: World, title: string) {
  await expect(this.byTestId('canvas-note', attr('data-title', title))).toHaveAttribute('data-dimmed', 'false');
});
