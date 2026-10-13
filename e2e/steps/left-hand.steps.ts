/** Left-handed mode steps (STEPS.md "Left-handed mode"): which side of the screen a control is on. */
import { expect, type Locator } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import { box, viewport } from './support/ui.js';
import type { World } from './support/world.js';

/** STEPS.md element names → `data-testid`. */
const ELEMENTS: Record<string, string> = {
  'create button': 'create-button',
  'tray toggle': 'task-tray-chevron',
  'settings button': 'settings-button',
  'Today button': 'nav-today',
  'undo action': 'undo-action',
  'time axis': 'time-axis',
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

Then('the switches in the settings are on the {string} side of the screen', async function (this: World, side: string) {
  const switches = this.page.getByTestId('settings-view').getByRole('switch');
  await expect(switches.first()).toBeVisible();
  const n = await switches.count();
  for (let i = 0; i < n; i++) await expectSide(this, switches.nth(i), side, `switch ${i + 1}`);
});

Then('the support cat walks in from the {string}', async function (this: World, side: string) {
  await expect(this.page.getByTestId('support-cat').first()).toHaveAttribute('data-from', side, { timeout: 4_000 });
});
