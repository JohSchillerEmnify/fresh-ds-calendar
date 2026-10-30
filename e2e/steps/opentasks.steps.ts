/** Open tasks tray and carry-over steps (STEPS.md "Open tasks tray"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { cssColorToRgba } from './support/color.js';
import { chooseListAction, expectJoined } from './support/ui.js';
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

Then('the open tasks tray does not list {string}', async function (this: World, list: string) {
  const toggle = this.page.getByTestId('task-tray-toggle');
  if (!(await trayItems(this).first().isVisible()) && (await toggle.isVisible())) await openTray(this);
  await expect(trayRow(this, list)).toHaveCount(0);
});

// Open tray rows hold the same task list view as the expanded list (feature open-tasks-in-sight).
const trayRow = (w: World, title: string) => w.byTestId('task-tray-item', attr('data-title', title));
const trayItem = (w: World, list: string, item: string) =>
  trayRow(w, list).getByTestId('tasklist-item').and(w.page.locator(attr('data-title', item)));

When('I add the item {string} to {string} in the open tasks tray', async function (this: World, item: string, list: string) {
  await openTray(this);
  if (!(await trayRow(this, list).getByTestId('tasklist-new-item').isVisible())) await trayRow(this, list).getByTestId('tasklist-add').click();
  const input = trayRow(this, list).getByTestId('tasklist-new-item');
  await input.fill(item);
  await input.press('Enter');
  await expect(trayItem(this, list, item)).toHaveCount(1);
});

When('I edit the details of {string} in the open tasks tray', async function (this: World, list: string) {
  await openTray(this);
  await chooseListAction(this.page, trayRow(this, list), 'tasklist-edit');
});

Then('the open tasks tray shows the message {string} for {string}', async function (this: World, text: string, list: string) {
  await expect(trayRow(this, list).getByTestId('tasklist-complete-message')).toHaveText(exactText(text), { timeout: 1500 });
});

Then('the open tasks tray shows the task list {string} with items:', async function (this: World, title: string, table: DataTable) {
  await openTray(this);
  const want = table.hashes().map((r) => ({ item: r.item, done: r.done === 'yes' ? 'true' : 'false' }));
  const rows = trayRow(this, title).getByTestId('tasklist-item');
  await expect(rows).toHaveCount(want.length);
  await expect.poll(() => rows.evaluateAll((els) => els.map((e) => ({ item: e.getAttribute('data-title'), done: e.getAttribute('data-done') }))))
    .toEqual(want);
});

async function setItemInTray(world: World, list: string, item: string, done: boolean) {
  await openTray(world);
  const row = trayItem(world, list, item);
  await expect(row).toHaveAttribute('data-done', done ? 'false' : 'true');
  await row.getByTestId('tasklist-item-checkbox').click();
}
When('I tick the item {string} in the open tasks tray', async function (this: World, item: string) {
  await setItemInTray(this, await listOfItem(this, item), item, true);
});
When('I untick the item {string} in the open tasks tray', async function (this: World, item: string) {
  await setItemInTray(this, await listOfItem(this, item), item, false);
});
/** The tray list holding an item with this title (item titles are unique within a scenario). */
async function listOfItem(world: World, item: string): Promise<string> {
  await openTray(world);
  const owner = trayItems(world).filter({ has: world.page.locator(`[data-testid="tasklist-item"]${attr('data-title', item)}`) });
  await expect(owner).toHaveCount(1);
  return (await owner.getAttribute('data-title'))!;
}

Then('the task list {string} in the open tasks tray is struck through and shows only its title', async function (this: World, title: string) {
  await openTray(this);
  const row = trayRow(this, title);
  await expect(row).toHaveAttribute('data-finished', 'true');
  await expect(row.getByTestId('tasklist-item')).toHaveCount(0);
  await expect(row.getByTestId('task-tray-title')).toHaveCSS('text-decoration-line', 'line-through');
});

Then('the task list {string} in the open tasks tray shows no done count', async function (this: World, title: string) {
  await openTray(this);
  await expect(trayRow(this, title)).toBeVisible();
  await expect(trayRow(this, title).getByTestId('task-tray-row-count')).toHaveCount(0);
});

