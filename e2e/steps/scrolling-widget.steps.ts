/**
 * Scrolling (list) widget steps (STEPS.md "Scrolling phone widget"): only the Settings part runs in the browser. The widget
 * itself is native; its scenarios are proven by `android/app/src/test` (the `@unit` comments in the feature name the tests).
 */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { settingControl } from './support/settings.js';
import { chooseOption, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';

const control = (w: World, which: 'style') => settingControl(w, `settings-scrolling-${which}`);

async function choose(w: World, which: 'style', label: string) {
  const c = await control(w, which);
  const saved = w.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(c, label);
  expect((await saved).status(), 'prefs saved').toBe(200);
}

Then('the scrolling widget style is set to {string}', async function (this: World, label: string) {
  const c = await control(this, 'style');
  await expect.poll(async () => selectedLabel(c)).toBe(label);
});

When('I set the scrolling widget style to {string}', async function (this: World, label: string) {
  await choose(this, 'style', label);
});
