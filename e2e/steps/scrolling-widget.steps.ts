/**
 * Scrolling widget steps (List and Multi-day) (STEPS.md "Scrolling phone widget"): only the Settings part runs in the browser. The widget
 * itself is native; its scenarios are proven by `android/app/src/test` (the `@unit` comments in the feature name the tests).
 */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { settingControl } from './support/settings.js';
import { chooseOption, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';

const control = (w: World, which: 'hours') => settingControl(w, `settings-widget-${which}`);

async function choose(w: World, which: 'hours', label: string) {
  const c = await control(w, which);
  const saved = w.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(c, label);
  expect((await saved).status(), 'prefs saved').toBe(200);
}

Then('the hours in view are set to {string}', async function (this: World, label: string) {
  const c = await control(this, 'hours');
  await expect.poll(async () => selectedLabel(c)).toBe(label);
});

When('I set the hours in view to {string}', async function (this: World, label: string) {
  await choose(this, 'hours', label);
});

Then('the widget settings have no style choice for the List widget', async function (this: World) {
  await expect(this.page.getByTestId('settings-widget-hours').first()).toBeVisible();
  await expect(this.page.getByTestId('settings-scrolling-style')).toHaveCount(0);
});
