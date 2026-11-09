/** Steps of view-switcher.feature (STEPS.md "View switcher"): the main views' switches, the switcher's list and the default view. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { setLabsSwitch, settingControl } from './support/settings.js';
import { optionLabels } from './support/ui.js';
import type { World } from './support/world.js';

/** A main view's name as its id ("Clock" is the route `clock-rings`). */
const viewId = (name: string) => (name === 'Clock' ? 'clock-rings' : name.toLowerCase());

When('I switch the view {string} off in the settings', async function (this: World, name: string) {
  await setLabsSwitch(this, `settings-view-switch-${viewId(name)}`, false);
});

When('I switch the view {string} on in the settings', async function (this: World, name: string) {
  await setLabsSwitch(this, `settings-view-switch-${viewId(name)}`, true);
});

Then('the view switches are on for {string}', async function (this: World, list: string) {
  for (const name of list.split(', ')) {
    await expect(await settingControl(this, `settings-view-switch-${viewId(name)}`)).toHaveAttribute('aria-checked', 'true');
  }
});

Then('the view switch {string} is on and cannot be turned off', async function (this: World, name: string) {
  const control = await settingControl(this, `settings-view-switch-${viewId(name)}`);
  await expect(control).toHaveAttribute('aria-checked', 'true');
  await expect(control).toBeDisabled();
});

Then('the views settings say {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('settings-views-note')).toHaveText(text);
});

When('I choose {string} in the view switcher', async function (this: World, name: string) {
  await this.page.getByTestId('view-switcher').getByRole('tab', { name, exact: true }).click();
});

Then('the view switcher does not mark {string} as experimental', async function (this: World, name: string) {
  const tab = this.page.getByTestId(`view-switch-${viewId(name)}`);
  await expect(tab).toBeVisible();
  await expect(tab).not.toHaveAttribute('data-experimental', 'true');
});

Then('the Labs settings have a switch for {string}', async function (this: World, name: string) {
  await expect(await settingControl(this, 'settings-labs')).toBeVisible();
  await expect(this.page.getByTestId(`settings-labs-view-${name === 'Plain clock' ? 'clock' : name.toLowerCase()}`)).toBeVisible();
});

Then('the Labs settings have no switch for {string}', async function (this: World, name: string) {
  await expect(this.page.getByTestId(`settings-labs-view-${viewId(name)}`)).toHaveCount(0);
});

Then('the default view choices are {string}', async function (this: World, list: string) {
  const control = await settingControl(this, 'settings-default-view');
  expect((await optionLabels(control)).join(', ')).toBe(list);
});

Given('the default view is {string}', async function (this: World, name: string) {
  await this.api.patch('/api/settings', { defaultView: name.toLowerCase() });
});

Then('the clock shows its {string} variant', async function (this: World, variant: 'rings' | 'plain') {
  await expect(this.page.getByTestId('clock-view')).toHaveAttribute('data-variant', variant === 'plain' ? 'classic' : 'rings');
});

Given('the view {string} is switched off for me', async function (this: World, name: string) {
  await this.api.patch('/api/prefs', { stableViews: { [viewId(name)]: false } });
});
