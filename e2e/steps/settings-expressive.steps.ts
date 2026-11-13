/** Settings in Material 3 Expressive (STEPS.md "Settings in Expressive", features settings-expressive, drive-backup-settings). */
import { expect, type Locator, type Page } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { expectJoined } from './support/ui.js';
import type { World } from './support/world.js';

const view = (w: World) => w.page.getByTestId('settings-view');
const section = (w: World, name: string) => w.page.locator(`[data-testid="settings-section"][data-section="${name}"]`);
const row = (w: World, name: string) => w.page.locator(`[data-testid="settings-row"][data-setting="${name}"]`);
const menu = (w: World) => w.page.getByRole('listbox');
const px = (v: string) => Number.parseFloat(v);
const list = (s: string) => s.split(', ');

/** The computed colour of a design token, as the browser prints a drawn background. */
const token = (page: Page, name: string) => page.evaluate((n) => {
  const i = document.createElement('i');
  i.style.background = `var(${n})`;
  document.body.appendChild(i);
  const c = getComputedStyle(i).backgroundColor;
  i.remove();
  return c;
}, name);
const style = (loc: Locator, prop: string) => loc.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

/** The settings bar's height without the top safe area. */
async function barHeight(w: World) {
  const bar = w.page.getByTestId('settings-bar');
  await expect(bar).toBeVisible();
  return (await bar.boundingBox())!.height;
}

Then('the settings title {string} is bold at {int} px in a {int} px bar', async function (this: World, title: string, size: number, height: number) {
  const h1 = this.page.getByTestId('settings-title');
  await expect(h1).toHaveText(title);
  expect(px(await style(h1, 'font-size'))).toBe(size);
  expect(Number(await style(h1, 'font-weight'))).toBeGreaterThanOrEqual(700);
  expect(Math.abs((await barHeight(this)) - height)).toBeLessThanOrEqual(1);
});

Then('the settings Back button is a tonal round icon button', async function (this: World) {
  const back = this.page.getByTestId('settings-back');
  await expect(back).toBeVisible();
  expect(await style(back, 'background-color')).toBe(await token(this.page, '--md-sys-color-secondary-container'));
  const b = (await back.boundingBox())!;
  expect(px(await style(back, 'border-top-left-radius'))).toBeGreaterThanOrEqual(b.height / 2);
});

Then('the settings bar shows no scene', async function (this: World) {
  await expect(this.page.getByTestId('settings-bar')).toBeVisible();
  await expect(this.page.getByTestId('settings-bar').getByTestId('top-bar-background')).toHaveCount(0);
});

Then('the settings bar is {int} px high', async function (this: World, height: number) {
  expect(Math.abs((await barHeight(this)) - height)).toBeLessThanOrEqual(1);
});

Then('the section {string} is one rounded container', async function (this: World, name: string) {
  const s = section(this, name);
  await expect(s).toBeVisible();
  expect(px(await style(s, 'border-top-left-radius'))).toBeGreaterThanOrEqual(28);
  expect(await style(s, 'background-color')).toBe(await token(this.page, '--md-sys-color-surface-container'));
});

Then('the rows of the section {string} are {int} px high at least', async function (this: World, name: string, h: number) {
  const rows = section(this, name).getByTestId('settings-row');
  await expect(rows.first()).toBeVisible();
  const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const x of heights) expect(x).toBeGreaterThanOrEqual(h - 1);
});

Then('the settings page shows the section {string}', async function (this: World, name: string) {
  await expect(section(this, name)).toBeVisible();
});

Then('the settings page does not show the section {string}', async function (this: World, name: string) {
  await expect(section(this, name)).toHaveCount(0);
});

Then('the section containers are another tone than the page', async function (this: World) {
  const sec = this.page.getByTestId('settings-section').first();
  await expect(sec).toBeVisible();
  expect(await style(sec, 'background-color')).not.toBe(await style(view(this), 'background-color'));
});

Then('the settings groups {string} are items of one rounded container', async function (this: World, names: string) {
  const box = this.page.getByTestId('settings-groups');
  await expect(box).toBeVisible();
  expect(px(await style(box, 'border-top-left-radius'))).toBeGreaterThanOrEqual(28);
  await expectJoined(box.getByTestId('settings-group'), names, 'data-group');
});

Then('every settings group shows a 40 px tonal icon', async function (this: World) {
  const icons = this.page.getByTestId('settings-group-icon');
  await expect(icons.first()).toBeVisible();
  const tonal = await token(this.page, '--md-sys-color-secondary-container');
  const looks = await icons.evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, bg: getComputedStyle(e).backgroundColor })));
  expect(looks).toHaveLength(9);
  for (const l of looks) expect(l).toEqual({ w: 40, h: 40, bg: tonal });
});

Then('the settings search bar is full round and {int} px high', async function (this: World, h: number) {
  const bar = this.page.getByTestId('settings-search-bar');
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height).toBe(h);
  expect(px(await style(bar, 'border-top-left-radius'))).toBeGreaterThanOrEqual(h / 2);
});

/** A button of the open settings page by its visible name. */
const button = (w: World, name: string) => w.page.getByTestId('settings-view').getByRole('button', { name, exact: true });

