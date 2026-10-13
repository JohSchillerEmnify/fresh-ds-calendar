/** Settings, categories and filter steps (STEPS.md "Settings", "Categories, tags and filters"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { expectRoleHue } from './support/color.js';
import { chooseSelect, saveSetting } from './support/settings.js';
import { chooseOption, expectJoined, selectedLabel } from './support/ui.js';
import { attr, tid, type World } from './support/world.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

const themeOption = (w: World, label: string) =>
  w.page.getByTestId('settings-theme-mode').locator(attr('data-value', label.toLowerCase()));
const seedPreset = (w: World, name: string) => w.byTestId('settings-seed-preset', attr('data-name', name));

/**
 * Theme mode and seed colour live in the theme menu (STEPS.md, owner 2026-10-13): open it from the settings page's
 * `settings-theme` row when it is not open yet. Returns whether this call opened it.
 */
async function inThemeMenu(w: World): Promise<boolean> {
  if (await w.page.getByTestId('theme-view').isVisible()) return false;
  await w.page.getByTestId('settings-theme').click();
  await expect(w.page.getByTestId('theme-view')).toBeVisible();
  return true;
}

/** Runs a read-only check in the theme menu and returns to the settings page if the check had to open the menu. */
async function checkInThemeMenu(w: World, check: () => Promise<void>) {
  const opened = await inThemeMenu(w);
  await check();
  if (opened) {
    await w.page.getByTestId('theme-back').click();
    await expect(w.page.getByTestId('settings-view')).toBeVisible();
  }
}

When('I open the settings', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
});

Then('the settings screen is shown', async function (this: World) {
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
});

When('I leave the settings', async function (this: World) {
  await this.page.getByTestId('settings-back').click();
  await expect(this.page.getByTestId('settings-view')).toBeHidden();
});

Then('the settings sections are {string}', async function (this: World, list: string) {
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  const headings = this.page.getByTestId('settings-section').locator('h2');
  await expect(headings).toHaveText(list.split(', '));
  await expect
    .poll(() => this.page.getByTestId('settings-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-section'))))
    .toEqual(['appearance', 'calendar', 'tasklists', 'motivation', 'motion', 'labs', 'account']);
});

Then('the settings page has no theme mode or seed colour controls', async function (this: World) {
  const view = this.page.getByTestId('settings-view');
  await expect(view).toBeVisible();
  for (const id of ['settings-theme-mode', 'settings-seed-preset', 'settings-seed-custom']) {
    await expect(view.getByTestId(id)).toHaveCount(0);
  }
});

When('I choose the theme mode {string}', async function (this: World, label: string) {
  await inThemeMenu(this);
  const option = themeOption(this, label);
  await expect(option).toBeVisible();
  await saveSetting(this, (await option.getAttribute('aria-pressed')) === 'true', () => option.click());
});

Then('the theme mode {string} is selected', async function (this: World, label: string) {
  await checkInThemeMenu(this, async () => {
    const option = themeOption(this, label);
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(option).toHaveText(new RegExp(label));
  });
});

When('I choose the seed color preset {string}', async function (this: World, name: string) {
  await inThemeMenu(this);
  const preset = seedPreset(this, name);
  await expect(preset).toBeVisible();
  await saveSetting(this, (await preset.getAttribute('aria-pressed')) === 'true', () => preset.click());
});

When('I enter the custom seed color {string}', async function (this: World, value: string) {
  await inThemeMenu(this);
  const input = this.page.getByTestId('settings-seed-custom');
  await expect(input).toBeVisible();
  // A rejected custom color does not send a request.
  await saveSetting(this, !HEX.test(value), async () => {
    await input.fill(value);
    await input.press('Enter');
  });
});

Then('the seed color {string} is selected', async function (this: World, name: string) {
  await checkInThemeMenu(this, () => expectSeed(this, name));
});

