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
  const path = new URL(world.page.url()).pathname;
  // the settings pages have no view switcher
  if (path.startsWith('/settings')) await world.page.goto('/tasks');
  else if (path !== '/tasks') await world.page.getByTestId('view-switch-tasks').click();
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
}

/** Opens the task list dialog of a list in the Tasks view. */
async function openDialog(world: World, title: string) {
  await openTasksView(world);
  // a dialog left open by an earlier step (an invitation was sent from it) is closed first
  const left = world.page.getByTestId('tasklist-dialog');
  if (await left.isVisible()) {
    await left.getByTestId('tasklist-cancel').click();
    await expect(left).toBeHidden();
  }
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

/** Types an address into "Share with" of the open task list dialog and presses Share; resolves with the answer's status. */
async function typeAndShare(world: World, title: string, email: string): Promise<number> {
  if (!(await world.page.getByTestId('tasklist-dialog').isVisible())) await openDialog(world, title);
  const dialog = world.page.getByTestId('tasklist-dialog');
  await dialog.locator('input[data-testid="tasklist-share-person"]').fill(email);
  const saved = world.page.waitForResponse(isCall('POST', '/share'));
  await dialog.getByTestId('tasklist-share').click();
  return (await saved).status();
}

/** Sends the invitation from the task list dialog and closes the dialog once the pending line shows. */
async function sendInvitation(world: World, title: string, email: string): Promise<void> {
  await openDialog(world, title);
  expect(await typeAndShare(world, title, email), 'invitation sent').toBe(200);
  const dialog = world.page.getByTestId('tasklist-dialog');
  await expect(dialog.getByTestId('tasklist-share-who').last()).toBeVisible();
  await dialog.getByTestId('tasklist-cancel').click();
  await expect(dialog).toBeHidden();
}

When('I share the task list {string} with {string}', async function (this: World, title: string, email: string) {
  await sendInvitation(this, title, email);
});

When('I share the task list {string} with {string} who accepts', async function (this: World, title: string, email: string) {
  await sendInvitation(this, title, email);
  await answer(this, email, 'list', title, 'accept');
});

When('I try to share the task list {string} with {string}', async function (this: World, title: string, email: string) {
  expect(await typeAndShare(this, title, email), 'share answered').toBe(200);
});

interface Invitations {
  invitations: { id: string; kind: string; title: string; from: string }[];
  sent: { id: string; kind: string; target: string; address: string }[];
}
const invitationsOf = async (world: World, email: string) => (await call<Invitations>(world, email, 'GET', '/api/invitations')).body;

/** The person answers the invitation they hold for this list or category through the API. */
async function answer(world: World, email: string, kind: 'list' | 'category', title: string, verb: 'accept' | 'decline'): Promise<void> {
  const inv = (await invitationsOf(world, email)).invitations.find((i) => i.kind === kind && i.title === title);
  expect(inv, `${email} holds an invitation to the ${kind} ${title}`).toBeTruthy();
  expect((await call(world, email, 'POST', `/api/invitations/${inv!.id}/${verb}`)).status, `invitation ${verb}ed`).toBe(200);
}

When('{string} accepts the invitation to the task list {string}', async function (this: World, email: string, title: string) {
  await answer(this, email, 'list', title, 'accept');
});
When('{string} declines the invitation to the task list {string}', async function (this: World, email: string, title: string) {
  await answer(this, email, 'list', title, 'decline');
});
When('{string} accepts the invitation to the category {string}', async function (this: World, email: string, category: string) {
  await answer(this, email, 'category', category, 'accept');
});

Then('{string} cannot accept the invitation to the task list {string}', async function (this: World, email: string, title: string) {
  const owner = this.person!;
  const list = await find(this, owner, title);
  const mine = (await invitationsOf(this, owner)).sent.find((i) => i.target === list.id);
  expect(mine, `${owner} sent an invitation to ${title}`).toBeTruthy();
  expect((await call(this, email, 'POST', `/api/invitations/${mine!.id}/accept`)).status).toBe(404);
});

Then('{string} sees no invitations', async function (this: World, email: string) {
  expect((await invitationsOf(this, email)).invitations).toEqual([]);
});

/** The invitation card of the Open tab for a list or category. */
const card = (world: World, kind: 'list' | 'category', title: string) =>
  world.page.getByTestId('invitation-card').and(world.page.locator(`[data-kind="${kind}"]${attr('data-title', title)}`));

async function cardShown(world: World, kind: 'list' | 'category', title: string, from: string) {
  const c = card(world, kind, title);
  await expect(c).toBeVisible();
  await expect(c).toContainText(from);
  await expect(c.getByTestId('invitation-accept')).toBeVisible();
  await expect(c.getByTestId('invitation-decline')).toBeVisible();
}
Then('the Tasks view shows the invitation to the task list {string} from {string}', async function (this: World, title: string, from: string) {
  await cardShown(this, 'list', title, from);
});
Then('the Tasks view shows the invitation to the category {string} from {string}', async function (this: World, title: string, from: string) {
  await cardShown(this, 'category', title, from);
});

Given('{string} may use the calendar but has not signed in yet', async function (this: World, email: string) {
  await this.api.post('/api/__test/auth/newcomer', { email });
});

When('I press {string} in the snackbar', async function (this: World, label: string) {
  await this.page.locator('.snack').getByRole('button', { name: label, exact: true }).click();
});

When('I withdraw the invitation to share the task list {string}', async function (this: World, title: string) {
  await openDialog(this, title);
  const withdrawn = this.page.waitForResponse(isCall('POST', '/withdraw'));
  await this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-invite-withdraw').click();
  expect((await withdrawn).status(), 'invitation withdrawn').toBe(200);
});

When('I open the category {string} in the settings', async function (this: World, category: string) {
  await openSettingsPage(this, 'tasklists');
  await this.byTestId('settings-category', attr('data-name', category)).locator('.catmain').click();
  await expect(this.page.getByTestId('category-dialog')).toBeVisible();
});

When('I withdraw the invitation to share the category {string} in the settings', async function (this: World, category: string) {
  const dialog = this.page.getByTestId('category-dialog');
  if (!(await dialog.isVisible())) {
    await openSettingsPage(this, 'tasklists');
    await this.byTestId('settings-category', attr('data-name', category)).locator('.catmain').click();
  }
  const withdrawn = this.page.waitForResponse(isCall('POST', '/withdraw'));
  await dialog.getByTestId('category-invite-withdraw').click();
  expect((await withdrawn).status(), 'invitation withdrawn').toBe(200);
});

When('I open "Share with" for the task list {string}', async function (this: World, title: string) {
  await openDialog(this, title);
  await expect(this.page.getByTestId('tasklist-dialog').locator('input[data-testid="tasklist-share-person"]')).toBeVisible();
});

/** Presses "Remove" on the line that names the person (anna: "Shared with anna") and waits for the answer. */
async function removePerson(world: World, name: string): Promise<void> {
  const dialog = world.page.getByTestId('tasklist-dialog');
  const removed = world.page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/share\/[^/]+$/.test(new URL(r.url()).pathname));
  await dialog.getByTestId('tasklist-member').filter({ hasText: `Shared with ${name}` }).getByTestId('tasklist-member-remove').click();
  expect((await removed).status(), 'person removed').toBe(200);
}

