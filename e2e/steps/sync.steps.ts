/** Sync and network steps (STEPS.md "Sync and network"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { setVisibility } from './support/visibility.js';
import type { World } from './support/world.js';

/** The app's focus debounce (feature background-sync). */
const FOCUS_DEBOUNCE_MS = 500;

When('the network connection is lost', async function (this: World) {
  // The connection drops after the open page has loaded (its lazy chunks and first fetches), not in the middle of it.
  if (this.page.url().startsWith('http')) await this.page.waitForLoadState('networkidle').catch(() => undefined);
  await this.context.setOffline(true);
});

When('the network connection is restored', async function (this: World) {
  await this.context.setOffline(false);
});

When('the app regains focus', async function (this: World) {
  await setVisibility(this.page, 'visible');
  // The app also syncs 500 ms after `focus` (debounced). Let that sync finish so it cannot land in a later step.
  await this.page.waitForTimeout(FOCUS_DEBOUNCE_MS + 250);
  await expect(this.page.getByTestId('sync-status').first()).not.toHaveAttribute('data-state', 'syncing');
});

When('the app is hidden', async function (this: World) {
  await setVisibility(this.page, 'hidden');
});

/**
 * Waits for the next completed sync attempt after this step started: a finished `/api/items` or `/api/changes` response or a change of
 * `data-last-sync` (whichever comes first), then for `sync-status` to leave `syncing`. Bounded by poll interval + 5 s.
 */
When('I wait for the automatic sync', async function (this: World) {
  const status = this.page.getByTestId('sync-status').first();
  const before = await status.getAttribute('data-last-sync').catch(() => null);
  // while the live connection is up, an interval of 30 s or more is stretched to a minute (stores/sync.ts)
  const poll = this.pollIntervalMs || 30_000;
  const timeout = (poll >= 30_000 ? Math.max(poll, 60_000) : poll) + 5_000;
  this.extendTimeout(timeout);
  const response = this.page
    .waitForResponse((r) => ['/api/items', '/api/changes'].includes(new URL(r.url()).pathname), { timeout })
    .then(() => 'response', () => null);
  const changed = expect
    .poll(() => status.getAttribute('data-last-sync').catch(() => null), { timeout })
    .not.toBe(before)
    .then(() => 'last-sync', () => null);
  // A running fake clock is paused: move it on until the app's timer fires. The timer waits out the pause after a failed
  // sync (poll + 50 ms) or the stretched minute of a live connection, so one poll interval is not always enough.
  if (this.clockNowMs !== undefined) {
    let fired = false;
    void Promise.race([response, changed]).then((r) => { fired = fired || !!r; });
    for (let i = 0; i < 4 && !fired; i++) {
      this.clockNowMs += poll + 100;
      await this.page.clock.runFor(poll + 100);
      await this.api.setClock(new Date(this.clockNowMs).toISOString(), false);
      await this.page.waitForTimeout(300); // real time for the request to answer
    }
  }
  // Both only reject on timeout; the loser is left to settle quietly.
  if (!(await Promise.race([response, changed]))) throw new Error(`No automatic sync within ${timeout} ms`);
  await expect(status).not.toHaveAttribute('data-state', 'syncing');
});

/** Waits out Google's slow-down (`world.slowDownUntil`), then for the event within one poll interval + 5 s. */
Then('once the slow-down is over I see the event {string} on {date}', async function (this: World, title: string, date: string) {
  const wait = Math.max(0, this.slowDownUntil - Date.now());
  const timeout = (this.pollIntervalMs || 30_000) + 5_000;
  this.extendTimeout(wait + timeout);
  await this.page.waitForTimeout(wait);
  await expect(this.eventChip(title, date)).toBeVisible({ timeout });
});

When('I retry the sync', async function (this: World) {
  await this.page.getByTestId('sync-retry').click();
});

Then('I see the sync error banner', async function (this: World) {
  await expect(this.page.getByTestId('sync-error-banner')).toBeVisible();
});

Then('I see the sync error banner saying {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('sync-error-banner')).toContainText(text);
});

Then('I do not see the sync error banner', async function (this: World) {
  await this.calendarShown();
  await expect(this.page.getByTestId('sync-error-banner')).toBeHidden();
});

/** The version the last "a new version of the app is deployed" step announced. */
let deployedVersion = '';

When('a new version of the app is deployed', async function (this: World) {
  deployedVersion = `e2e-${Date.now()}`;
  // No service worker may serve the old index.html on reload: the version check must work without one.
  await this.page.evaluate(async () => {
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await this.api.post('/api/__test/version', { version: deployedVersion });
});

/** A focus-triggered sync, which also re-reads /api/config. */
When('the app syncs', async function (this: World) {
  await setVisibility(this.page, 'visible');
});

Then('I am told a new version is available', async function (this: World) {
  await expect(this.page.getByTestId('update-available')).toBeVisible();
});

When('I choose to reload', async function (this: World) {
  await Promise.all([
    this.page.waitForEvent('load'),
    this.page.getByTestId('update-reload').click(),
  ]);
});

Then('the app runs the new version', async function (this: World) {
  await expect(this.page.locator('html')).toHaveAttribute('data-app-version', deployedVersion);
});
