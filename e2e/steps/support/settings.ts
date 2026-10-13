/** Shared helpers for steps that change settings in the Settings screen. */
import { expect, type Locator } from '@playwright/test';
import { chooseOption, selectedLabel } from './ui.js';
import type { World } from './world.js';

/**
 * Perform a settings change and wait for the `PATCH`/`PUT /api/settings` 200 response. If the control already shows
 * the requested value, the app may legitimately send nothing, so the wait is skipped (spec ambiguity, see README).
 */
export async function saveSetting(world: World, alreadySelected: boolean, act: () => Promise<void>) {
  if (alreadySelected) return act();
  const saved = world.page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/settings' && ['PATCH', 'PUT'].includes(r.request().method()),
  );
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
