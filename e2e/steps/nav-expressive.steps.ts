/** Bottom bar sizes, hide-on-scroll and the side menu (STEPS.md "UI redesign E", feature nav-expressive). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, chooseOption, viewport } from './support/ui.js';
import type { World } from './support/world.js';

const SIZES: Record<string, 'expressive' | 'compact'> = { Expressive: 'expressive', Compact: 'compact' };
const sizeValue = (label: string) => {
  const v = SIZES[label];
  if (!v) throw new Error(`Unknown bar size "${label}"`);
  return v;
};

const bar = (w: World) => w.page.getByTestId('bottom-bar');
const items = (w: World) => bar(w).getByRole('tab');
/** The view-switch labels' visible width: a label folded away is clipped to 1 px. */
const labelShown = (item: Locator) => item.locator('.lbl').evaluate((el) => el.getBoundingClientRect().width > 4);

/** Saves a settings choice and waits for the answer. */
async function chooseSize(w: World, testid: string, label: string) {
  sizeValue(label);
  const saved = w.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(w.page.getByTestId(testid), label);
  expect((await saved).status(), 'size saved').toBe(200);
}

Given('the bottom bar size is set to {string}', async function (this: World, label: string) {
  await this.api.patch('/api/prefs', { bottomBarSize: sizeValue(label) });
});

When('I choose {string} as the bottom bar size', async function (this: World, label: string) {
  await chooseSize(this, 'settings-bottom-bar-size', label);
});

Then('the bottom bar size {string} is the default', async function (this: World, label: string) {
  expect((await this.api.get<{ bottomBarSize: string }>('/api/prefs')).bottomBarSize, 'nothing chosen').toBe('auto');
  await expect(bar(this)).toHaveAttribute('data-size', sizeValue(label));
});

Then('the bottom bar floats above the calendar', async function (this: World) {
  await expect(bar(this)).toBeVisible();
  const { position, bottom, left } = await bar(this).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { position: getComputedStyle(el).position, bottom: innerHeight - r.bottom, left: r.left };
  });
  expect(position, 'drawn over the calendar').toBe('fixed');
  expect(bottom, 'a gap below the bar').toBeGreaterThan(0);
  expect(left, 'a gap left of the bar').toBeGreaterThan(0);
});

Then('the bottom bar is {int} pixels tall', async function (this: World, px: number) {
  await expect.poll(() => bar(this).evaluate((el) => Math.round(el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingBottom))), { message: 'bottom bar height' }).toBe(px);
});

Then('every item of the bottom bar shows an icon and a label', async function (this: World) {
  const n = await items(this).count();
  expect(n, 'items').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(items(this).nth(i).locator('svg')).toBeVisible();
    expect(await labelShown(items(this).nth(i)), `label of item ${i + 1}`).toBe(true);
  }
});

Then('only the open view of the bottom bar shows a label', async function (this: World) {
  const n = await items(this).count();
  let shown = 0;
  for (let i = 0; i < n; i++) {
    const it = items(this).nth(i);
    const open = (await it.getAttribute('aria-selected')) === 'true';
    const has = await labelShown(it);
    expect(has, `label of item ${i + 1} (open: ${open})`).toBe(open);
    if (has) shown++;
  }
  expect(shown, 'labelled items').toBe(1);
});

Then('the create button is beside the bottom bar', async function (this: World) {
  const [f, b] = [await box(this.page.getByTestId('create-button')), await box(bar(this))];
  expect(f.y < b.y + b.height && f.y + f.height > b.y, 'overlap vertically').toBe(true);
  expect(f.x >= b.x + b.width - 1 || f.x + f.width <= b.x + 1, 'no overlap sideways').toBe(true);
});

Then('the settings offer no rail size', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  await expect(this.page.locator('[data-testid*="rail-size"]')).toHaveCount(0);
  await this.page.getByTestId('settings-back').click();
});

// --- hiding on scroll -------------------------------------------------------------------------------------------------

/** Turns the wheel over the calendar in steps, like a person's flick. */
async function wheel(w: World, dy: number) {
  const area = w.page.locator('[data-scroll-area]').first();
  const b = await box(area);
  await w.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 60));
  for (let i = 0; i < steps; i++) {
    await w.page.mouse.wheel(0, dy / steps);
    await w.page.waitForTimeout(30);
  }
}

When('I scroll the calendar down by {int} pixels', async function (this: World, px: number) {
  await wheel(this, px);
});

When('I scroll the calendar up by {int} pixels', async function (this: World, px: number) {
  await wheel(this, -px);
});

