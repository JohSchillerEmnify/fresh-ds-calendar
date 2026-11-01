/** Task list template steps (STEPS.md "Task list templates", feature tasklist-templates). */
import { expect, type Locator } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { field, fillField, readField, type FieldKind } from './support/forms.js';
import { cellValue, formRows } from './support/tables.js';
import { box, chooseListAction, expectJoined, pathname } from './support/ui.js';
import { Api } from './support/api.js';
import { attr, exactText, tid, type World } from './support/world.js';
import { settingControl } from './support/settings.js';

interface Template { id: string; name: string; items: { title: string }[] }

const TEMPLATE_FIELDS: Record<string, string> = {
  name: 'template-name',
  items: 'template-items',
  estimate: 'template-estimate',
  category: 'template-category',
};
const kindOf = (name: string): FieldKind => (name === 'category' ? 'choice' : 'text');
/** `items` cells are "; "-separated and typed one item per line. */
const typed = (name: string, cell: string) => {
  const v = cellValue(cell);
  return name === 'items' && v ? v.split('; ').join('\n') : v;
};

const saveDialog = (w: World) => w.page.getByTestId('template-save-dialog');
const templateDialog = (w: World) => w.page.getByTestId('template-dialog');
const listDialog = (w: World) => w.page.getByTestId('tasklist-dialog');
const picker = (w: World) => w.page.getByTestId('template-picker');
const pill = (w: World) => listDialog(w).getByTestId('tasklist-from-template');
/** The expanded list's sheet (not a card grown in place over the calendar). */
const sheet = (w: World) => w.page.locator(`${tid('tasklist-expanded')}:not(${attr('data-presentation', 'overlay')})`);
const row = (w: World, name: string) => w.byTestId('template-row', attr('data-name', name));

/** Where the pill was when the picker was opened ("the template menu has grown out of the template pill"). */
const pillBoxes = new WeakMap<World, { x: number; y: number; width: number; height: number }>();

/** Waits until a template sheet was saved (it closes after the request) or refused (its error shows). */
async function settledSheet(sheetLoc: Locator): Promise<void> {
  await expect.poll(async () => !(await sheetLoc.isVisible()) || (await sheetLoc.getByTestId('template-error').isVisible()), { message: 'saved or refused' }).toBe(true);
}

const templates = (w: World) => w.api.get<{ templates: Template[] }>('/api/templates').then((r) => r.templates);
const splitList = (s: string) => s.split(', ').filter(Boolean).map((title) => ({ title }));

// --- fixtures ----------------------------------------------------------------------------------------------------

Given('I have the template {string} with the items {string}', async function (this: World, name: string, items: string) {
  await this.api.post('/api/templates', { name, items: splitList(items) });
});

Given('{string} has the template {string} with the items {string}', async function (this: World, email: string, name: string, items: string) {
  // the page's own session: the test API is not signed in when sign-in is on
  const asPage = new Api(this.page.request);
  expect((await asPage.get<{ email: string | null }>('/api/auth/me')).email).toBe(email);
  await asPage.post('/api/templates', { name, items: splitList(items) });
});

Given(
  'I have the template {string} with the items {string}, the estimate {int} minutes and the category {string}',
  async function (this: World, name: string, items: string, minutes: number, category: string) {
    await this.api.post('/api/templates', { name, items: splitList(items), estimateMinutes: minutes, categoryId: await this.api.categoryId(category) });
  },
);

// --- saving a list as a template ---------------------------------------------------------------------------------

When('I save the task list as a template', async function (this: World) {
  await chooseListAction(this.page, sheet(this), 'tasklist-save-template');
  await expect(saveDialog(this)).toBeVisible();
});

Then('the footer of the expanded task list shows {string}', async function (this: World, labels: string) {
  const texts = (await sheet(this).locator('footer button').allInnerTexts()).map((t) => t.trim());
  expect(texts.join(', ')).toBe(labels);
});

