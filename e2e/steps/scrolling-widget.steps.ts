/**
 * Scrolling widget steps (List and Multi-day) (STEPS.md "Scrolling phone widget"): only the Settings part runs in the browser. The widget
 * itself is native; its scenarios are proven by `android/app/src/test` (the `@unit` comments in the feature name the tests).
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
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

const slider = (w: World) => settingControl(w, 'settings-widget-hours-slider');

Then('the fixed hours in view read {string}', async function (this: World, text: string) {
  await slider(this);
  await expect(this.page.getByTestId('settings-widget-hours-slider-value').first()).toHaveText(text);
});

When('I set the fixed hours in view to {int}', async function (this: World, hours: number) {
  const input = await slider(this);
  const from = Number(await input.inputValue());
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await input.focus();
  for (let i = 0; i < Math.abs(hours - from); i++) await input.press(hours > from ? 'ArrowRight' : 'ArrowLeft');
  expect((await saved).status(), 'prefs saved').toBe(200);
});

Given('the fixed hours in view are chosen as {int}', async function (this: World, hours: number) {
  await this.api.patch('/api/prefs', { androidWidgetHours: hours });
});

Then('the hours slider is not shown', async function (this: World) {
  await expect(this.page.getByTestId('settings-widget-hours-slider')).toHaveCount(0);
});
