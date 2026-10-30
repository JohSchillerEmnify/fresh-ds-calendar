/** Repeating task list steps (STEPS.md "Repeating task lists"): the "This week / All weeks" choice. */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { addDays } from './support/dates.js';
import { itemsFrom } from './support/tables.js';
import { attr, exactText, type World } from './support/world.js';

const choice = (w: World) => w.page.getByTestId('repeat-scope-dialog');

interface ListRow { id: string; title: string; kind: string; items: { id: string; title: string; done: boolean }[] }

Given('the calendar contains a weekly task list {string} on Mondays since {date} with items:', async function (this: World, title: string, since: string, table: DataTable) {
  await this.api.post('/api/tasklists', { title, date: since, time: null, items: itemsFrom(table), recurrence: 'weekly' });
});

Given('{string} of {string} was ticked on {date}', async function (this: World, item: string, title: string, date: string) {
  // the week of that date, as a range read lists it (its occurrence id): the tick splits that week off
  const r = await this.api.get<{ items: ListRow[] }>(`/api/items?from=${date}&to=${addDays(date, 1)}`);
  const l = r.items.find((x) => x.kind === 'tasklist' && x.title === title);
  if (!l) throw new Error(`no task list "${title}" on ${date}`);
  const it = l.items.find((i) => i.title === item);
  if (!it) throw new Error(`no item "${item}" in "${title}" on ${date}`);
  await this.api.patch(`/api/tasklists/${encodeURIComponent(l.id)}/items/${encodeURIComponent(it.id)}`, { done: true });
});

When('I rename the expanded task list to {string}', async function (this: World, title: string) {
  await this.expanded.getByTestId('tasklist-expanded-title').click();
  const input = this.expanded.getByTestId('tasklist-expanded-title-input');
  await input.fill(title);
  await input.press('Enter');
  await expect(input).toBeHidden();
});

Then('I am asked whether to change {string} or {string}', async function (this: World, one: string, following: string) {
  await expect(choice(this)).toBeVisible();
  await expect(choice(this).getByTestId('repeat-scope-this')).toHaveText(exactText(one));
  await expect(choice(this).getByTestId('repeat-scope-following')).toHaveText(exactText(following));
});

Then('{string} is chosen', async function (this: World, label: string) {
  const option = choice(this).locator(`label${attr('data-checked', 'true')}`);
  await expect(option).toHaveText(exactText(label));
});

When('I choose {string} for the change', async function (this: World, label: string) {
  await expect(choice(this)).toBeVisible();
  const following = label === (await choice(this).getByTestId('repeat-scope-following').textContent())?.trim();
  // the write this choice sends (an item delete waits for its undo time instead)
  const written = this.page.waitForResponse((r) => {
    const u = new URL(r.url());
    return r.request().method() !== 'GET' && u.pathname.startsWith('/api/tasklists/') && (!following || u.searchParams.get('scope') === 'following');
  });
  await choice(this).getByTestId(following ? 'repeat-scope-following' : 'repeat-scope-this').click();
  await choice(this).getByTestId('repeat-scope-ok').click();
  await expect(choice(this)).toBeHidden();
  const undo = this.page.getByTestId('undo-snackbar');
  await Promise.race([written.then((r) => expect(r.status()).toBeLessThan(300)), undo.waitFor()]);
});

When('I cancel the choice', async function (this: World) {
  await choice(this).getByTestId('repeat-scope-cancel').click();
  await expect(choice(this)).toBeHidden();
});

Then('I am not asked which task lists to change', async function (this: World) {
  await expect(choice(this)).toHaveCount(0);
});

Then('the task list {string} has no estimate', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-estimate')).toHaveCount(0);
});