When('I remove {string} from the task list {string}', async function (this: World, name: string, title: string) {
  await openDialog(this, title);
  await removePerson(this, name);
});

When('I stop sharing the task list {string}', async function (this: World, title: string) {
  await openDialog(this, title);
  const dialog = this.page.getByTestId('tasklist-dialog');
  // every person goes, the last one moves the list back to the owner
  for (let n = await dialog.getByTestId('tasklist-member').count(); n > 0; n--) {
    const name = (await dialog.getByTestId('tasklist-member').first().getByTestId('tasklist-share-who').innerText()).replace('Shared with ', '');
    await removePerson(this, name);
    if (n > 1) await expect(dialog.getByTestId('tasklist-member')).toHaveCount(n - 1);
  }
  // the last person closes the form
  await expect(dialog).toBeHidden();
});

When('I share the category {string} with {string} in the settings', async function (this: World, category: string, email: string) {
  await openSettingsPage(this, 'tasklists');
  await this.byTestId('settings-category', attr('data-name', category)).locator('.catmain').click();
  const dialog = this.page.getByTestId('category-dialog');
  await dialog.locator('input[data-testid="category-share-person"]').fill(email);
  const saved = this.page.waitForResponse(isCall('PUT', '/share'));
  await dialog.getByTestId('category-save').click();
  expect((await saved).status(), 'category shared').toBe(200);
  await expect(dialog).toBeHidden();
});