Then('the overflow menu of the expanded task list lists {string}', async function (this: World, labels: string) {
  await sheet(this).getByTestId('tasklist-overflow').click();
  const texts = (await this.page.getByRole('menu').getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
  expect(texts.join(', ')).toBe(labels);
  await this.page.keyboard.press('Escape');
  await expect(this.page.getByRole('menu')).toHaveCount(0);
});

Then('the template dialog previews the items {string}', async function (this: World, items: string) {
  await expectJoined(saveDialog(this).getByTestId('template-save-item'), items);
});

Then('the template name field shows {string}', async function (this: World, name: string) {
  await expect(saveDialog(this).getByTestId('template-save-name')).toHaveValue(name);
});

When('I enter the template name {string}', async function (this: World, name: string) {
  await saveDialog(this).getByTestId('template-save-name').fill(name);
});

When('I confirm the template', async function (this: World) {
  await saveDialog(this).getByTestId('template-save-confirm').click();
  await settledSheet(saveDialog(this));
});

When('I turn on {string} in the task list form', async function (this: World, label: string) {
  expect(label).toBe('Also save as template');
  const sw = listDialog(this).getByTestId('tasklist-save-as-template');
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

// --- the template pill and menu in the new task list form --------------------------------------------------------

When('I open the template picker', async function (this: World) {
  // the new dialog slides in: the pill is measured once the sheet is at rest, as a finger would tap it
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await box(pill(this)));
    const still = now === last;
    last = now;
    return still;
  }, { intervals: [100] }).toBe(true);
  pillBoxes.set(this, await box(pill(this)));
  await pill(this).click();
  await expect(picker(this)).toBeVisible();
});

Then('the template pill shows {string}', async function (this: World, label: string) {
  await expect(listDialog(this).getByTestId('tasklist-from-template-label')).toHaveText(exactText(label));
});

Then('the template menu has grown out of the template pill', async function (this: World) {
  const before = pillBoxes.get(this);
  expect(before, 'the picker was opened by "I open the template picker"').toBeTruthy();
  // at rest: the grow animation has finished
  await expect.poll(() => picker(this).evaluate((el) => el.getAnimations().length)).toBe(0);
  const menu = await box(picker(this));
  expect(Math.abs(menu.y - before!.y), 'top edge where the pill was').toBeLessThanOrEqual(4);
  expect(Math.abs(menu.x + menu.width - (before!.x + before!.width)), 'right edge where the pill was').toBeLessThanOrEqual(4);
  expect(menu.height).toBeGreaterThan(before!.height);
  // the pill becomes the panel's top row (owner's canvas, variant 4D)
  const head = await box(picker(this).getByTestId('template-picker-header'));
  expect(Math.abs(head.y - before!.y), 'header pill top where the pill was').toBeLessThanOrEqual(4);
  expect(Math.abs(head.x + head.width - (before!.x + before!.width)), 'header pill right edge where the pill was').toBeLessThanOrEqual(4);
  expect(Math.abs(head.height - before!.height), 'header pill as tall as the pill').toBeLessThanOrEqual(2);
  await expect(pill(this)).toHaveCSS('visibility', 'hidden');
});

Then('the template menu shows:', async function (this: World, table: DataTable) {
  const want = table.raw().map((r) => `${r[0].trim()} | ${r[1].trim()}`).join('\n');
  await expect.poll(async () => {
    const items = picker(this).getByTestId('template-picker-item');
    const out: string[] = [];
    for (let i = 0; i < (await items.count()); i++) {
      const it = items.nth(i);
      out.push(`${(await it.getByTestId('template-picker-name').innerText()).trim()} | ${(await it.getByTestId('template-picker-details').innerText()).trim()}`);
    }
    return out.join('\n');
  }).toBe(want);
});

Then('the template menu ends with {string} below a divider', async function (this: World, label: string) {
  const last = picker(this).locator('.content > :last-child');
  await expect(last).toHaveAttribute('data-testid', 'template-picker-manage');
  await expect(last).toHaveText(exactText(label));
  await expect(picker(this).locator(`${tid('template-picker-divider')} + ${tid('template-picker-manage')}`)).toHaveCount(1);
});

Then('the template picker says {string}', async function (this: World, text: string) {
  await expect(picker(this).getByTestId('template-picker-empty')).toHaveText(exactText(text));
});

When('I choose the template {string}', async function (this: World, name: string) {
  if (!(await picker(this).isVisible())) {
    await pill(this).click();
    await expect(picker(this)).toBeVisible();
  }
  await picker(this).getByTestId('template-picker-item').and(this.page.locator(attr('data-name', name))).click();
  await expect(picker(this)).toBeHidden();
});

When('I choose {string} in the template picker', async function (this: World, label: string) {
  expect(label).toBe('Manage templates');
  await picker(this).getByTestId('template-picker-manage').click();
});

