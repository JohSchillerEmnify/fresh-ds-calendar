/** Sync and network steps (STEPS.md "Sync and network"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { setVisibility } from './support/visibility.js';
import type { World } from './support/world.js';

/** The app's focus debounce (ARCHITECTURE.md "Background sync"). */
const FOCUS_DEBOUNCE_MS = 500;

When('the network connection is lost', async function (this: World) {
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
 * Waits for the next completed sync attempt after this step started: a finished `/api/items` response or a change of
 * `data-last-sync` (whichever comes first), then for `sync-status` to leave `syncing`. Bounded by poll interval + 5 s.
 */
When('I wait for the automatic sync', async function (this: World) {
  const status = this.page.getByTestId('sync-status').first();
  const before = await status.getAttribute('data-last-sync').catch(() => null);
  const timeout = (this.pollIntervalMs || 30_000) + 5_000;
  this.extendTimeout(timeout);
  const response = this.page
    .waitForResponse((r) => new URL(r.url()).pathname === '/api/items', { timeout })
    .then(() => 'response', () => null);
  const changed = expect
    .poll(() => status.getAttribute('data-last-sync').catch(() => null), { timeout })
    .not.toBe(before)
    .then(() => 'last-sync', () => null);
  // Both only reject on timeout; the loser is left to settle quietly.
  if (!(await Promise.race([response, changed]))) throw new Error(`No automatic sync within ${timeout} ms`);
  await expect(status).not.toHaveAttribute('data-state', 'syncing');
});

When('I retry the sync', async function (this: World) {
  await this.page.getByTestId('sync-retry').click();
});

Then('I see the sync error banner', async function (this: World) {
  await expect(this.page.getByTestId('sync-error-banner')).toBeVisible();
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
