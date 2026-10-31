/** One action vocabulary and theme corners (STEPS.md "UI redesign E", feature ui-expressive). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, chooseOption } from './support/ui.js';
import type { World } from './support/world.js';

/** STEPS.md control names → `data-testid`. */
const CONTROLS: Record<string, string> = { 'create button': 'create-button', 'Today button': 'nav-today', 'settings button': 'settings-button', 'filter button': 'filter-button' };
const controlId = (name: string) => {
  const id = CONTROLS[name];
  if (!id) throw new Error(`Unknown control "${name}"`);
  return id;
};

/** The look of every visible button of the page outside dialogs: its testid, drawn background (the Today `.pill` for Today) and whether it shows text. */
async function buttonLooks(w: World, inDialog = false) {
  // the settings are not a calendar view: `settled` waits for one
  if (!(await w.page.getByTestId('settings-view').isVisible())) await w.settled();
  return w.page.evaluate((dialog) => {
    const probe = (tok: string) => { const i = document.createElement('i'); i.style.background = `var(${tok})`; document.body.appendChild(i); const c = getComputedStyle(i).backgroundColor; i.remove(); return c; };
    const primary = [probe('--md-sys-color-primary'), probe('--md-sys-color-primary-container')];
    const alpha = (c: string) => (c.startsWith('rgba') ? Number(c.split(',')[3].replace(')', '')) : c === 'transparent' ? 0 : 1);
    return [...document.querySelectorAll<HTMLElement>('button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && getComputedStyle(b).visibility !== 'hidden' && (dialog ? !!b.closest('[role="dialog"]') : !b.closest('[role="dialog"]'));
    }).map((b) => {
      const drawn = b.querySelector<HTMLElement>('.pill') ?? b;
      const cs = getComputedStyle(drawn);
      return { id: b.dataset.testid ?? '', filled: primary.includes(cs.backgroundColor), alpha: alpha(cs.backgroundColor), blur: cs.backdropFilter, text: (b.innerText ?? '').trim(), label: b.getAttribute('aria-label') ?? b.getAttribute('title') ?? '' };
    });
  }, inDialog);
}

Then('the surface has one filled {string}', async function (this: World, name: string) {
  const id = controlId(name);
  const looks = (await buttonLooks(this)).filter((b) => b.id === id);
  expect(looks.length, `the ${name}`).toBe(1);
  expect(looks[0].filled, `${name} is filled`).toBe(true);
});

Then('every other button of the surface is tonal, outlined or text', async function (this: World) {
  const filled = (await buttonLooks(this)).filter((b) => b.filled).map((b) => b.id);
  expect(filled.sort(), 'filled buttons').toEqual(['create-button', 'nav-today']);
});

Then('the {string} is an icon with the label {string}', async function (this: World, name: string, label: string) {
  const b: Locator = this.page.getByTestId(controlId(name)).first();
  await expect(b).toHaveAttribute('aria-label', label);
  await expect(b.locator('svg').first()).toBeVisible();
  expect((await b.evaluate((el) => (el as HTMLElement).innerText)).trim(), 'no text').toBe('');
});

Then('every icon-only button of the screen has an accessible label', async function (this: World) {
  const bad = (await buttonLooks(this)).filter((b) => !b.text && !b.label);
  expect(bad.map((b) => b.id || '(no testid)'), 'icon-only buttons without a label').toEqual([]);
});

Given('the theme is {string}', async function (this: World, name: string) {
  await this.api.patch('/api/prefs/theme', { preset: name, seasonal: 'off' });
});

