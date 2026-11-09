/** Offline changes steps (STEPS.md "Offline changes", feature offline-changes, ADR 0031). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Then, When } from './fixtures.js';
import { berlinIso, sameInstant } from './support/dates.js';
import { isTaskList, readItems } from './support/google.js';
import { itemsFrom } from './support/tables.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

/** The unsent changes the app keeps in its IndexedDB (`calendar-device`, record `outbox`), also on the sign-in page. */
async function storedOutbox(world: World): Promise<unknown[]> {
  return world.page.evaluate(() => new Promise<unknown[]>((resolve) => {
    const req = indexedDB.open('calendar-device');
    // opening a missing database would create it: abort the upgrade instead, there is nothing stored
    req.onupgradeneeded = () => { req.transaction!.abort(); };
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('kv').objectStore('kv').get('outbox');
      get.onsuccess = () => { db.close(); resolve((get.result as unknown[] | undefined) ?? []); };
      get.onerror = () => { db.close(); resolve([]); };
    };
  }));
}

const keeps = async (world: World, count: number) => {
  await expect.poll(async () => {
    const kept = await storedOutbox(world);
    return kept.length === count ? count : `${kept.length}: ${kept.map((e) => JSON.stringify((e as { change: unknown }).change)).join(' | ')}`;
  }, { message: 'unsent changes kept on this device', timeout: 10_000 }).toBe(count);
};

Then(/^this device keeps (\d+) unsent changes?$/, async function (this: World, count: string) {
  await keeps(this, Number(count));
});

Then('this device keeps no unsent changes', async function (this: World) {
  await keeps(this, 0);
});

When('I wait until the changes are sent', async function (this: World) {
  const timeout = (this.pollIntervalMs || 30_000) + 5_000;
  this.extendTimeout(timeout);
  await expect.poll(() => this.page.evaluate(() => document.documentElement.dataset.unsynced), { message: 'html data-unsynced', timeout }).toBe('0');
});

When('I close the app', async function (this: World) {
  await this.page.goto('about:blank');
});

// --- the server's side ---------------------------------------------------------------------------------------------------

const events = async (world: World, title: string) => (await world.api.remoteEvents(title, world.person)).filter((e) => e.summary === title && !isTaskList(e));
const lists = async (world: World, title: string) => (await world.api.remoteEvents(title, world.person)).filter((e) => e.summary === title && isTaskList(e));

Then(
  'the server has the event {string} on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    await expect.poll(async () => (await events(this, title)).filter((e) => sameInstant(e.start.dateTime, berlinIso(date, from)) && sameInstant(e.end.dateTime, berlinIso(date, to))).length, { message: `the server has the event "${title}"` }).toBe(1);
  },
);

Then('the server has no event {string}', async function (this: World, title: string) {
  await expect.poll(async () => (await events(this, title)).length, { message: `no event "${title}" on the server` }).toBe(0);
});

Then('the server has the task list {string} with items:', async function (this: World, title: string, table: DataTable) {
  const want = itemsFrom(table).map((i) => `${i.title}:${i.done}`);
  await expect.poll(async () => (await lists(this, title)).map((l) => readItems(l).map((i) => `${i.t}:${i.d === 1}`)), { message: `the server has the task list "${title}" with ${want.join(', ')}` }).toEqual([want]);
});

Then('the server has no task list {string}', async function (this: World, title: string) {
  await expect.poll(async () => (await lists(this, title)).length, { message: `no task list "${title}" on the server` }).toBe(0);
});

Then('the server refuses the next change as invalid', async function (this: World) {
  await this.api.post('/api/__test/refuse-next-write', { status: 400 });
});

When('Google deletes the task list {string}', async function (this: World, title: string) {
  const [list] = await lists(this, title);
  if (!list) throw new Error(`No Google task list "${title}"`);
  await this.api.remoteDelete(list.id);
});

// --- notices ------------------------------------------------------------------------------------------------------------

const notice = (world: World) => world.page.getByTestId('outbox-notice');

Then('I am told that the change to {string} was not saved because it was deleted elsewhere', async function (this: World, title: string) {
  await expect(notice(this).first()).toContainText(`The change to “${title}” was not saved because it was deleted elsewhere.`);
});

Then('I am told that the change to {string} was not saved because the server refused it', async function (this: World, title: string) {
  await expect(notice(this).first()).toContainText(`The change to “${title}” was not saved because it was rejected`);
});

Then('I am not told that a change was not saved', async function (this: World) {
  await this.settled();
  await expect(notice(this)).toHaveCount(0);
});

When('I dismiss the notice', async function (this: World) {
  await this.page.getByTestId('outbox-notice-dismiss').first().click();
});

When('I press Edit again in the notice', async function (this: World) {
  await this.page.getByTestId('outbox-edit-again').first().click();
});

Then('the notice offers no Edit again', async function (this: World) {
  await expect(notice(this).first()).toBeVisible();
  await expect(this.page.getByTestId('outbox-edit-again')).toHaveCount(0);
});

// --- the sync failed icon -----------------------------------------------------------------------------------------------

Then('I see the sync failed icon', async function (this: World) {
  await expect(this.page.getByTestId('sync-failed-icon')).toBeVisible();
});

Then('I do not see the sync failed icon', async function (this: World) {
  await expect(this.page.getByTestId('sync-failed-icon')).toHaveCount(0);
});

When('I tap the sync failed icon', async function (this: World) {
  // an open sheet covers the top bar: it is closed first, as a person would
  if (await this.page.getByTestId('sheet-scrim').first().isVisible()) await this.page.keyboard.press('Escape');
  await this.page.getByTestId('sync-failed-icon').click();
});

Then('I am told the last successful sync was at {string}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('sync-failed-last')).toHaveText(new RegExp(`${time}$`));
});

Then('the unsent changes list shows {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('sync-failed-change').filter({ hasText: text })).toHaveCount(1);
});

Then('the unsent changes list is empty', async function (this: World) {
  await expect(this.page.getByTestId('sync-failed-change')).toHaveCount(0);
  await expect(this.page.getByTestId('sync-failed-empty')).toBeVisible();
});

// --- signing out with unsent changes -------------------------------------------------------------------------------------

When('they ask to sign out in the settings', async function (this: World) {
  const button = this.page.getByTestId('settings-button');
  if (await button.isVisible()) await button.click();
  await (await settingControl(this, 'settings-signout')).click();
});

Then(/^they are asked whether to sign out and lose (\d+) unsent changes?$/, async function (this: World, count: string) {
  await expect(this.page.getByTestId('confirm-dialog')).toContainText(`Sign out and lose ${count} unsent change`);
});

When('they choose to stay signed in', async function (this: World) {
  await this.page.getByTestId('confirm-cancel').click();
});

When('they sign out anyway', async function (this: World) {
  await this.page.getByTestId('confirm-ok').click();
});