Then('the button {string} in the settings is a tonal button', async function (this: World, name: string) {
  const b = button(this, name);
  await expect(b).toBeVisible();
  expect(await style(b, 'background-color')).toBe(await token(this.page, '--md-sys-color-secondary-container'));
  expect(px(await style(b, 'border-top-left-radius'))).toBeGreaterThanOrEqual(20);
});

/** The buttons of a connected group touch: at most 4 px between the drawn neighbours (tap borders left out), side by side or stacked. */
async function expectConnected(group: Locator, labels: string[]) {
  const buttons = group.getByRole('button');
  await expect(buttons).toHaveCount(labels.length);
  expect((await buttons.allInnerTexts()).map((t) => t.trim())).toEqual(labels);
  const boxes = await buttons.evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect(), left = r.left + e.clientLeft, top = r.top + e.clientTop;
    return { left, top, right: left + e.clientWidth, bottom: top + e.clientHeight };
  }));
  for (let i = 1; i < boxes.length; i++) {
    const side = Math.abs(boxes[i].left - boxes[i - 1].right);
    const stacked = Math.abs(boxes[i].top - boxes[i - 1].bottom);
    expect(Math.min(side, stacked), `gap before button ${i + 1}`).toBeLessThanOrEqual(4);
  }
}

Then('{string} offers {string} as a connected button group', async function (this: World, name: string, labels: string) {
  await expectConnected(row(this, name).getByRole('group'), list(labels));
});

Then('{string} and {string} are one connected button group in the settings', async function (this: World, a: string, b: string) {
  await expectConnected(this.page.getByTestId('settings-backup-actions'), [a, b]);
});

/** Every option of a group shows its whole label: nothing cut at the side, no word broken into letters. */
async function expectWholeLabels(group: Locator) {
  const labels = group.locator('.lbl');
  await expect(labels.first()).toBeVisible();
  const bad = await labels.evaluateAll((els) => els.flatMap((e) => {
    const lbl = e as HTMLElement;
    const own = lbl.closest('button')!;
    const lineHeight = Number.parseFloat(getComputedStyle(lbl).lineHeight) || 20;
    // a label of whole words that wrap is fine; one word per line or a cut label is not
    const words = (lbl.textContent ?? '').trim().split(/\s+/).length;
    const lines = Math.round(lbl.getBoundingClientRect().height / lineHeight);
    return [...(lbl.scrollWidth > own.clientWidth + 1 ? [`${lbl.textContent} is cut`] : []), ...(lines > words ? [`${lbl.textContent} is broken into letters`] : [])];
  }));
  expect(bad).toEqual([]);
}

Then('the options of {string} show their full labels on whole lines', async function (this: World, name: string) {
  await expectWholeLabels(row(this, name).getByRole('group'));
});

Then('the options of the theme setting {string} show their full labels on whole lines', async function (this: World, name: string) {
  await expectWholeLabels(this.page.getByTestId('theme-view').getByRole('group', { name, exact: true }));
});

Then('the row {string} shows a grey value and a chevron', async function (this: World, name: string) {
  const r = row(this, name);
  const val = r.locator('.val');
  await expect(val).toBeVisible();
  await expect(r.locator('.chev')).toBeVisible();
  const grey = await this.page.evaluate(() => { const i = document.createElement('i'); i.style.color = 'var(--md-sys-color-on-surface-variant)'; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; });
  expect(await style(val, 'color')).toBe(grey);
});

Then('the value of {string} is a tonal button', async function (this: World, name: string) {
  const b = row(this, name).getByRole('button');
  await expect(b).toBeVisible();
  expect(await style(b, 'background-color')).toBe(await token(this.page, '--md-sys-color-secondary-container'));
});

/** The field of a settings row: an outlined button that opens a menu. */
const field = (w: World, name: string) => row(w, name).locator('button[aria-haspopup="listbox"]');

Then('{string} is an outlined field showing {string}', async function (this: World, name: string, value: string) {
  const f = field(this, name);
  await expect(f).toBeVisible();
  await expect(f.locator('.val')).toHaveText(value);
  expect(px(await style(f, 'border-top-width'))).toBeGreaterThanOrEqual(1);
  expect(px(await style(f, 'border-top-left-radius'))).toBeGreaterThanOrEqual(12);
});

When('I open the field {string}', async function (this: World, name: string) {
  await field(this, name).click();
  await expect(menu(this)).toBeVisible();
});

Then('the menu lists {string} and marks {string} as chosen', async function (this: World, labels: string, chosen: string) {
  await expectJoined(menu(this).getByRole('option'), labels);
  await expect(menu(this).locator('[role="option"][aria-selected="true"]')).toHaveText(chosen);
});

When('I choose {string} in the menu', async function (this: World, label: string) {
  await menu(this).getByRole('option', { name: label, exact: true }).click();
});

Then('the menu is closed', async function (this: World) {
  await expect(menu(this)).toHaveCount(0);
});

Then('the menu stays inside the screen', async function (this: World) {
  const b = (await menu(this).boundingBox())!;
  const vp = this.page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
});
