/** Labs steps used by labs-clock.feature (STEPS.md "Labs"): the Labs switch and the 24-hour clock view. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { tid, type World } from './support/world.js';

When('I turn on experimental views in the settings', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  const control = this.page.getByTestId('settings-labs');
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) !== 'true') {
    const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
    await control.click();
    expect((await saved).status(), 'prefs saved').toBe(200);
  }
  await this.page.getByTestId('settings-back').click();
});

Then(
  'the view switcher offers {string}, {string} and {string} marked as experimental',
  async function (this: World, a: string, b: string, c: string) {
    for (const label of [a, b, c]) {
      const entry = this.page.getByTestId(`view-switch-${label.toLowerCase()}`);
      await expect(entry).toBeVisible();
      await expect(entry).toContainText(label);
      await expect(entry).toHaveAttribute('data-experimental', 'true');
    }
  },
);

When('I open the clock view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/clock/${date}`);
  await expect(this.page.getByTestId('clock-view')).toBeVisible();
});

Then(
  'the event {string} is an arc from {time} to {time}',
  async function (this: World, title: string, start: string, end: string) {
    const arc = this.page.locator(tid('clock-arc') + `[data-title="${title}"]`);
    await expect(arc).toHaveCount(1);
    await expect(arc).toHaveAttribute('data-start', start);
    await expect(arc).toHaveAttribute('data-end', end);
  },
);

Then('the clock hand points at {time}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('clock-hand')).toHaveAttribute('data-time', time);
});

Then('the arc of {string} is labelled {string}', async function (this: World, title: string, label: string) {
  const text = this.page.locator(tid('clock-label') + `[data-title="${title}"]`);
  await expect(text).toHaveCount(1);
  await expect(text).toBeVisible();
  await expect(text).toHaveText(label);
});
