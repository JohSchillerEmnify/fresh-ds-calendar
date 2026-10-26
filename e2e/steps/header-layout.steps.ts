/** Header layout steps (STEPS.md "Header layout"): the sync icon and its "Sync indicator" switch. */
import { expect } from '@playwright/test';
import { Then } from './fixtures.js';
import type { World } from './support/world.js';

const syncIcon = (w: World) => w.page.getByTestId('sync-status').first();

Then('I see the sync icon', async function (this: World) {
  await expect(syncIcon(this)).toBeVisible();
});

Then('I do not see the sync icon', async function (this: World) {
  // after the app has settled, so a sync problem that is still on its way cannot pass unseen
  await this.settled();
  await expect(syncIcon(this)).not.toHaveAttribute('data-state', 'error');
  await expect(syncIcon(this)).toBeHidden();
  // hidden, it takes no room in the top bar
  expect(await syncIcon(this).boundingBox(), 'sync icon box').toBeNull();
});

Then('the sync icon shows a problem', async function (this: World) {
  await expect(syncIcon(this)).toHaveAttribute('data-state', 'error');
  await expect(syncIcon(this)).toBeVisible();
});

Then('the {string} switch in the settings is off', async function (this: World, label: string) {
  const control = this.page.getByTestId('settings-view').getByRole('switch', { name: label, exact: true });
  await expect(control).toHaveAttribute('aria-checked', 'false');
});