When('I create a task list from the template {string} on {date}', async function (this: World, name: string, date: string) {
  await this.page.goto(`/day/${date}`);
  await this.settled();
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-tasklist').click();
  await expect(listDialog(this)).toBeVisible();
  await pill(this).click();
  await picker(this).getByTestId('template-picker-item').and(this.page.locator(attr('data-name', name))).click();
  await expect(picker(this)).toBeHidden();
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
  await listDialog(this).getByTestId('tasklist-save').click();
  expect((await saved).status(), 'list created').toBe(201);
  await expect(listDialog(this)).toBeHidden();
});

// --- Settings › Task lists › Templates ---------------------------------------------------------------------------

When('I open the templates in the settings', async function (this: World) {
  if (await this.page.getByTestId('templates-page').isVisible()) return;
  // a scenario may start on a blank page: load the app first
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/day/2026-10-12');
    await this.calendarShown();
  }
  // an open sheet (the list a template was saved from) covers the top bar: a person closes it first
  if (await this.page.getByTestId('sheet-scrim').isVisible()) {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByTestId('sheet-scrim')).toHaveCount(0);
  }
  if (!(await this.page.getByTestId('settings-view').isVisible())) await this.page.getByTestId('settings-button').click();
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  await (await settingControl(this, 'settings-templates')).click();
  await expect(this.page.getByTestId('templates-page')).toBeVisible();
});

Then('the settings page {string} is shown', async function (this: World, page: string) {
  expect(page).toBe('Templates');
  await expect(this.page.getByTestId('templates-page')).toBeVisible();
  expect(pathname(this.page)).toBe('/settings/templates');
});

Then('the templates page lists {string}', async function (this: World, names: string) {
  await expectJoined(this.page.getByTestId('template-row'), names, 'data-name');
});

Then('the templates page says {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('templates-empty')).toHaveText(exactText(text));
});

Then('the templates page offers {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId('templates-new')).toHaveText(exactText(label));
});

When('I start a new template', async function (this: World) {
  await this.page.getByTestId('templates-new').click();
  await expect(templateDialog(this)).toBeVisible();
});

Then('the template sheet is titled {string}', async function (this: World, title: string) {
  await expect(templateDialog(this).getByTestId('template-dialog-title')).toHaveText(exactText(title));
});

When('I open the template {string}', async function (this: World, name: string) {
  await row(this, name).getByTestId('template-open').click();
  await expect(templateDialog(this)).toBeVisible();
});

When('I fill in the template form with:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    await fillField(field(templateDialog(this), TEMPLATE_FIELDS, name), kindOf(name), typed(name, cell));
  }
});

Then('the template form shows:', async function (this: World, table: DataTable) {
  for (const [name, cell] of formRows(table)) {
    const control = field(templateDialog(this), TEMPLATE_FIELDS, name);
    await expect.poll(() => readField(control, kindOf(name)), { message: `template field "${name}"` }).toBe(typed(name, cell));
  }
});

Then('the template form has no date, time, repeat or reminder fields', async function (this: World) {
  const d = templateDialog(this);
  await expect(d).toBeVisible();
  for (const id of ['tasklist-date', 'tasklist-time', 'tasklist-repeat', 'tasklist-reminders']) await expect(d.getByTestId(id)).toHaveCount(0);
  await expect(d.locator('input[type="date"], input[type="time"]')).toHaveCount(0);
});

When('I save the template', async function (this: World) {
  await templateDialog(this).getByTestId('template-save').click();
  await settledSheet(templateDialog(this));
});

When('I cancel the template dialog', async function (this: World) {
  await templateDialog(this).getByTestId('template-cancel').click();
  await expect(templateDialog(this)).toBeHidden();
});

When('I delete the template {string}', async function (this: World, name: string) {
  await row(this, name).getByTestId('template-delete').click();
  await expect(this.page.getByTestId('undo-snackbar')).toBeVisible();
});

Then('the template dialog shows the error {string}', async function (this: World, message: string) {
  const error = saveDialog(this).getByTestId('template-error').or(templateDialog(this).getByTestId('template-error'));
  await expect(error).toHaveText(exactText(message));
});

// --- what the server keeps -----------------------------------------------------------------------------------------

Then('my templates are {string}', async function (this: World, names: string) {
  await expect.poll(async () => (await templates(this)).map((x) => x.name).join(', ')).toBe(names);
});

Then('the template {string} has the items {string}', async function (this: World, name: string, items: string) {
  await expect.poll(async () => (await templates(this)).find((x) => x.name === name)?.items.map((i) => i.title).join(', ') ?? null).toBe(items);
});

Then('I have no templates', async function (this: World) {
  await expect.poll(async () => (await templates(this)).length).toBe(0);
});
