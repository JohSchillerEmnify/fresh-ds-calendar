/** Device store steps (STEPS.md "Last known state", feature last-known-state, ADR 0025). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { View } from './parameters.js';
import type { World } from './support/world.js';

/** The records of the device store in the app's IndexedDB (`meta`, `events`, `lists`), or `null` when it has none. */
async function storedDevice(world: World): Promise<{ meta: { person: string; cursor: string | null }; events: unknown[]; lists: unknown[] } | null> {
  return world.page.evaluate(() => new Promise<{ meta: { person: string; cursor: string | null }; events: unknown[]; lists: unknown[] } | null>((resolve) => {
    const req = indexedDB.open('calendar-device');
    // opening a missing database would create it: abort the upgrade instead, there is nothing stored
    req.onupgradeneeded = () => { req.transaction!.abort(); };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const store = db.transaction('kv').objectStore('kv');
      const read = (key: string) => new Promise<unknown>((res) => { const r = store.get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
      void Promise.all([read('meta'), read('events'), read('lists')]).then(([meta, events, lists]) => {
        db.close();
        resolve(meta ? { meta: meta as never, events: (events ?? []) as unknown[], lists: (lists ?? []) as unknown[] } : null);
      });
    };
  }));
}

/** How long "the server answers only after N seconds" delays each answer (ms). */
let slowMs = 0;

/** Waits until the service worker controls the page (the app shell then also opens offline) and the device store has taken in a complete sync. */
async function syncedThisDevice(world: World): Promise<void> {
  // a write that is still on its way (the Canvas saves after the click) reaches the device copy only when its answer is in
  await world.page.waitForLoadState('networkidle').catch(() => undefined);
  await expect.poll(() => world.page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => {
    const root = await world.page.evaluate(() => ({ state: document.documentElement.dataset.deviceStore, at: document.documentElement.dataset.deviceSyncedAt }));
    if (root.state !== 'synced' || !root.at) return `html data-device-store=${root.state} data-device-synced-at=${root.at}`;
    return (await storedDevice(world))?.meta.cursor ? 'synced' : 'nothing stored yet';
  }, { message: 'the device store has synced', timeout: 15_000 }).toBe('synced');
}

Given('I have seen the {view} view for {date}', async function (this: World, view: View, date: string) {
  slowMs = 0;
  await this.page.goto(`/${view}/${view === 'month' ? date.slice(0, 7) : view === 'year' ? date.slice(0, 4) : date}`);
  await this.settled();
  await syncedThisDevice(this);
});

Given('the app has synced this device', async function (this: World) {
  await syncedThisDevice(this);
});

When('the language is changed elsewhere to {string}', async function (this: World, language: string) {
  await this.api.patch('/api/prefs', { language });
});

When('I open the app again', async function (this: World) {
  // the app is open once a view shows; nothing waits for its data (a slow server must not hold the step up)
  await this.page.reload({ waitUntil: 'domcontentloaded' });
  const tid = (id: string) => `[data-testid="${id}"]`;
  await expect(this.page.locator(['month-view', 'week-view', 'day-view', 'year-view', 'tasks-view', 'tasks-canvas'].map(tid).join(', ')).first()).toBeVisible();
});

Given('the server answers only after {int} seconds', async function (this: World, seconds: number) {
  slowMs = seconds * 1000;
  await this.api.post('/api/__test/slow', { ms: slowMs });
});

When('the server has answered', async function (this: World) {
  const timeout = slowMs + 10_000;
  this.extendTimeout(timeout);
  const status = this.page.getByTestId('sync-status').first();
  await expect(status).toHaveAttribute('data-last-sync', /\S/, { timeout });
  await expect(status).not.toHaveAttribute('data-state', 'syncing', { timeout });
});

Then('I am told the calendar was last updated at {string}', async function (this: World, time: string) {
  const note = this.page.getByTestId('last-updated-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveText(new RegExp(`${time.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});

Then('I am not told when the calendar was last updated', async function (this: World) {
  await expect(this.page.getByTestId('last-updated-note')).toHaveCount(0);
});

Then('this device keeps a last known calendar', async function (this: World) {
  await expect.poll(() => storedDevice(this).then((d) => d?.meta.person ?? null)).not.toBeNull();
});

Then('this device keeps no last known calendar', async function (this: World) {
  await expect.poll(() => storedDevice(this)).toBeNull();
  expect(await this.page.evaluate(() => localStorage.getItem('cal.devicePerson'))).toBeNull();
  // the sign-in page caches the default look again; nothing of a person's own theme may stay
  expect(await this.page.evaluate(() => localStorage.getItem('cal.theme') ?? '')).not.toContain('theme:');
});
