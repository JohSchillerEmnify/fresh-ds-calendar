/** Shared helpers for steps that change settings in the Settings screen. */
import { expect, type Locator, type Request } from '@playwright/test';
import { chooseOption, selectedLabel } from './ui.js';
import type { World } from './world.js';

/**
 * Perform a settings change and wait for the `PATCH`/`PUT /api/settings` 200 response. If the control already shows
 * the requested value, the app may legitimately send nothing, so the wait is skipped (spec ambiguity, see README).
 */
export async function saveSetting(world: World, alreadySelected: boolean, act: () => Promise<void>) {
  if (alreadySelected) return act();
  const isSave = (r: Request) => new URL(r.url()).pathname === '/api/settings' && ['PATCH', 'PUT'].includes(r.method());
  // Offline ("the network connection is lost") the save cannot answer: wait for it to fail instead.
  if (!(await world.page.evaluate(() => navigator.onLine))) {
    const failed = world.page.waitForEvent('requestfailed', isSave);
    await act();
    await failed;
    return;
  }
  const saved = world.page.waitForResponse((r) => isSave(r.request()));
  await act();
  expect((await saved).status(), 'settings saved').toBe(200);
}

/** Like {@link saveSetting} for fine-tuning of the chosen theme: waits for the `PATCH /api/prefs/theme` response. */
export async function saveThemePref(world: World, alreadySelected: boolean, act: () => Promise<void>) {
  if (alreadySelected) return act();
  const saved = world.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs/theme' && r.request().method() === 'PATCH');
  await act();
  expect((await saved).status(), 'theme saved').toBe(200);
}

/** Choose an option (by visible label) of a select / radio-like setting control and wait for the save. */
export async function chooseSelect(world: World, control: Locator, label: string) {
  await expect(control).toBeVisible();
  await saveSetting(world, (await selectedLabel(control)) === label, () => chooseOption(control, label));
}

/** Put a switch (checkbox or role=switch element) into the wanted state and wait for the save. */
export async function setSwitch(world: World, control: Locator, on: boolean) {
  await expect(control).toBeVisible();
  const isInput = await control.evaluate((e) => e instanceof HTMLInputElement);
  const current = isInput
    ? await control.isChecked()
    : (await control.getAttribute('aria-checked')) === 'true' || (await control.getAttribute('aria-pressed')) === 'true';
  if (current === on) return;
  await saveSetting(world, false, () => control.click());
}

// --- settings pages (feature settings-groups) -------------------------------------------------------------------

/** The settings page that holds each control (docs/settings-tree.md), by test id prefix; the first match wins. */
const PAGE_OF: Array<[RegExp, string]> = [
  [/^settings-sunflowers/, 'theme'],
 
  [/^settings-bedtime-/, 'focus/bedtime'],
  [/^settings-(view-switch-|default-view|min-event-length|month-scroll|day-side-by-side|week-side-by-side|approach)/, 'views'],
  [/^settings-(theme$|theme-name$|language|nav-|top-bar-size|bottom-bar-size|bar-size|left-handed|sync-indicator|version-corner)/, 'appearance'],
  [/^settings-(task-|category|carried-from|undated-done|templates)/, 'tasklists'],
  [/^(reminders-|tasks-default-|settings-notify-)/, 'reminders'],
  [/^settings-(calm-mode|animation-level|system-reduced-motion|ignore-system-motion|sounds|streak|best-streak|support-cat|bedtime$)/, 'focus'],
  [/^settings-(labs|week-two-row)/, 'labs'],
  [/^(iphone-widget|settings-widget-|settings-android-widgets|settings-scrolling-)/, 'widgets'],
  [/^settings-(signout|calendar-access|backup-|install-app|android-app|whats-new|credits|error-log|version|update-|app-cert|reset-demo)/, 'account'],
];

/** The settings page (`views`, `focus/bedtime`, `theme`, ...) that holds the control `testid`. */
export function settingsPageOf(testid: string): string {
  const hit = PAGE_OF.find(([re]) => re.test(testid));
  if (!hit) throw new Error(`No settings page known for "${testid}"`);
  return hit[1];
}

