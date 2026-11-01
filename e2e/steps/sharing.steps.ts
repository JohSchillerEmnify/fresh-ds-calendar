/**
 * Sharing steps (STEPS.md "Sharing task lists"). The signed-in browser is one person; the other person acts through the
 * API with a session of their own (a second cookie jar signed in through the OAuth test double).
 */
import { expect, type APIRequestContext } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { attr, exactText, type World } from './support/world.js';
import { openSettingsPage } from './support/settings.js';

interface Listed { id: string; title: string; items: { id: string; title: string; done: boolean }[] }

/** Per scenario: one API session per person. */
const sessions = new WeakMap<World, Map<string, APIRequestContext>>();

/** The name the people picker shows for an address (the OAuth test double names a person by the part before the `@`). */
const nameOf = (email: string) => email.split('@')[0]!;

/** An API client signed in as this person (own cookie jar, kept for the scenario). */
async function session(world: World, email: string): Promise<APIRequestContext> {
  let mine = sessions.get(world);
  if (!mine) sessions.set(world, (mine = new Map()));
  const known = mine.get(email);
  if (known) return known;
  const context = await world.browser.newContext({ baseURL: world.baseURL });
  world.track(context);
  await world.api.chooseGoogleAccount(email);
  // start -> fake consent -> callback: the request client follows the redirects and keeps the session cookie
  await context.request.get('/api/auth/google/start');
  mine.set(email, context.request);
  return context.request;
}

export async function call<T = unknown>(world: World, email: string, method: string, url: string, data?: unknown): Promise<{ status: number; body: T }> {
  const res = await (await session(world, email)).fetch(url, { method, data, failOnStatusCode: false });
  const text = await res.text();
  return { status: res.status(), body: (text ? JSON.parse(text) : null) as T };
}

const listsOf = async (world: World, email: string): Promise<Listed[]> => (await call<{ items: Listed[] }>(world, email, 'GET', '/api/tasklists/all-open')).body.items;

async function find(world: World, email: string, title: string): Promise<Listed> {
  const found = (await listsOf(world, email)).find((l) => l.title === title);
  if (!found) throw new Error(`${email} has no task list "${title}"`);
  return found;
}

/** The Tasks view of the signed-in person. */
async function openTasksView(world: World) {
  if (new URL(world.page.url()).pathname !== '/tasks') await world.page.getByTestId('view-switch-tasks').click();
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}

/** Opens the task list dialog of a list in the Tasks view. */
async function openDialog(world: World, title: string) {
  await openTasksView(world);
  await world.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-expanded-title').click();
  await expect(world.page.getByTestId('tasklist-dialog')).toBeVisible();
}

const isCall = (method: string, tail: string) => (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname.endsWith(tail) && r.request().method() === method;

Given('{string}, {string} and {string} may use the calendar', async function (this: World, a: string, b: string, c: string) {
  await this.api.setAuth([a, b, c]);
});

Given('{string} has an undated task list {string} with the items {string}', async function (this: World, owner: string, title: string, items: string) {
  await this.api.post('/api/__test/tasklists', { owner, title, items: items.split(', ') });
});

Given('{string} has an undated task list {string} with the items {string} in the category {string}',
  async function (this: World, owner: string, title: string, items: string, category: string) {
    await this.api.post('/api/__test/tasklists', { owner, title, items: items.split(', '), category });
  });

When('I share the task list {string} with {string}', async function (this: World, title: string, email: string) {
  await openDialog(this, title);
  const dialog = this.page.getByTestId('tasklist-dialog');
  await dialog.getByTestId('tasklist-share-person').selectOption({ label: nameOf(email) });
  const saved = this.page.waitForResponse(isCall('POST', '/share'));
  await dialog.getByTestId('tasklist-share').click();
  expect((await saved).status(), 'list shared').toBe(200);
  await expect(dialog).toBeHidden();
});

When('I stop sharing the task list {string}', async function (this: World, title: string) {
  await openDialog(this, title);
  const dialog = this.page.getByTestId('tasklist-dialog');
  const saved = this.page.waitForResponse(isCall('DELETE', '/share'));
  await dialog.getByTestId('tasklist-unshare').click();
  expect((await saved).status(), 'sharing stopped').toBe(200);
  await expect(dialog).toBeHidden();
});

When('I share the category {string} with {string} in the settings', async function (this: World, category: string, email: string) {
  await openSettingsPage(this, 'tasklists');
  await this.byTestId('settings-category', attr('data-name', category)).locator('.catmain').click();
  const dialog = this.page.getByTestId('category-dialog');
  await dialog.getByTestId('category-share-person').selectOption({ label: nameOf(email) });
  const saved = this.page.waitForResponse(isCall('PUT', '/share'));
  await dialog.getByTestId('category-save').click();
  expect((await saved).status(), 'category shared').toBe(200);
  await expect(dialog).toBeHidden();
});

When('{string} creates the undated task list {string} in the category {string}', async function (this: World, email: string, title: string, category: string) {
  const { body } = await call<{ categories: { id: string; name: string }[] }>(this, email, 'GET', '/api/settings');
  const id = body.categories.find((c) => c.name === category)?.id;
  expect(id, `category ${category}`).toBeTruthy();
  const made = await call(this, email, 'POST', '/api/tasklists', { title, date: null, items: [{ title: 'x' }], categoryId: id });
  expect(made.status, 'list created').toBe(201);
});

/** A fresh device signed in as this person, on the Tasks view. */
async function openTasksOnNewDevice(world: World, email: string) {
  await world.switchDevice();
  world.person = email;
  await world.api.chooseGoogleAccount(email);
  await world.page.goto('/tasks');
  await world.page.getByTestId('signin-google').click();
  await world.page.waitForURL((u) => u.pathname !== '/signin');
  // the return to /tasks after the round trip is not guaranteed (sometimes the start view wins): switch by hand then
  await expect(world.page.getByTestId('view-switch-tasks')).toBeVisible();
  await world.page.waitForLoadState('networkidle');
  if (new URL(world.page.url()).pathname !== '/tasks') await world.page.getByTestId('view-switch-tasks').click();
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}

When('{string} opens the Tasks view on another device', async function (this: World, email: string) {
  await openTasksOnNewDevice(this, email);
});

When('{string} edits the shared task list {string}', async function (this: World, email: string, title: string) {
  await openTasksOnNewDevice(this, email);
  await openDialog(this, title);
});

When('I delete the shared task list {string}', async function (this: World, title: string) {
  await openDialog(this, title);
  const gone = this.page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.startsWith('/api/tasklists/'), { timeout: 20_000 });
  await this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-delete').click();
  expect((await gone).status(), 'list deleted').toBeLessThan(300);
});

