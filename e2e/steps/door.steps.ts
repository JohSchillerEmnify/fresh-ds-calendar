/** Door board steps (STEPS.md "Door board"): the door plugin's key, door-tagged lists and `GET /api/door`. */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { itemsFrom } from './support/tables.js';
import { expandTaskList } from './support/tasklist.js';
import { attr, type World } from './support/world.js';

/** The owner's address while sign-in is on (the door's person); the local calendar while it is off. */
const OWNER = 'owner@example.test';
const KEY = 'door-test-key-0123456789abcdef0123456789abcdef';

interface DoorReminder { title: string; list: string; date: string | null; time?: string }
interface DoorEvent { title: string; start: string; end: string; allDay: boolean }
interface DoorAnswer { status: number; body: { reminders?: DoorReminder[]; events?: DoorEvent[]; error?: unknown } | null }
const answers = new WeakMap<World, DoorAnswer>();
const answer = (w: World): DoorAnswer => {
  const a = answers.get(w);
  if (!a) throw new Error('the door board has not asked yet');
  return a;
};

interface ListRow { id: string; title: string; date: string | null; tags: string[]; recurrence: string | null; seriesId?: string; items: { id: string; title: string; done: boolean }[] }
/** Every open list the owner has, dated and undated (the instance view of repeating lists). */
const openLists = (w: World) => w.api.get<{ items: ListRow[] }>('/api/tasklists/all-open').then((r) => r.items);
async function listByTitle(w: World, title: string, date?: string): Promise<ListRow> {
  const l = (await openLists(w)).find((x) => x.title === title && (date === undefined || x.date === date));
  if (!l) throw new Error(`no open task list "${title}"${date ? ` on ${date}` : ''}`);
  return l;
}

/** The clock minute of the latest ask: the server counts asks per minute and client, across scenarios. */
let lastAskMinute = -1;
const minuteNow = () => Math.floor(Date.now() / 60_000);
const untilNextMinute = () => new Promise((r) => setTimeout(r, 60_000 - (Date.now() % 60_000) + 200));

async function askDoor(w: World, key: string): Promise<DoorAnswer> {
  lastAskMinute = minuteNow();
  const res = await w.request.fetch('/api/door', { headers: { authorization: `Bearer ${key}` }, failOnStatusCode: false });
  const a: DoorAnswer = { status: res.status(), body: await res.json().catch(() => null) };
  answers.set(w, a);
  return a;
}

// ---- the key ----
Given('the door board has the key of the owner', async function (this: World) {
  await this.api.setDoor({ token: KEY, person: OWNER });
});
Given("the door board's key is taken away", async function (this: World) {
  await this.api.setDoor({ off: true });
});

Given('the door board has the key of {string}', async function (this: World, person: string) {
  await this.api.setAuth([person]);
  await this.api.setDoor({ token: KEY, person });
});

// ---- lists ----
Given('{string} is set to show on the door', async function (this: World, title: string) {
  const l = await listByTitle(this, title);
  // a repeating list is tagged on its series (master), so every occurrence carries the tag
  const id = l.seriesId ?? l.id;
  await this.api.patch(`/api/tasklists/${id}`, { tags: [...l.tags.filter((t) => t !== 'door'), 'door'] });
});
Given('the calendar contains a weekly task list {string} on Mondays since {date} with items:', async function (this: World, title: string, since: string, table: DataTable) {
  await this.api.post('/api/tasklists', { title, date: since, time: null, items: itemsFrom(table), recurrence: 'weekly' });
});
Given('{string} of {string} on {date} is still open', async function (this: World, item: string, title: string, date: string) {
  const l = await listByTitle(this, title, date);
  const it = l.items.find((i) => i.title === item);
  expect(it, `"${item}" in "${title}" on ${date}`).toBeTruthy();
  expect(it!.done, `"${item}" open`).toBe(false);
});
Given('the calendar contains an event {string} on {date} from {time} to {time} with the description {string}', async function (this: World, title: string, date: string, from: string, to: string, description: string) {
  await this.api.post('/api/events', { title, allDay: false, start: berlinIso(date, from), end: berlinIso(date, to), description });
});
Given('another person {string} has a task list {string} on {date} marked to show on the door with items:', async function (this: World, name: string, title: string, date: string, table: DataTable) {
  const email = `${name.toLowerCase()}@example.test`;
  await this.api.setAuth([OWNER, email]);
  await this.api.createOwnedList({ owner: email, title, date, tags: ['door'], items: itemsFrom(table).map((i) => i.title) });
});

// ---- asking ----
When('the door board asks for its reminders', async function (this: World) { await askDoor(this, KEY); });
When("the door board asks for today's events", async function (this: World) { await askDoor(this, KEY); });
When("something asks for the door's reminders with a wrong key", async function (this: World) { await askDoor(this, 'not-the-key'); });