async function expectSeed(w: World, name: string) {
  const pressed = () =>
    w.page
      .locator(`${tid('settings-seed-preset')}[aria-pressed="true"]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-name') ?? ''));
  if (name === 'Custom') {
    // "Custom" may be its own swatch (data-name="Custom") or simply no preset pressed.
    await expect.poll(async () => (await pressed()).filter((n) => n !== 'Custom').length).toBe(0);
    await expect(w.page.getByTestId('settings-seed-custom')).not.toHaveValue('');
  } else {
    await expect.poll(pressed).toEqual([name]);
  }
}

Then('the custom seed color field shows the error {string}', async function (this: World, message: string) {
  await expect(this.page.getByTestId('settings-seed-error')).toHaveText(message);
});

Then(
  'the color role {string} has a hue within {int} degrees of {string}',
  async function (this: World, role: string, degrees: number, hex: string) {
    await expectRoleHue(this.page, role, degrees, hex);
  },
);

When('I choose {string} as the default view', async function (this: World, label: string) {
  await chooseSelect(this, this.page.getByTestId('settings-default-view'), label);
});

Then('the default view {string} is selected', async function (this: World, label: string) {
  await expect.poll(() => selectedLabel(this.page.getByTestId('settings-default-view'))).toBe(label);
});

When('I choose {string} as the default event color', async function (this: World, label: string) {
  await chooseSelect(this, this.page.getByTestId('settings-default-event-color'), label);
});

Then('the default event color {string} is selected', async function (this: World, label: string) {
  await expect.poll(() => selectedLabel(this.page.getByTestId('settings-default-event-color'))).toBe(label);
});

When('I switch to another device', async function (this: World) {
  await this.switchDevice();
});

When('the settings are changed elsewhere to the theme mode {string}', async function (this: World, label: string) {
  await this.api.patch('/api/settings', { themeMode: label.toLowerCase() });
});

// --- categories (Settings screen) ------------------------------------------------------------------------------

const categoryDialog = (w: World) => w.page.getByTestId('category-dialog');
const categoryRow = (w: World, name: string) => w.byTestId('settings-category', attr('data-name', name));

/** Save the category dialog and wait until it either closed (saved) or shows an error. */
async function saveCategory(world: World) {
  const dlg = categoryDialog(world);
  await dlg.getByTestId('category-save').click();
  await expect
    .poll(async () => (await dlg.isHidden()) || (await dlg.getByTestId('category-error').isVisible()))
    .toBe(true);
}

async function addCategory(world: World, name: string, color: string, icon?: string) {
  await world.page.getByTestId('settings-category-add').click();
  const dlg = categoryDialog(world);
  await expect(dlg).toBeVisible();
  await dlg.getByTestId('category-name').fill(name);
  await dlg.getByTestId('category-color').fill(color);
  if (icon !== undefined) await dlg.getByTestId('category-icon').fill(icon);
  await saveCategory(world);
}

async function openCategory(world: World, name: string) {
  await categoryRow(world, name).click();
  await expect(categoryDialog(world)).toBeVisible();
}

When(
  'I add the category {string} with the color {string} and the icon {string}',
  async function (this: World, name: string, color: string, icon: string) {
    await addCategory(this, name, color, icon);
  },
);

When('I add the category {string} with the color {string}', async function (this: World, name: string, color: string) {
  await addCategory(this, name, color);
});

When('I rename the category {string} to {string}', async function (this: World, from: string, to: string) {
  await openCategory(this, from);
  await categoryDialog(this).getByTestId('category-name').fill(to);
  await saveCategory(this);
});

When('I change the color of the category {string} to {string}', async function (this: World, name: string, color: string) {
  await openCategory(this, name);
  await categoryDialog(this).getByTestId('category-color').fill(color);
  await saveCategory(this);
});

When('I delete the category {string}', async function (this: World, name: string) {
  await openCategory(this, name);
  await categoryDialog(this).getByTestId('category-delete').click();
});

Then('the categories are {string}', async function (this: World, list: string) {
  await expectJoined(this.page.getByTestId('settings-category'), list, 'data-name');
});

Then('the category {string} has the color {string}', async function (this: World, name: string, color: string) {
  await expect(categoryRow(this, name)).toHaveAttribute('data-color', new RegExp(`^${color}$`, 'i'));
});

Then('the category dialog shows the error {string}', async function (this: World, message: string) {
  await expect(categoryDialog(this).getByTestId('category-error')).toHaveText(message);
});

// --- category/tag display on task lists ------------------------------------------------------------------------

Then('the task list {string} has the color {string}', async function (this: World, title: string, color: string) {
  await expect(this.taskCard(title)).toHaveAttribute('data-color', new RegExp(`^${color}$`, 'i'));
});

Then('the task list {string} shows the icon {string}', async function (this: World, title: string, icon: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-icon')).toHaveText(icon);
});

Then('the task list {string} shows no icon', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-icon')).toHaveCount(0);
});

// --- filters ---------------------------------------------------------------------------------------------------

async function showFilters(world: World) {
  const bar = world.page.getByTestId('filter-bar');
  if (!(await bar.isVisible())) await world.page.getByTestId('filter-button').click();
  await expect(bar).toBeVisible();
}

When('I show the filters', async function (this: World) {
  await showFilters(this);
});

async function toggleChip(world: World, testId: string, name: string) {
  await showFilters(world);
  const chip = world.byTestId(testId, attr('data-name', name));
  const before = await chip.getAttribute('aria-pressed');
  await chip.click();
  await expect(chip).not.toHaveAttribute('aria-pressed', before ?? 'false');
}

When('I filter by the category {string}', async function (this: World, name: string) {
  await toggleChip(this, 'filter-chip-category', name);
});

When('I filter by the tag {string}', async function (this: World, name: string) {
  await toggleChip(this, 'filter-chip-tag', name);
});

When('I clear the filters', async function (this: World) {
  await showFilters(this);
  await this.page.getByTestId('filter-clear').click();
});

Then('the category filter {string} is selected', async function (this: World, name: string) {
  await expect(this.byTestId('filter-chip-category', attr('data-name', name))).toHaveAttribute('aria-pressed', 'true');
});

Then('the tag filters are {string}', async function (this: World, list: string) {
  await expectJoined(this.page.getByTestId('filter-chip-tag'), list, 'data-name');
});

Then('the URL query is {string}', async function (this: World, query: string) {
  await expect.poll(() => new URL(this.page.url()).search.replace(/^\?/, '')).toBe(query);
});
