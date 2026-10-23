/** Last known state steps (STEPS.md "Last known state", feature last-known-state). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { View } from './parameters.js';
import type { World } from './support/world.js';

/** The ranges (`from`/`to`) of every snapshot in the app's IndexedDB, or `null` when it has none. */
async function storedRanges(world: World): Promise<Array<{ from: string; to: string }> | null> {
  return world.page.evaluate(() => new Promise<Array<{ from: string; to: string }> | null>((resolve) => {
    const req = indexedDB.open('calendar-last-known');
    // opening a missing database would create it: abort the upgrade instead, there is nothing stored
    req.onupgradeneeded = () => { req.transaction!.abort(); };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const all = db.transaction('snapshots').objectStore('snapshots').getAll();
      all.onsuccess = () => {
        db.close();
        const snaps = all.result as Array<{ ranges: Array<{ from: string; to: string }> }>;
        resolve(snaps.length ? snaps.flatMap((s) => s.ranges.map(({ from, to }) => ({ from, to }))) : null);
      };
      all.onerror = () => { db.close(); resolve(null); };
    };
  }));
}

/** How long "the server answers only after N seconds" delays each answer (ms). */
let slowMs = 0;

Given('I have seen the {view} view for {date}', async function (this: World, view: View, date: string) {
  slowMs = 0;
  await this.page.goto(`/${view}/${view === 'month' ? date.slice(0, 7) : view === 'year' ? date.slice(0, 4) : date}`);
  await this.settled();
  // the app shell must come from the service worker once the network is gone
  await expect.poll(() => this.page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => {
    const saved = await this.page.evaluate(() => document.documentElement.dataset.lastKnown);
    if (saved !== 'saved') return `html data-last-known=${saved}`;
    const ranges = await storedRanges(this);
    return ranges?.some((r) => r.from <= date && date < r.to) ? 'saved' : `stored ranges ${JSON.stringify(ranges)}`;
  }, { message: 'the last known state was saved', timeout: 10_000 }).toBe('saved');
});

When('I open the app again', async function (this: World) {
  // the page must not wait for the app's data: only for the document and its scripts
  await this.page.reload({ waitUntil: 'domcontentloaded' });
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
  await expect.poll(() => storedRanges(this).then((r) => !!r?.length)).toBe(true);
});

Then('this device keeps no last known calendar', async function (this: World) {
  await expect.poll(() => storedRanges(this)).toBeNull();
  expect(await this.page.evaluate(() => localStorage.getItem('cal.lastKnownPerson'))).toBeNull();
});