Then('the bottom bar is hidden', async function (this: World) {
  await expect(bar(this)).toHaveAttribute('data-hidden', 'true');
  await expect.poll(() => bar(this).evaluate((el) => el.getBoundingClientRect().top >= innerHeight - 1), { message: 'bar out of the viewport' }).toBe(true);
});

Then('the bottom bar is shown', async function (this: World) {
  await expect(bar(this)).toHaveAttribute('data-hidden', 'false');
  await expect.poll(() => bar(this).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }), { message: 'bar inside the viewport' }).toBe(true);
});

Then('the create button is shown', async function (this: World) {
  const b = await box(this.page.getByTestId('create-button'));
  const v = viewport(this.page);
  expect(b.y >= 0 && b.y + b.height <= v.height && b.x >= 0 && b.x + b.width <= v.width, 'inside the viewport').toBe(true);
});

Then('the add button covers no hour of the time grid', async function (this: World) {
  const fab = await box(this.page.getByTestId('create-button'));
  // the last hour's slot of every column, as scrolled to the end
  const slots = this.page.locator('[data-testid="time-slot"][data-hour="23"]');
  await expect(slots.first()).toBeVisible();
  const b = await box(slots.first());
  const overlap = fab.x < b.x + b.width && fab.x + fab.width > b.x && fab.y < b.y + b.height && fab.y + fab.height > b.y;
  expect(overlap, 'the + button over the 23:00 slot').toBe(false);
});

// --- side menu ----------------------------------------------------------------------------------------------------------

const menu = (w: World) => w.page.getByTestId('side-menu');

Then('the menu button is on the {string} side of the top bar', async function (this: World, side: string) {
  await expect.poll(async () => {
    const [m, t] = [await box(this.page.getByTestId('menu-button')), await box(this.page.getByTestId('top-bar'))];
    return m.x + m.width / 2 < t.x + t.width / 2 ? 'left' : 'right';
  }).toBe(side);
});

When('I open the side menu', async function (this: World) {
  await this.page.getByTestId('menu-button').click();
  await expect(menu(this)).toBeVisible();
  await expect(menu(this)).toHaveAttribute('data-open', 'true');
});

When('I close the side menu', async function (this: World) {
  await this.page.keyboard.press('Escape');
  await expect(menu(this)).toHaveCount(0);
});

Then('the side menu lists {string}', async function (this: World, list: string) {
  const labels = await menu(this).locator('[data-testid^="side-menu-view-"]').allInnerTexts();
  expect(labels.map((l) => l.trim()).join(', ')).toBe(list);
});

Then('the side menu has the {string} entry at its bottom', async function (this: World, name: string) {
  const entry = this.page.getByTestId('side-menu-settings');
  await expect(entry).toHaveText(name);
  const [e, p] = [await box(entry), await box(menu(this))];
  expect(p.y + p.height - (e.y + e.height), 'room below the entry').toBeLessThan(40 + 34);
  const others = await menu(this).locator('[data-testid^="side-menu-view-"], [data-testid="side-menu-calendar"]').evaluateAll((els) => Math.max(...els.map((el) => el.getBoundingClientRect().bottom)));
  expect(e.y, 'below every other entry').toBeGreaterThanOrEqual(others);
});

When('I choose {string} in the side menu', async function (this: World, name: string) {
  await menu(this).locator('[data-testid^="side-menu-view-"]').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).click();
});

Then('the side menu is closed', async function (this: World) {
  await expect(menu(this)).toHaveCount(0);
});

Then('the side menu shows the calendars {string} with a colour checkbox each', async function (this: World, list: string) {
  const rows = menu(this).getByTestId('side-menu-calendar');
  await expect.poll(async () => (await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))).join(', ')).toBe(list);
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const colour = await rows.nth(i).locator('input[type="checkbox"]').evaluate((el) => getComputedStyle(el).accentColor);
    expect(colour, `colour of the calendar ${i + 1}`).not.toBe('auto');
  }
});

When('I untick the calendar {string} in the side menu', async function (this: World, name: string) {
  await menu(this).locator(`[data-testid="side-menu-calendar"][data-name="${name}"] input`).uncheck();
});

Then('the top bar has no filter button and no settings button', async function (this: World) {
  await expect(this.page.getByTestId('top-bar')).toBeVisible();
  await expect(this.page.getByTestId('filter-button')).toHaveCount(0);
  await expect(this.page.getByTestId('settings-button')).toHaveCount(0);
});

Then('the top bar has no filter button', async function (this: World) {
  await expect(this.page.getByTestId('top-bar')).toBeVisible();
  await expect(this.page.getByTestId('filter-button')).toHaveCount(0);
});