When('I unfold the task list {string} in the open tasks tray', async function (this: World, title: string) {
  await openTray(this);
  await trayRow(this, title).getByTestId('task-tray-unfold').click();
});

Then('the open tasks tray shows all {int} items of the task list {string}', async function (this: World, count: number, title: string) {
  await openTray(this);
  const rows = trayRow(this, title).getByTestId('tasklist-item');
  await expect(rows).toHaveCount(count);
  for (const r of await rows.all()) {
    await r.scrollIntoViewIfNeeded();
    await expect(r).toBeVisible();
  }
});

Then('the create button does not cover any control of the open tasks tray', async function (this: World) {
  await openTray(this);
  const fab = this.page.getByTestId('create-button');
  // Hidden, or none of its pixels over a tray button/checkbox (poll: the FAB slides away with a transition).
  await expect.poll(async () => {
    if (!(await fab.isVisible())) return 0;
    const f = (await fab.boundingBox())!;
    const boxes = await this.page.getByTestId('task-tray').locator('button, input, [role="checkbox"]').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
    return boxes.filter((b) => f.x < b.x + b.w && b.x < f.x + f.width && f.y < b.y + b.h && b.y < f.y + f.height).length;
  }).toBe(0);
});

Given('the item {string} of the task list {string} was ticked on {date}', async function (this: World, item: string, title: string, date: string) {
  // Tick through the public API with the test clock on that date, then put the clock back.
  const { now } = await this.api.get<{ now: string }>('/api/config');
  const [ev] = await this.api.remoteEvents(title);
  const list = await this.api.get<{ items: Array<{ id: string; title: string }> }>(`/api/tasklists/${encodeURIComponent(ev.id)}`);
  const it = list.items.find((i) => i.title === item);
  if (!it) throw new Error(`No item "${item}" in "${title}"`);
  await this.api.setClock(berlinIso(date, '12:00'));
  await this.api.patch(`/api/tasklists/${encodeURIComponent(ev.id)}/items/${encodeURIComponent(it.id)}`, { done: true });
  await this.api.setClock(now);
});

Then('the task list {string} is shown as carried over from {string}', async function (this: World, title: string, from: string) {
  const label = this.taskCard(title).getByTestId('tasklist-card-overdue');
  await expect(label).toBeVisible();
  // Roomy cards show the text, narrow ones a badge named by its aria-label (STEPS.md).
  await expect.poll(() => label.evaluate((e) => e.getAttribute('aria-label') ?? e.textContent?.trim())).toBe(`From ${from}`);
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

Then('the open tasks tray is collapsed', async function (this: World) {
  await expect(this.page.getByTestId('task-tray')).toHaveAttribute('data-expanded', 'false');
});

Then('the open tasks tray is expanded', async function (this: World) {
  await expect(this.page.getByTestId('task-tray')).toHaveAttribute('data-expanded', 'true');
});

When('I collapse the open tasks tray', async function (this: World) {
  const tray = this.page.getByTestId('task-tray');
  if ((await tray.getAttribute('data-expanded')) === 'true') await this.page.getByTestId('task-tray-toggle').click();
  await expect(tray).toHaveAttribute('data-expanded', 'false');
});

Then('the open tasks tray is at most {int} px wide', async function (this: World, px: number) {
  await expect.poll(async () => {
    const w = await this.page.evaluate(() => ({
      box: document.querySelector('[data-testid="task-tray"]')!.getBoundingClientRect().width,
      css: parseFloat(document.documentElement.style.getPropertyValue('--tray-w')),
    }));
    return Math.max(w.box, w.css);
  }).toBeLessThanOrEqual(px);
});

Then('the task list {string} is highlighted in the open tasks tray', async function (this: World, list: string) {
  await expect(trayRow(this, list)).toHaveAttribute('data-flash', 'true');
});

When('I hide where carried-over task lists come from in the settings', async function (this: World) {
  await this.page.goto('/');
  await this.page.getByTestId('settings-button').click();
  const control = this.page.getByTestId('settings-carried-from');
  await expect(control).toHaveAttribute('aria-checked', 'true');
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await control.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
  await this.page.getByTestId('settings-back').click();
});
