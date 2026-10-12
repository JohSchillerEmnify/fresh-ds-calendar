/** Open tasks tray and carry-over steps (STEPS.md "Open tasks tray"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { cssColorToRgba } from './support/color.js';
import { expectJoined } from './support/ui.js';
import { attr, exactText, type World } from './support/world.js';

const trayItems = (w: World) => w.page.getByTestId('task-tray-item');

Then('the open tasks tray shows the count {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('task-tray-count')).toHaveText(exactText(text));
});

/** Expand the tray unless its items are already visible. */
async function openTray(world: World) {
  if (await trayItems(world).first().isVisible()) return;
  await world.page.getByTestId('task-tray-toggle').click();
  await expect(world.page.getByTestId('task-tray')).toBeVisible();
}

When('I open the open tasks tray', async function (this: World) {
  await openTray(this);
});

Then('the open tasks tray lists {string}', async function (this: World, list: string) {
  await openTray(this);
  await expectJoined(trayItems(this), list, 'data-title');
});

When('I open the task list {string} from the open tasks tray', async function (this: World, title: string) {
  await openTray(this);
  await this.byTestId('task-tray-item', attr('data-title', title)).click();
  await expect(this.byTestId('tasklist-expanded', attr('data-title', title))).toBeVisible();
});

Then('the task list {string} is shown as carried over from {string}', async function (this: World, title: string, from: string) {
  await expect(this.taskCard(title).getByTestId('tasklist-card-overdue')).toHaveText(exactText(`From ${from}`));
});

Then('the task list {string} is not flagged as overdue', async function (this: World, title: string) {
  await expect(this.taskCard(title)).toBeVisible();
  await expect(this.taskCard(title).getByTestId('tasklist-card-overdue')).toHaveCount(0);
});

Then('the overdue label of {string} does not use the error color', async function (this: World, title: string) {
  const label = this.taskCard(title).getByTestId('tasklist-card-overdue');
  await expect(label).toBeVisible();
  const used = await label.evaluate((el) => {
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return {
      color: cs.color,
      background: cs.backgroundColor,
      error: root.getPropertyValue('--md-sys-color-error'),
      errorContainer: root.getPropertyValue('--md-sys-color-error-container'),
    };
  });
  const hex = async (css: string) => JSON.stringify(await cssColorToRgba(this.page, css));
  expect(await hex(used.color), 'text color is not --md-sys-color-error').not.toBe(await hex(used.error));
  expect(await hex(used.background), 'background is not --md-sys-color-error-container').not.toBe(
    await hex(used.errorContainer),
  );
});

When('I move the task list to today', async function (this: World) {
  await this.page.getByTestId('tasklist-move-today').click();
});
