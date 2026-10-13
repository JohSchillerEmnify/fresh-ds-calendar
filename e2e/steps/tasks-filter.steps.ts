/** Tasks filter steps (STEPS.md "Tasks filter"): the one filter row of the Tasks view and how the Canvas dims notes. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { pathname } from './support/ui.js';
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
  const chip = this.page.getByTestId('tasks-filter-category').filter({ hasText: exactText(name) });
  await savedPrefs(this, () => chip.click());
});

When('I choose {string} as the Tasks view When filter', async function (this: World, label: string) {
  await openTasksView(this);
  await this.page.getByTestId('tasks-filter-when').click();
  const option = this.page.getByTestId('tasks-filter-when-option').filter({ hasText: exactText(label) });
  await savedPrefs(this, () => option.click());
});

When('I clear the Tasks view filters', async function (this: World) {
  await savedPrefs(this, () => this.page.getByTestId('tasks-filter-clear').click());
  await expect(this.page.getByTestId('tasks-filter-clear')).toHaveCount(0);
});

Then('the Tasks view category filter {string} is on', async function (this: World, name: string) {
  const chip = this.page.getByTestId('tasks-filter-category').filter({ hasText: exactText(name) });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

Then('the Tasks view When filter is {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId('tasks-filter-when')).toHaveAttribute('data-value', WHEN_VALUES[label]!);
});

Then('the note {string} is dimmed', async function (this: World, title: string) {
  await expect(this.byTestId('canvas-note', attr('data-title', title))).toHaveAttribute('data-dimmed', 'true');
});

Then('the note {string} is not dimmed', async function (this: World, title: string) {
  await expect(this.byTestId('canvas-note', attr('data-title', title))).toHaveAttribute('data-dimmed', 'false');
});