When('I stop sharing the category {string} in the settings', async function (this: World, category: string) {
  await openSettingsPage(this, 'tasklists');
  await this.byTestId('settings-category', attr('data-name', category)).locator('.catmain').click();
  const dialog = this.page.getByTestId('category-dialog');
  const field = dialog.locator('input[data-testid="category-share-person"]');
  // the current address loads asynchronously and would overwrite an early clear
  await expect(field).toHaveValue(/@/);
  await field.fill('');
  const saved = this.page.waitForResponse(isCall('PUT', '/share'));
  await dialog.getByTestId('category-save').click();
  expect((await saved).status(), 'category share stopped').toBe(200);
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
  // an edit is saved through the device's outbox after the dialog has closed: the server shows it a moment later
  await expect.poll(async () => (await listsOf(this, email)).map((l) => l.title).sort()).toEqual(titles.split(', ').sort());
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

const shareField = (world: World) => world.page.getByTestId('tasklist-dialog').locator('input[data-testid="tasklist-share-person"]');
const suggested = (world: World) => world.page.getByTestId('tasklist-dialog').locator('[data-testid="share-suggestions"] option');

Then('{string} is offered only {string} to share with', async function (this: World, email: string, offered: string) {
  await expect.poll(async () => (await call<{ people: { email: string }[] }>(this, email, 'GET', '/api/people')).body.people.map((p) => p.email).sort()).toEqual(offered.split(', ').sort());
});

Then('{string} is offered no address to share with', async function (this: World, email: string) {
  expect((await call<{ people: unknown[] }>(this, email, 'GET', '/api/people')).body.people).toEqual([]);
});

Then('"Share with" is an email field', async function (this: World) {
  await expect(shareField(this)).toHaveAttribute('type', 'email');
});

Then('"Share with" offers only {string}', async function (this: World, offered: string) {
  const want = offered.split(', ').sort();
  await expect.poll(async () => (await suggested(this).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).sort()).toEqual(want);
});

Then('"Share with" offers no addresses', async function (this: World) {
  await expect(shareField(this)).toBeVisible();
  await this.page.waitForLoadState('networkidle');
  await expect(suggested(this)).toHaveCount(0);
});

/** The sharing line of whichever dialog is open: the task list's or the category's. */
const sharingLine = (world: World) => world.page.getByTestId(/^(tasklist|category)-share-who$/);

Then('the sharing field says {string}', async function (this: World, text: string) {
  await expect(sharingLine(this)).toHaveText(exactText(text));
});

Then('the sharing line says {string}', async function (this: World, text: string) {
  await expect(sharingLine(this)).toHaveText(exactText(text));
});

Then('the task list {string} in the Tasks view is not shared', async function (this: World, title: string) {
  await this.page.getByTestId('tasklist-cancel').click().catch(() => undefined);
  await expect(this.page.getByTestId('tasklist-dialog')).toBeHidden();
  await expect(this.byTestId('tasks-item', attr('data-title', title))).toBeVisible();
  await expect(this.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-shared-badge')).toHaveCount(0);
});

When('I choose {string} in the overflow menu of the task list {string}', async function (this: World, label: string, title: string) {
  await openTasksView(this);
  await this.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-overflow').click();
  await this.page.getByRole('menu').getByRole('menuitem', { name: label, exact: true }).click();
  await expect(this.page.getByTestId('tasklist-dialog')).toBeVisible();
});

Then('the task list form is open at {string}', async function (this: World, field: string) {
  expect(field).toBe('Share with');
  await expect(shareField(this)).toBeVisible();
  await expect(shareField(this)).toBeFocused();
});

Then('the sharing lines say {string}', async function (this: World, text: string) {
  const lines = this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-share-who');
  await expect.poll(async () => (await lines.allInnerTexts()).map((t) => t.trim()).join(', ')).toBe(text);
});

When('I withdraw the invitation to {string} for the task list {string}', async function (this: World, address: string, title: string) {
  await openDialog(this, title);
  const line = this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-invite').filter({ hasText: address });
  const withdrawn = this.page.waitForResponse(isCall('POST', '/withdraw'));
  await line.getByTestId('tasklist-invite-withdraw').click();
  expect((await withdrawn).status(), 'invitation withdrawn').toBe(200);
});

Then('{string} has the task list {string} to themselves again', async function (this: World, email: string, title: string) {
  await expect.poll(async () => (await listsOf(this, email)).filter((l) => l.title === title).map((l) => 'shared' in l)).toEqual([false]);
});

Then('{string} is invited to the task list {string}', async function (this: World, email: string, title: string) {
  const held = (await invitationsOf(this, email)).invitations;
  expect(held.some((i) => i.kind === 'list' && i.title === title), `${email} holds an invitation to ${title}`).toBe(true);
});

Then('"Share with" is not offered', async function (this: World) {
  await expect(this.page.getByTestId('tasklist-dialog')).toBeVisible();
  await expect(shareField(this)).toHaveCount(0);
});