Then('the bottom bar, the top bar and every button are drawn with fully round corners', async function (this: World) {
  await this.settled();
  const bad = await this.page.evaluate(() => {
    const round = (el: Element) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius].map(parseFloat);
      return Math.min(...radii) >= Math.min(r.width, r.height) / 2 - 0.5;
    };
    // the controls of the two bars and the create button; the full-width top bar itself is a flat strip in every theme
    const bars = [document.querySelector('[data-testid="bottom-bar"]')].filter((e): e is Element => !!e);
    // the date title is a text button and the + button an M3 rounded square (theme-independent); the icon buttons and view items are round
    const buttons = [...document.querySelectorAll('[data-testid="top-bar"] button, [data-testid="bottom-bar"] button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 1 && !b.classList.contains('sr-only') && !b.matches('[data-testid="period-title"]');
    });
    const bar = document.querySelector('[data-testid="top-bar"]')!;
    const flat = parseFloat(getComputedStyle(bar).borderTopLeftRadius) === 0;
    return [...bars, ...buttons].filter((e) => !round(e) && !(e.matches('[data-testid="nav-today"]') && round(e.querySelector('.pill')!))).map((e) => (e as HTMLElement).dataset.testid ?? e.tagName).concat(flat ? [] : ['top-bar corners']);
  });
  expect(bad, 'not fully round').toEqual([]);
});

Then('the Today button is the only filled button of the top bar', async function (this: World) {
  const inBar = await this.page.evaluate(() => [...document.querySelectorAll('[data-testid="top-bar"] button')].map((b) => b.getAttribute('data-testid')));
  const looks = (await buttonLooks(this)).filter((b) => inBar.includes(b.id || null) && b.alpha > 0);
  expect(looks.map((b) => b.id), 'buttons with a background in the top bar').toEqual(['nav-today']);
  expect(looks[0].filled, 'Today is filled').toBe(true);
});

Then('the top bar icons have no see-through background', async function (this: World) {
  const bad = (await buttonLooks(this)).filter((b) => ['filter-button', 'settings-button', 'nav-today', 'menu-button'].includes(b.id) && ((b.alpha > 0 && b.alpha < 1) || (b.blur && b.blur !== 'none')));
  expect(bad.map((b) => b.id), 'icons over the scene with a glass look').toEqual([]);
});

// --- dialog and settings ----------------------------------------------------------------------------------------------

Then('the dialog has one filled {string}', async function (this: World, name: string) {
  expect(name).toBe('Save button');
  const filled = (await buttonLooks(this, true)).filter((b) => b.filled);
  expect(filled.map((b) => b.text), 'filled buttons of the dialog').toEqual([expect.stringMatching(/^save$/i)]);
});

Then('every other button of the dialog is tonal, outlined or text', async function (this: World) {
  const filled = (await buttonLooks(this, true)).filter((b) => b.filled);
  expect(filled, 'filled buttons of the dialog').toHaveLength(1);
});

Then('no button of the settings screen is filled', async function (this: World) {
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  const filled = (await buttonLooks(this)).filter((b) => b.filled);
  expect(filled.map((b) => b.id || b.label || b.text), 'filled buttons').toEqual([]);
});

// --- overflow menu of a task list card ---------------------------------------------------------------------------------

const card = (w: World, title: string) => w.page.locator(`[data-testid="tasks-item"][data-title="${title}"]`);

When('I open the overflow menu of the task list {string}', async function (this: World, title: string) {
  await card(this, title).getByTestId('tasklist-overflow').click();
  await expect(this.page.getByRole('menu')).toBeVisible();
});

