/** Language steps (STEPS.md "Language"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { chooseOption, expectJoined, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

/** The marker `I choose ... as the language` leaves on `window`; a page reload would lose it. */
type MarkedWindow = Window & { __languageMarker?: true };

Given('the browser language is {string}', async function (this: World, language: string) {
  // a context's locale cannot change after creation, so the page is told what navigator reports
  await this.context.addInitScript((lang: string) => {
    Object.defineProperty(navigator, 'language', { get: () => lang, configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => [lang], configurable: true });
  }, language);
});

Then('the view switcher shows {string}', async function (this: World, list: string) {
  await expectJoined(this.page.getByTestId('view-switcher').getByRole('tab'), list);
});

Then('the page language is {string}', async function (this: World, lang: string) {
  await expect(this.page.locator('html')).toHaveAttribute('lang', lang);
});

When('I choose {string} as the language', async function (this: World, label: string) {
  const control = (await settingControl(this, 'settings-language'));
  await expect(control).toBeVisible();
  await this.page.evaluate(() => { (window as MarkedWindow).__languageMarker = true; });
  if ((await selectedLabel(control)) === label) return;
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(control, label);
  expect((await saved).status(), 'language saved').toBe(200);
});

Then('the language {string} is selected', async function (this: World, label: string) {
  await expect.poll(async () => selectedLabel((await settingControl(this, 'settings-language')))).toBe(label);
});

Then('the page was not reloaded', async function (this: World) {
  expect(await this.page.evaluate(() => (window as MarkedWindow).__languageMarker === true)).toBe(true);
});
