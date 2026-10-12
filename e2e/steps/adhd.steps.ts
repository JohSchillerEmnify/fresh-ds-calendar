/** ADHD and animation settings steps (STEPS.md "ADHD support, settings additions"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { chooseSelect, setSwitch } from './support/settings.js';
import { selectedLabel } from './support/ui.js';
import { exactText, type World } from './support/world.js';

When('I choose {string} as the transition warning time', async function (this: World, label: string) {
  await chooseSelect(this, this.page.getByTestId('settings-transition-warning'), label);
});

When('I turn on calm mode', async function (this: World) {
  await setSwitch(this, this.page.getByTestId('settings-calm-mode'), true);
});

Then('calm mode is active', async function (this: World) {
  await expect.poll(() => this.page.evaluate(() => document.documentElement.dataset.calm)).toBe('true');
});

Then('the collapsed task list {string} does not list its items', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-items')).toHaveCount(0);
});

Then('the task list {string} shows the estimate {string}', async function (this: World, title: string, text: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-estimate')).toHaveText(exactText(text));
});

When('I choose the animation level {string}', async function (this: World, label: string) {
  await chooseSelect(this, this.page.getByTestId('settings-animation-level'), label);
});

Then('the animation level {string} is selected', async function (this: World, label: string) {
  await expect.poll(() => selectedLabel(this.page.getByTestId('settings-animation-level'))).toBe(label);
});

Given('the animation level is {string}', async function (this: World, label: string) {
  await this.api.patch('/api/settings', { animationLevel: label.toLowerCase() });
});

Then('the sounds setting is off', async function (this: World) {
  const control = this.page.getByTestId('settings-sounds');
  await expect(control).toBeVisible();
  const on = await control.evaluate((e) =>
    e instanceof HTMLInputElement ? e.checked : e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-pressed') === 'true',
  );
  expect(on, 'sounds setting').toBe(false);
});

Given('the device prefers reduced motion', async function (this: World) {
  await this.page.emulateMedia({ reducedMotion: 'reduce' });
});
