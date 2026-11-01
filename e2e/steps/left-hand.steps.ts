/** Left-handed mode steps (STEPS.md "Left-handed mode"): which side of the screen a control is on. */
import { expect, type Locator } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import { box, viewport } from './support/ui.js';
import type { World } from './support/world.js';
import { openSettingsPage } from './support/settings.js';

/** STEPS.md element names → `data-testid`. */
const ELEMENTS: Record<string, string> = {
  'create button': 'create-button',
  'tray toggle': 'task-tray-chevron',
  'settings button': 'settings-button',
  'Today button': 'nav-today',
  'period title': 'period-title',
  'undo action': 'undo-action',
  'time axis': 'time-axis',
  'open tasks tray': 'task-tray',
};

/** Polls until the element's centre is on the wanted side of the viewport centre (animations settle, sheets slide in). */
async function expectSide(world: World, loc: Locator, side: string, what: string) {
  expect(['left', 'right'], 'side').toContain(side);
  const half = viewport(world.page).width / 2;
  await expect
    .poll(async () => { const b = await box(loc); return b.x + b.width / 2 < half ? 'left' : 'right'; }, { message: `${what} is on the ${side}` })
    .toBe(side);
}

Given('left-handed mode is on', async function (this: World) {
  await this.api.patch('/api/prefs', { leftHanded: true });
});

Then('the {string} is on the {string} side of the screen', async function (this: World, name: string, side: string) {
  const id = ELEMENTS[name];
  expect(id, `known element "${name}"`).toBeDefined();
  await expectSide(this, this.page.getByTestId(id).first(), side, name);
});

Then('the create button sits right of the open tasks tray', async function (this: World) {
  const fab = this.page.getByTestId('create-button');
  const tray = this.page.getByTestId('task-tray');
  await expect(tray).toBeVisible();
  // Polled: the tray animates its width and the button follows `--tray-w`.
  await expect
    .poll(async () => { const [f, t] = [await box(fab), await box(tray)]; return Math.round(f.x - (t.x + t.width)); }, { message: 'gap between tray and create button' })
    .toBeGreaterThanOrEqual(0);
});

Then('the switches in the settings are on the {string} side of the screen', async function (this: World, side: string) {
  // the settings home lists groups only: the switches are on the group pages (Appearance & layout has several)
  if (await this.page.getByTestId('settings-home').isVisible()) await openSettingsPage(this, 'appearance');
  const switches = this.page.getByTestId('settings-view').getByRole('switch');
  await expect(switches.first()).toBeVisible();
  const n = await switches.count();
  for (let i = 0; i < n; i++) await expectSide(this, switches.nth(i), side, `switch ${i + 1}`);
});

Then('the support cat walks in from the {string}', async function (this: World, side: string) {
  await expect(this.page.getByTestId('support-cat').first()).toHaveAttribute('data-from', side, { timeout: 4_000 });
});
