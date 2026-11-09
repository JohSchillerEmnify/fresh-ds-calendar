/** Settings groups and settings search steps (STEPS.md "Settings groups and search"; features settings-groups, settings-search). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { openSettingsHome, openSettingsPage, settingRowByName } from './support/settings.js';
import { chooseOption, expectJoined, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';

const row = (w: World, name: string) => w.page.locator(`[data-testid="settings-row"][data-setting="${name}"]`);
const results = (w: World) => w.page.getByTestId('settings-search-result');
const result = (w: World, name: string) => w.page.locator(`[data-testid="settings-search-result"][data-setting="${name}"]`);
const groupPage = (w: World) => w.page.getByTestId('settings-group-page');
/** The answer to a saved setting or preference. */
const savedPatch = (w: World) => w.page.waitForResponse((r) => ['/api/prefs', '/api/settings'].includes(new URL(r.url()).pathname) && r.request().method() === 'PATCH');
/** The control at the end of a row: a switch, a segmented button, a menu or a button. */
const controlOf = (r: Locator) => r.locator('[role=switch], [role=group], select, button, input').first();

Then('the settings groups are {string}', async function (this: World, list: string) {
  // read on the settings home; from a group page Back leads there inside the app (no reload)
  if (!(await this.page.getByTestId('settings-home').isVisible())) await openSettingsHome(this);
  await expectJoined(this.page.getByTestId('settings-group'), list, 'data-group');
});

Then('the settings home shows the search bar', async function (this: World) {
  await expect(this.page.getByTestId('settings-search')).toBeVisible();
});

Then('the settings home is shown', async function (this: World) {
  await expect(this.page.getByTestId('settings-home')).toBeVisible();
  await expect(this.page.getByTestId('settings-group').first()).toBeVisible();
  await expect(results(this)).toHaveCount(0);
});

When('I open the settings group {string}', async function (this: World, name: string) {
  if (!(await this.page.getByTestId('settings-home').isVisible())) await openSettingsHome(this);
  await this.page.locator(`[data-testid="settings-group"][data-group="${name}"]`).click();
  await expect(groupPage(this)).toHaveAttribute('data-group', name);
});

Then('the settings group page {string} is shown', async function (this: World, name: string) {
  await expect(groupPage(this)).toBeVisible();
  await expect(groupPage(this)).toHaveAttribute('data-group', name);
});

When('I go back in the settings', async function (this: World) {
  await this.page.getByTestId('settings-back').click();
});

Then('the settings page shows the setting {string}', async function (this: World, name: string) {
  await expect(groupPage(this).locator(`[data-testid="settings-row"][data-setting="${name}"]`)).toBeVisible();
});

Then('the settings page does not show the setting {string}', async function (this: World, name: string) {
  await expect(groupPage(this)).toBeVisible();
  await expect(row(this, name)).toHaveCount(0);
});

When('I turn off {string} in the settings', async function (this: World, name: string) {
  const control = (await settingRowByName(this, name)).getByRole('switch', { name, exact: true });
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) === 'true') {
    const saved = savedPatch(this);
    await control.click();
    expect((await saved).status(), 'saved').toBe(200);
  }
  await expect(control).toHaveAttribute('aria-checked', 'false');
});

When('I choose {string} for {string} in the settings', async function (this: World, option: string, name: string) {
  const control = controlOf(await settingRowByName(this, name));
  if ((await selectedLabel(control)) === option) return;
  const saved = savedPatch(this);
  await chooseOption(control, option);
  expect((await saved).status(), 'saved').toBe(200);
});

Then('{string} is chosen for {string} in the settings', async function (this: World, option: string, name: string) {
  const control = controlOf(row(this, name));
  await expect.poll(() => selectedLabel(control)).toBe(option);
});

Then('every settings row shows its name first and its control at the end', async function (this: World) {
  const rows = groupPage(this).locator('[data-testid="settings-row"]:not(.link)');
  await expect(rows.first()).toBeVisible();
  const bad = await rows.evaluateAll((els) => els.flatMap((el) => {
    const label = el.querySelector('.lab')?.getBoundingClientRect();
    const ctl = el.querySelector('.ctl')?.firstElementChild?.getBoundingClientRect();
    // a control under the name (wide groups, outlined fields) counts as after it
    return label && ctl && !(label.left < ctl.left || label.top < ctl.top) ? [el.getAttribute('data-setting') ?? '?'] : [];
  }));
  expect(bad, 'rows whose control does not come after the name').toEqual([]);
});

When('I open the setting {string}', async function (this: World, name: string) {
  const r = await settingRowByName(this, name);
  // a row that opens a page or sheet is itself the button; otherwise its control at the end is
  await ((await r.evaluate((e) => e.classList.contains('link'))) ? r : controlOf(r)).click();
});

Then('the settings show the plan {string} for the calendar {string}', async function (this: World, plan: string, name: string) {
  await openSettingsPage(this, 'calendars');
  await expect(row(this, name).locator('.sub')).toHaveText(plan);
});

Then('the time picker is shown', async function (this: World) {
  await expect(this.page.getByTestId('time-picker')).toBeVisible();
});

When('I open the calendar {string} in the settings', async function (this: World, name: string) {
  await row(this, name).click();
  await expect(groupPage(this)).toHaveAttribute('data-group', name);
});

When('I search the settings for {string}', async function (this: World, query: string) {
  if (!(await this.page.getByTestId('settings-home').isVisible())) await openSettingsHome(this);
  await this.page.getByTestId('settings-search').fill(query);
});

Then('the settings search shows {string} in {string}', async function (this: World, name: string, group: string) {
  const paths = () => result(this, name).evaluateAll((els) => els.map((e) => e.getAttribute('data-path') ?? ''));
  await expect.poll(async () => (await paths()).some((p) => p === group || p.startsWith(`${group} › `)), { message: `"${name}" in "${group}"` }).toBe(true);
});

Then('the settings search shows {string}', async function (this: World, name: string) {
  await expect(result(this, name).first()).toBeVisible();
});

Then('the settings search shows {int} result(s)', async function (this: World, n: number) {
  await expect(results(this)).toHaveCount(n);
});

Then('the settings search says nothing matches {string}', async function (this: World, query: string) {
  await expect(results(this)).toHaveCount(0);
  await expect(this.page.getByTestId('settings-search-empty')).toContainText(query);
});

When('I clear the settings search', async function (this: World) {
  await this.page.getByTestId('settings-search-clear').click();
});

When('I choose the search result {string}', async function (this: World, name: string) {
  await result(this, name).first().click();
  await expect(groupPage(this)).toBeVisible();
});

Then('the setting {string} is highlighted', async function (this: World, name: string) {
  await expect(row(this, name)).toHaveAttribute('data-flash', '');
  await expect(row(this, name)).toBeInViewport();
});
