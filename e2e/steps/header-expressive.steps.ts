/** Top bar sizes and the month-only week title (STEPS.md "UI redesign E", feature header-expressive). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { chooseOption, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';

/** The two top bar sizes and the stored `headerLayout` values behind them (Expressive = the former two rows). */
const LAYOUT: Record<string, 'two-rows' | 'one-row'> = { Expressive: 'two-rows', Compact: 'one-row' };
const layoutValue = (label: string) => {
  const v = LAYOUT[label];
  if (!v) throw new Error(`Unknown top bar size "${label}"`);
  return v;
};

Given('the top bar size is set to {string}', async function (this: World, label: string) {
  await this.api.patch('/api/prefs', { headerLayout: layoutValue(label) });
});

When('I choose {string} as the top bar size', async function (this: World, label: string) {
  layoutValue(label);
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(this.page.getByTestId('settings-top-bar-size'), label);
  expect((await saved).status(), 'top bar size saved').toBe(200);
});

Then('the top bar size {string} is selected', async function (this: World, label: string) {
  layoutValue(label);
  await expect.poll(() => selectedLabel(this.page.getByTestId('settings-top-bar-size'))).toBe(label);
});

Then('the top bar size {string} is the default', async function (this: World, label: string) {
  layoutValue(label);
  expect((await this.api.get<{ headerLayout: string }>('/api/prefs')).headerLayout, 'nothing chosen').toBe('auto');
  await expect(this.page.getByTestId('top-bar')).toHaveAttribute('data-size', label.toLowerCase());
});

When('I tap the period title', async function (this: World) {
  await this.page.getByTestId('period-title').click();
});