/** Opens the settings home from wherever the app is, as a person would: the gear, or Back from a settings page. */
export async function openSettingsHome(world: World) {
  const { page } = world;
  if (!page.url().startsWith('http')) {
    await page.goto('/');
    await world.calendarShown();
  }
  // a settings path that was just opened may still be rendering: wait for it before deciding where we are
  if (new URL(page.url()).pathname.startsWith('/settings')) await expect(page.getByTestId('settings-view').or(page.getByTestId('theme-view')).first()).toBeVisible();
  if (await page.getByTestId('theme-view').isVisible()) await page.getByTestId('theme-back').click();
  if (!(await page.getByTestId('settings-view').isVisible())) await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-view')).toBeVisible();
  for (let i = 0; i < 3 && !(await page.getByTestId('settings-home').isVisible()); i++) {
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('settings-view')).toBeVisible();
  }
  await expect(page.getByTestId('settings-home')).toBeVisible();
}

/** Opens the settings page `path` (`views`, `focus/bedtime`, `calendars/tasks-calendar`, `theme`) unless it is open. */
export async function openSettingsPage(world: World, path: string) {
  const { page } = world;
  if (path === 'theme' && (await page.getByTestId('theme-view').isVisible())) return;
  const open = page.locator(`[data-testid="settings-group-page"][data-group-id="${path}"]`);
  if (await open.isVisible()) return;
  await openSettingsHome(world);
  const [group, sub] = path === 'theme' ? ['appearance', 'theme'] : path.split('/');
  await page.locator(`[data-testid="settings-group"][data-group-id="${group}"]`).click();
  await expect(page.locator(`[data-testid="settings-group-page"][data-group-id="${group}"]`)).toBeVisible();
  if (!sub) return;
  const id = { theme: 'theme', bedtime: 'bedtime', 'tasks-calendar': 'tasksCalendar' }[sub] ?? sub;
  await page.locator(`[data-setting-id="${id}"]`).click();
  await expect(path === 'theme' ? page.getByTestId('theme-view') : open).toBeVisible();
}

/** The control `testid` of the settings, after opening the page that holds it when it is not on screen. */
export async function settingControl(world: World, testid: string): Promise<Locator> {
  const control = world.page.getByTestId(testid);
  if (!(await control.first().isVisible())) await openSettingsPage(world, settingsPageOf(testid));
  return control;
}

/** Leaves the settings for the page that was open before them (Back until no settings page is shown). */
export async function leaveSettings(world: World) {
  const { page } = world;
  if (await page.getByTestId('theme-view').isVisible()) await page.getByTestId('theme-back').click();
  for (let i = 0; i < 4 && (await page.getByTestId('settings-view').isVisible()); i++) await page.getByTestId('settings-back').click();
  await expect(page.getByTestId('settings-view')).toBeHidden();
}

/** Uses the settings search to reach the row named `name` and returns that row (`settings-row` with `data-setting`). */
export async function settingRowByName(world: World, name: string): Promise<Locator> {
  const { page } = world;
  const row = page.locator(`[data-testid="settings-row"][data-setting="${name}"]`);
  if (await row.isVisible()) return row;
  await openSettingsHome(world);
  await page.getByTestId('settings-search').fill(name);
  await page.locator(`[data-testid="settings-search-result"][data-setting="${name}"]`).first().click();
  await expect(page.getByTestId('settings-group-page')).toBeVisible();
  return row;
}

/** Turns the settings switch `testId` on (waiting for the prefs to be saved) and leaves the settings. */
export async function turnOnLabsSwitch(world: World, testId: string) {
  await setLabsSwitch(world, testId, true);
}

/** Puts the settings switch `testId` into the wanted state (waiting for the prefs to be saved) and leaves the settings. */
export async function setLabsSwitch(world: World, testId: string, on: boolean) {
  const control = await settingControl(world, testId);
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) !== String(on)) {
    const saved = world.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
    await control.click();
    expect((await saved).status(), 'prefs saved').toBe(200);
  }
  await leaveSettings(world);
}
