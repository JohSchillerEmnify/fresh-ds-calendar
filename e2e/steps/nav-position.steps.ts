/** View switcher position steps (STEPS.md "View switcher position"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, chooseOption, viewport } from './support/ui.js';
import type { World } from './support/world.js';

Given('the view switcher on phones is set to {string}', async function (this: World, position: string) {
  // the side menu is stored as `drawer`
  await this.api.patch('/api/prefs', { navPhone: position === 'side menu' ? 'drawer' : position });
});

Given('the view switcher on desktop and tablets is set to {string}', async function (this: World, position: string) {
  await this.api.patch('/api/prefs', { navDesktop: position });
});

When('I choose {string} as the view switcher position on phones', async function (this: World, label: string) {
  const control = this.page.getByTestId('settings-nav-phone');
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(control, label);
  expect((await saved).status(), 'position saved').toBe(200);
});

Then('the view switcher is in the {string} position', async function (this: World, position: string) {
  await expect(this.page.getByTestId('view-switcher')).toHaveAttribute('data-position', position);
});

Then('the view switcher is directly under the top bar', async function (this: World) {
  const top = await box(this.page.getByTestId('top-bar'));
  const sw = await box(this.page.getByTestId('view-switcher'));
  expect(Math.abs(sw.y - (top.y + top.height)), 'gap between top bar and view switcher').toBeLessThanOrEqual(2);
});

Then('the view switcher is above the calendar', async function (this: World) {
  const sw = await box(this.page.getByTestId('view-switcher'));
  const cal = await box(this.page.getByTestId('calendar-swipe-area'));
  expect(sw.y + sw.height, 'switcher bottom above the calendar top').toBeLessThanOrEqual(cal.y + 1);
});

Then('the view switcher is on the {string} side of the screen', async function (this: World, side: string) {
  const half = viewport(this.page).width / 2;
  await expect
    .poll(async () => { const b = await box(this.page.getByTestId('view-switcher')); return b.x + b.width / 2 < half ? 'left' : 'right'; })
    .toBe(side);
});

Then('there is no bottom bar', async function (this: World) {
  await expect(this.page.getByTestId('bottom-bar').and(this.page.locator('[data-position="bottom"]'))).toHaveCount(0);
});

Then('the open tasks tray is at the bottom of the screen', async function (this: World) {
  const h = viewport(this.page).height;
  await expect.poll(async () => { const b = await box(this.page.getByTestId('task-tray')); return Math.abs(b.y + b.height - h); }).toBeLessThanOrEqual(1);
});

Then('the open tasks tray is above the bottom bar', async function (this: World) {
  const tray = await box(this.page.getByTestId('task-tray'));
  const bar = await box(this.page.getByTestId('bottom-bar'));
  expect(tray.y + tray.height, 'tray bottom above the bar top').toBeLessThanOrEqual(bar.y + 1);
});

Then('the add button is above the open tasks tray', async function (this: World) {
  const tray = await box(this.page.getByTestId('task-tray'));
  const fab = await box(this.page.getByTestId('create-button'));
  expect(fab.y + fab.height, 'add button bottom above the tray top').toBeLessThanOrEqual(tray.y + 1);
});
