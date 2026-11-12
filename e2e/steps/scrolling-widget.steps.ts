/**
 * Scrolling widget steps (List and Multi-day) (STEPS.md "Scrolling phone widget"): only the Settings part runs in the browser. The widget
 * itself is native; its scenarios are proven by `android/app/src/test` (the `@unit` comments in the feature name the tests).
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { settingControl } from './support/settings.js';
import { chooseOption, selectedLabel, touchDrag } from './support/ui.js';
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

async function sliderBox(w: World) {
  const input = await slider(w);
  const box = await input.boundingBox();
  if (!box) throw new Error('the slider has no box');
  return { box, y: box.y + box.height / 2 };
}

When('I swipe down with a finger starting on the fixed hours slider', async function (this: World) {
  await (await slider(this)).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const { box, y } = await sliderBox(this);
  this.sliderTopBefore = box.y;
  await touchDrag(this.page, { x: box.x + box.width * 0.25, y }, { x: box.x + box.width * 0.25, y: y + 160 }, { durationMs: 250, steps: 12 });
});

When('I drag the fixed hours slider sideways with a finger', async function (this: World) {
  const { box, y } = await sliderBox(this);
  await touchDrag(this.page, { x: box.x + box.width * 0.4, y }, { x: box.x + box.width * 0.85, y }, { durationMs: 400, steps: 15 });
});

Then('the page has scrolled past the fixed hours slider', async function (this: World) {
  const input = await slider(this);
  await expect.poll(async () => (await input.boundingBox())!.y).toBeGreaterThan(this.sliderTopBefore! + 20);
});

Then('the fixed hours in view are no longer {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('settings-widget-hours-slider-value').first()).not.toHaveText(text);
});

Then('the slider {string} spans the width of its setting row', async function (this: World, testid: string) {
  const input = await settingControl(this, testid);
  const row = input.locator('xpath=ancestor::*[@data-testid="settings-row"]');
  const [i, r] = [await input.boundingBox(), await row.boundingBox()];
  expect(i!.width, 'slider width').toBeGreaterThan(r!.width - 48);
  expect(i!.x, 'slider left edge').toBeLessThan(r!.x + 24);
});