/** The statuses of the last burst of asks (STEPS.md "asks for its reminders N times within a minute"). */
const burst = new WeakMap<World, number[]>();
When('the door board asks for its reminders {int} times within a minute', async function (this: World, n: number) {
  // the limit counts per clock minute: start in a fresh one when this one already had asks or little of it is left
  this.extendTimeout(130_000);
  if (lastAskMinute === minuteNow() || 60_000 - (Date.now() % 60_000) < 5_000) await untilNextMinute();
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) statuses.push((await askDoor(this, KEY)).status);
  burst.set(this, statuses);
  // the next scenario's asks must not meet this client's used-up minute
  await untilNextMinute();
});
Then('the first {int} are answered', async function (this: World, n: number) {
  expect(burst.get(this)!.slice(0, n)).toEqual(Array(n).fill(200));
});
Then('the next one is told there are too many requests', async function (this: World) {
  const all = burst.get(this)!;
  expect(all.slice(60)).toEqual([429]);
});
Then("it is told the door's person is not available", async function (this: World) {
  expect(answer(this).status).toBe(503);
});

Then('it gets no reminders', async function (this: World) {
  const a = answer(this);
  expect(a.status).toBe(200);
  expect(a.body?.reminders).toEqual([]);
});
Then('it gets the reminders:', async function (this: World, table: DataTable) {
  const a = answer(this);
  expect(a.status).toBe(200);
  const want = table.hashes().map((r) => ({ title: r.item, list: r.list, date: r.date || null, ...(r.time ? { time: r.time } : {}) }));
  expect(a.body?.reminders).toEqual(want);
});
Then('it gets the events:', async function (this: World, table: DataTable) {
  const a = answer(this);
  expect(a.status).toBe(200);
  // the API gives local ISO with seconds for timed events; the table names the minute
  const got = (a.body?.events ?? []).map((e) => ({ title: e.title, start: e.start.slice(0, 16), end: e.end.slice(0, 16), allDay: e.allDay }));
  const want = table.hashes().map((r) => ({ title: r.title, start: r.start, end: r.end, allDay: r['all day'] === 'yes' }));
  expect(got).toEqual(want);
});
Then('nothing but titles and times is in the answer', async function (this: World) {
  const a = answer(this);
  for (const e of a.body?.events ?? []) expect(Object.keys(e).sort()).toEqual(['allDay', 'end', 'start', 'title']);
  for (const r of a.body?.reminders ?? []) expect(Object.keys(r).every((k) => ['title', 'list', 'date', 'time'].includes(k)), JSON.stringify(r)).toBe(true);
});
Then('it is refused as unauthenticated and gets nothing', async function (this: World) {
  const a = answer(this);
  expect(a.status).toBe(401);
  expect(a.body?.reminders).toBeUndefined();
  expect(a.body?.events).toBeUndefined();
});
Then("asking for the door's reminders finds no such thing", async function (this: World) {
  expect((await askDoor(this, KEY)).status).toBe(404);
});

// ---- the switch ----
const dialog = (w: World) => w.page.getByTestId('tasklist-dialog');
/** The Tasks view shows every open list; a tap on its title opens the list's form. */
async function openForm(w: World, title: string) {
  await w.page.goto('/tasks');
  await expect(w.page.getByTestId('tasks-view')).toBeVisible();
  await w.byTestId('tasks-item', attr('data-title', title)).getByTestId('tasklist-expanded-title').click();
  await expect(dialog(w)).toBeVisible();
}
const isListPatch = (r: { url(): string; request(): { method(): string } }) => /^\/api\/tasklists\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH';

When('I edit the task list {string}', async function (this: World, title: string) { await openForm(this, title); });
Then('there is no "Show on door" switch', async function (this: World) {
  await expect(dialog(this)).toBeVisible();
  await expect(dialog(this).getByTestId('tasklist-door-switch')).toHaveCount(0);
});
When('I edit the task list {string} and turn "Show on door" on', async function (this: World, title: string) {
  await openForm(this, title);
  await dialog(this).getByTestId('tasklist-door-switch').click();
  const saved = this.page.waitForResponse(isListPatch);
  await dialog(this).getByTestId('tasklist-save').click();
  expect((await saved).status(), 'task list saved').toBe(200);
});
When('I open the list sheet of {string} and turn "Show on door" on', async function (this: World, title: string) {
  const l = await listByTitle(this, title);
  await this.page.goto(`/day/${l.date}`);
  await this.settled(); // data loaded: the desktop tray is there before the helper looks at it
  // an open desktop tray that already shows the list reveals its row instead: the helper collapses the tray first
  await expandTaskList(this, title);
  const sheet = this.expanded.filter({ hasNot: this.page.locator(attr('data-presentation', 'overlay')) });
  const saved = this.page.waitForResponse(isListPatch);
  await sheet.getByTestId('tasklist-door-switch').click();
  expect((await saved).status(), 'door tag saved').toBe(200);
});
Then('{string} is marked to show on the door', async function (this: World, title: string) {
  await expect.poll(async () => (await listByTitle(this, title)).tags).toContain('door');
});
Then('the door board gets {string} from {string}', async function (this: World, item: string, list: string) {
  const a = await askDoor(this, KEY);
  expect(a.status).toBe(200);
  expect(a.body?.reminders?.some((r) => r.title === item && r.list === list), JSON.stringify(a.body?.reminders)).toBe(true);
});