When('{string} ticks the item {string} of the shared task list {string}', async function (this: World, email: string, itemTitle: string, title: string) {
  const list = await find(this, email, title);
  const item = list.items.find((i) => i.title === itemTitle);
  expect(item, `item ${itemTitle}`).toBeTruthy();
  const r = await call(this, email, 'PATCH', `/api/tasklists/${encodeURIComponent(list.id)}/items/${item!.id}`, { done: true });
  expect(r.status, 'item ticked').toBe(200);
});

When('{string} renames the shared task list {string} to {string}', async function (this: World, email: string, title: string, name: string) {
  const list = await find(this, email, title);
  const r = await call(this, email, 'PATCH', `/api/tasklists/${encodeURIComponent(list.id)}`, { title: name });
  expect(r.status, 'list renamed').toBe(200);
});

When('{string} leaves the shared task list {string}', async function (this: World, email: string, title: string) {
  const list = await find(this, email, title);
  const r = await call(this, email, 'POST', `/api/tasklists/${encodeURIComponent(list.id)}/leave`);
  expect(r.status, 'list left').toBe(204);
});

When('I edit the task list {string} in the Tasks view', async function (this: World, title: string) {
  await openDialog(this, title);
});

Then('{string} sees the task lists {string}', async function (this: World, email: string, titles: string) {
  expect((await listsOf(this, email)).map((l) => l.title).sort()).toEqual(titles.split(', ').sort());
});

Then('{string} sees no task lists', async function (this: World, email: string) {
  expect(await listsOf(this, email)).toEqual([]);
});

Then('{string} cannot read the shared task list {string}', async function (this: World, email: string, title: string) {
  const owner = this.person!;
  const list = await find(this, owner, title);
  const id = encodeURIComponent(list.id);
  expect((await call(this, email, 'GET', `/api/tasklists/${id}`)).status).toBe(404);
  expect((await call(this, email, 'PATCH', `/api/tasklists/${id}`, { title: 'Hacked' })).status).toBe(404);
  expect((await listsOf(this, email)).map((l) => l.title)).not.toContain(title);
});

Then('the task list {string} in the Tasks view is shared with {string}', async function (this: World, title: string, initial: string) {
  const badge = this.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-shared-badge');
  await expect(badge).toHaveText(exactText(initial));
});

Then('the item {string} of the task list {string} in the Tasks view is ticked', async function (this: World, itemTitle: string, title: string) {
  const row = this.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  await expect(row.getByTestId('tasklist-item-checkbox')).toBeVisible();
  await expect(row).toHaveAttribute('data-done', 'true');
});

Then('the task list {string} in the Tasks view shows the category {string}', async function (this: World, title: string, category: string) {
  await expect(this.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-expanded-title')).toHaveAttribute('data-category-name', category);
});

Then('{string} is not offered to change the category', async function (this: World, who: string) {
  await expect(this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-category'), `${who} cannot change the category`).toBeDisabled();
});

Then('{string} is offered to leave the list, not to delete it', async function (this: World, who: string) {
  const dialog = this.page.getByTestId('tasklist-dialog');
  await expect(dialog.getByTestId('tasklist-leave'), `${who} may leave`).toBeVisible();
  await expect(dialog.getByTestId('tasklist-delete')).toHaveCount(0);
});
