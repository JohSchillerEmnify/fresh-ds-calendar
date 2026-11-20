/** Task lists consent steps (STEPS.md "Task lists consent"): the first-sign-in question and the places that follow its answer. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { World } from './support/world.js';

const sheet = (w: World) => w.page.getByTestId('tasks-consent');

Given('task lists have not been turned on or off yet', async function (this: World) {
  await this.api.post('/api/__test/tasks-choice', { choice: 'ask' });
});

Then('I see the task lists question', async function (this: World) {
  await expect(sheet(this)).toBeVisible();
});

Then('I do not see the task lists question', async function (this: World) {
  await expect(sheet(this)).toHaveCount(0);
});

Then('the task lists question says {string}', async function (this: World, text: string) {
  await expect(sheet(this)).toBeVisible();
  await expect(sheet(this)).toContainText(text);
});

Then('the task lists question offers {string} and {string}', async function (this: World, a: string, b: string) {
  await expect(this.page.getByTestId('tasks-consent-not-now')).toHaveText(a);
  await expect(this.page.getByTestId('tasks-consent-turn-on')).toHaveText(b);
});

When('I choose {string} in the task lists question', async function (this: World, label: string) {
  const button = sheet(this).getByRole('button', { name: label, exact: true });
  const answered = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasks-calendar' && r.request().method() === 'PUT');
  await button.click();
  expect((await answered).status(), 'answer saved').toBe(200);
  await expect(sheet(this)).toHaveCount(0);
});

Then('Google has no calendar {string}', async function (this: World, summary: string) {
  await this.settled();
  expect((await this.api.remoteCalendars()).filter((c) => c.summary === summary)).toHaveLength(0);
});

/** Opens the create menu, reports whether it lists task lists, and closes it again. */
async function createMenuOffersTasks(world: World): Promise<boolean> {
  await world.page.getByTestId('create-button').click();
  await expect(world.page.getByTestId('new-kind-event')).toBeVisible();
  const offered = (await world.page.getByTestId('new-kind-tasklist').count()) > 0;
  await world.page.keyboard.press('Escape');
  await expect(world.page.getByTestId('new-kind-event')).toHaveCount(0);
  return offered;
}

Then('the create menu offers task lists', async function (this: World) {
  expect(await createMenuOffersTasks(this), 'task lists in the create menu').toBe(true);
});

Then('the create menu does not offer task lists', async function (this: World) {
  expect(await createMenuOffersTasks(this), 'task lists in the create menu').toBe(false);
});

Then('the view switcher offers {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId(`view-switch-${label.toLowerCase()}`)).toBeVisible();
});

Then('the open tasks tray is not on the screen', async function (this: World) {
  await this.settled();
  await expect(this.page.getByTestId('task-tray')).toHaveCount(0);
});

When('I tap the switch {string} in the settings', async function (this: World, label: string) {
  await this.page.getByRole('switch', { name: label, exact: true }).click();
});

When('I open the create menu', async function (this: World) {
  await this.page.getByTestId('create-button').click();
  await expect(this.page.getByTestId('new-kind-event')).toBeVisible();
});

When('I open the create menu while the streak message is shown', async function (this: World) {
  await expect(this.page.getByTestId('streak-message')).toBeVisible();
  await this.page.getByTestId('create-button').click({ timeout: 1500 });
  await expect(this.page.getByTestId('new-kind-event')).toBeVisible();
});

When('I close the create menu', async function (this: World) {
  await this.page.keyboard.press('Escape');
  await expect(this.page.getByTestId('new-kind-event')).toHaveCount(0);
});