Then('the overflow menu lists {string}', async function (this: World, labels: string) {
  const texts = (await this.page.getByRole('menu').getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
  expect(texts.join(', ')).toBe(labels);
});

Then('the task list {string} shows one overflow button and no other action button', async function (this: World, title: string) {
  const c = card(this, title);
  await expect(c.getByTestId('tasklist-overflow')).toHaveCount(1);
  // besides the overflow button: the chevron, the item controls and Add item; no Edit, Delete or template buttons
  for (const id of ['tasklist-edit', 'tasklist-delete', 'tasklist-save-template', 'tasklist-leave']) await expect(c.getByTestId(id), id).toHaveCount(0);
  await expect(c.locator('footer button')).toHaveCount(1);
});

// --- Open, Canvas and Archive as one button group -----------------------------------------------------------------------

const group = (w: World) => w.page.getByTestId('tasks-view').getByRole('group', { name: 'Tasks' }).first();

Then('the button group shows {string} as one connected group', async function (this: World, labels: string) {
  const g = group(this);
  // allInnerTexts does not wait: the lazy Tasks view may not have rendered the group yet
  await expect(g.getByRole('button')).toHaveCount(labels.split(', ').length);
  expect((await g.getByRole('button').allInnerTexts()).map((t) => t.trim()).join(', ')).toBe(labels);
  // connected: the buttons touch each other inside one rounded container
  const boxes = await g.getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  for (let i = 1; i < boxes.length; i++) expect(Math.abs(boxes[i].left - boxes[i - 1].right), `gap before button ${i + 1}`).toBeLessThanOrEqual(2);
});

Then('exactly one of them is selected', async function (this: World) {
  await expect(group(this).locator('button[aria-pressed="true"]')).toHaveCount(1);
});

When('I press {string} in the button group', async function (this: World, label: string) {
  await group(this).getByRole('button', { name: label, exact: true }).click();
});

Then('the {string} button of the group is selected', async function (this: World, label: string) {
  await expect(group(this).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

// --- the Tasks view's floating toolbar ----------------------------------------------------------------------------------

const TOOLS: Record<string, string> = { Filter: 'tasks-filter-open', Sort: 'tasks-sort-open', Fold: 'tasks-collapse-all' };
const toolbar = (w: World) => w.page.getByTestId('tasks-floating-toolbar');

Then('the floating toolbar offers {string}', async function (this: World, names: string) {
  const want = names.split(', ');
  for (const n of want) await expect(toolbar(this).getByTestId(TOOLS[n]), n).toBeVisible();
  await expect(toolbar(this).getByRole('button')).toHaveCount(want.length);
});

Then('the floating toolbar is beside the create button', async function (this: World) {
  const t = await box(toolbar(this));
  const f = await box(this.page.getByTestId('create-button'));
  expect(Math.abs(t.y + t.height / 2 - (f.y + f.height / 2)), 'same row').toBeLessThanOrEqual(12);
  expect(t.x + t.width <= f.x || f.x + f.width <= t.x, 'side by side').toBe(true);
});

Then('the tools of the floating toolbar are tonal icon buttons with labels', async function (this: World) {
  for (const b of await toolbar(this).getByRole('button').all()) {
    expect(await b.getAttribute('aria-label'), 'label').toBeTruthy();
    expect((await b.innerText()).trim(), 'icon only').toBe('');
  }
  const filled = (await buttonLooks(this)).filter((b) => b.filled).map((b) => b.id);
  expect(filled.sort()).toEqual(['create-button']);
});

When('I press {string} in the floating toolbar', async function (this: World, name: string) {
  await toolbar(this).getByTestId(TOOLS[name]).click();
});

When('I choose {string} as the sort order', async function (this: World, label: string) {
  await chooseOption(this.page.getByTestId('tasks-sort-by'), label);
  await this.page.getByTestId('tasks-sheet-done').click();
  await expect(this.page.getByTestId('tasks-sort-sheet')).toHaveCount(0);
});

Then('the Tasks view lists {string} in that order', async function (this: World, titles: string) {
  const got = await this.page.getByTestId('tasks-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  expect(got.join(', ')).toBe(titles);
});

Then('the floating toolbar is hidden', async function (this: World) {
  await expect(toolbar(this)).toHaveAttribute('data-hidden', 'true');
  await expect.poll(() => toolbar(this).evaluate((el) => el.getBoundingClientRect().top >= innerHeight - 1), { message: 'toolbar out of the viewport' }).toBe(true);
});

Then('the floating toolbar is shown', async function (this: World) {
  await expect(toolbar(this)).toHaveAttribute('data-hidden', 'false');
  await expect.poll(() => toolbar(this).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }), { message: 'toolbar inside the viewport' }).toBe(true);
});
