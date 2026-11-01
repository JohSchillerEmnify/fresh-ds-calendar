/** Header layout steps (STEPS.md "Header layout"): the two layouts, their hit areas, the left-handed mirror and the sync icon. */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, hitAreaMisses, isTouchScreen } from './support/ui.js';
import type { World } from './support/world.js';

/** The settings labels of the layouts and their pref values. */
const LAYOUTS: Record<string, 'two-rows' | 'one-row'> = { 'Two rows': 'two-rows', 'One row': 'one-row' };
const layoutValue = (label: string) => {
  const v = LAYOUTS[label];
  if (!v) throw new Error(`Unknown header layout "${label}"`);
  return v;
};

const bar = (w: World) => w.page.getByTestId('top-bar');
const title = (w: World) => w.page.getByTestId('period-title');
const titleText = (w: World) => title(w).locator('.t');
const chevron = (w: World) => title(w).locator('svg');
const today = (w: World) => w.page.getByTestId('nav-today');
const syncIcon = (w: World) => w.page.getByTestId('sync-status').first();

Given('the header layout is set to {string}', async function (this: World, label: string) {
  await this.api.patch('/api/prefs', { headerLayout: layoutValue(label) });
});

/** Vertical centre of a visible element. */
const middle = async (loc: Locator) => { const b = await box(loc); return b.y + b.height / 2; };

Then('the top bar is in one row', async function (this: World) {
  // the ‹ › arrows only where shown (desktop with a mouse; touch screens have none)
  await expect(today(this)).toBeVisible();
  const ids = ['period-title', 'nav-today', 'settings-button'];
  if (!(await isTouchScreen(this.page))) ids.push('nav-prev', 'nav-next');
  await expect.poll(async () => {
    const ys = await Promise.all(ids.map((id) => middle(this.page.getByTestId(id).first())));
    return Math.round(Math.max(...ys) - Math.min(...ys));
  }, { message: 'spread of the controls\' vertical centres' }).toBeLessThanOrEqual(6);
});

Then('the top bar is in two rows', async function (this: World) {
  // Expressive: one row of controls over the full scene, the scene's strip below it (owner-approved mockups, feature header-expressive)
  await expect(today(this)).toBeVisible();
  await expect.poll(() => bar(this).evaluate((el) => el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingTop)), { message: 'top bar height' }).toBeGreaterThanOrEqual(80);
});

Then('the top bar is at most {int} pixels tall', async function (this: World, px: number) {
  await expect.poll(() => bar(this).evaluate((el) => el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingTop)), { message: 'top bar height' })
    .toBeLessThanOrEqual(px + 1);
});

Then('the period title is not cut short', async function (this: World) {
  await expect(titleText(this)).toBeVisible();
  await expect.poll(() => titleText(this).evaluate((el) => el.scrollWidth - el.clientWidth), { message: 'title text cut by (px)' }).toBeLessThanOrEqual(0);
});

Then("the period title's font size is {int} pixels", async function (this: World, px: number) {
  await expect(titleText(this)).toHaveCSS('font-size', `${px}px`);
});

Then("the period title's chevron is shown", async function (this: World) {
  await expect(chevron(this)).toBeVisible();
});

Then('the top bar shows no arrows', async function (this: World) {
  await expect(today(this)).toBeVisible();
  for (const id of ['nav-prev', 'nav-next']) {
    // a view without arrows (the Labs timeline) has none at all
    if (!(await bar(this).getByTestId(id).count())) continue;
    const b = await bar(this).getByTestId(id).boundingBox();
    expect(!b || (b.width <= 1 && b.height <= 1), `${id} takes no room`).toBe(true);
  }
});

Then('the top bar shows the arrows', async function (this: World) {
  for (const id of ['nav-prev', 'nav-next']) await expect(bar(this).getByTestId(id)).toBeVisible();
  expect((await bar(this).getByTestId('nav-prev').boundingBox())!.width).toBeGreaterThan(24);
});

Then('a screen reader finds the buttons {string} and {string} in the top bar, off screen', async function (this: World, prev: string, next: string) {
  for (const name of [prev, next]) {
    const b = bar(this).getByRole('button', { name, exact: true });
    await expect(b).toHaveCount(1);
    await b.focus();
    await expect(b).toBeFocused();
    const box = await b.boundingBox();
    expect(box!.width <= 1 && box!.height <= 1, `${name} is not visible on screen`).toBe(true);
    expect(await b.evaluate((el) => getComputedStyle(el).position), `${name} takes no layout space`).toBe('absolute');
  }
});

When('a keyboard user activates {string} in the top bar', async function (this: World, name: string) {
  await bar(this).getByRole('button', { name, exact: true }).focus();
  await this.page.keyboard.press('Enter');
});

Then('the Today button is an icon with the label {string}', async function (this: World, label: string) {
  await expect(today(this)).toHaveAttribute('aria-label', label);
  await expect(today(this).locator('svg')).toBeVisible();
  await expect.poll(() => today(this).evaluate((el) => (el as HTMLElement).innerText.trim())).toBe('');
});

Then('the Today button shows the word {string}', async function (this: World, word: string) {
  await expect.poll(() => today(this).evaluate((el) => (el as HTMLElement).innerText.trim())).toBe(word);
});

/** Every visible button of the top bar whose hit area misses W x H, with where (STEPS.md: edge midpoints). */
async function buttonMisses(w: World, width: number, height: number, which: 'all' | 'not-plant' | 'plant'): Promise<Record<string, string[]>> {
  await w.settled();
  await expect(title(w).or(w.page.getByTestId('settings-button')).first()).toBeVisible();
  const out: Record<string, string[]> = {};
  const buttons = which === 'plant' ? w.page.getByTestId('plant-button') : bar(w).locator('button');
  const n = await buttons.count();
  if (which === 'plant') expect(n, 'the plant button').toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    // the sr-only period arrows of a touch screen are not on screen
    if (!(await b.isVisible()) || (await b.evaluate((el) => el.classList.contains('sr-only')))) continue;
    const id = (await b.getAttribute('data-testid')) ?? `button ${i + 1}`;
    if (which === 'not-plant' && id === 'plant-button') continue;
    const miss = await hitAreaMisses(b, width, height);
    if (miss.length) out[id] = miss;
  }
  return out;
}

Then("the top bar's buttons are at least {int} by {int} pixels", async function (this: World, width: number, height: number) {
  expect(await buttonMisses(this, width, height, 'all'), 'buttons whose hit area is too small').toEqual({});
});

Then("the top bar's buttons other than the plant are at least {int} by {int} pixels", async function (this: World, width: number, height: number) {
  expect(await buttonMisses(this, width, height, 'not-plant'), 'buttons whose hit area is too small').toEqual({});
});

Then("the plant's tap area is at least {int} by {int} pixels", async function (this: World, width: number, height: number) {
  expect(await buttonMisses(this, width, height, 'plant'), 'the plant\'s tap area').toEqual({});
});

// --- left-handed mirror (owner, 2026-10-26) ---------------------------------------------------------------------------

/** The controls compared between the right- and left-handed bar. */
const MIRRORED: Record<string, string> = {
  title: '[data-testid=period-title]', 'title text': '[data-testid=period-title] .t', chevron: '[data-testid=period-title] svg',
  Today: '[data-testid=nav-today]',
  flame: '[data-testid=streak-flame]', plant: '[data-testid=plant-button]', sync: '[data-testid=sync-status]',
  filter: '[data-testid=filter-button]', settings: '[data-testid=settings-button]',
};

/** The visible controls' boxes relative to the top bar, and the bar's width. */
async function controlBoxes(w: World) {
  await w.settled();
  await expect(w.page.getByTestId('leading-widgets')).toHaveAttribute('data-ready', 'true');
  return bar(w).evaluate((root, sels) => {
    const b = root.getBoundingClientRect();
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [name, sel] of Object.entries(sels)) {
      const el = root.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      boxes[name] = { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
    }
    return { width: b.width, boxes };
  }, MIRRORED);
}

Given('the sync indicator is on', async function (this: World) {
  await this.api.patch('/api/prefs', { syncIndicator: true });
});

When("I note where the top bar's controls are", async function (this: World) {
  this.topBarBoxes = await controlBoxes(this);
});

When('I turn on left-handed mode', async function (this: World) {
  await this.api.patch('/api/prefs', { leftHanded: true });
  await this.page.reload();
  await this.calendarShown();
  await expect(this.page.locator('html')).toHaveAttribute('data-hand', 'left');
});

Then('every control of the top bar is at the mirror image of where it was, within {int} pixel', async function (this: World, px: number) {
  const before = this.topBarBoxes;
  expect(before, 'the noted boxes').toBeDefined();
  const after = await controlBoxes(this);
  expect(Object.keys(before!.boxes), 'controls to compare').toEqual(expect.arrayContaining(['title', 'title text', 'Today', 'settings']));
  expect(Object.keys(after.boxes).sort(), 'the same controls are shown').toEqual(Object.keys(before!.boxes).sort());
  const off: string[] = [];
  for (const [name, b] of Object.entries(before!.boxes)) {
    const a = after.boxes[name];
    const mirroredX = before!.width - (b.x + b.w);
    const d = { x: a.x - mirroredX, y: a.y - b.y, w: a.w - b.w, h: a.h - b.h };
    if (Object.values(d).some((v) => Math.abs(v) > px)) off.push(`${name}: ${JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Math.round(v * 10) / 10])))}`);
  }
  expect(off, 'controls off their mirrored box').toEqual([]);
});

Then("the period title's text is aligned to the outer edge", async function (this: World) {
  const gap = await title(this).evaluate((el) => {
    const t = el.querySelector('.t')!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.right - parseFloat(getComputedStyle(el).paddingRight) - t.right;
  });
  expect(Math.abs(gap), 'room right of the title text (px)').toBeLessThanOrEqual(1);
});

Then("the top bar's widgets are in reverse order", async function (this: World) {
  const before = this.topBarBoxes!.boxes, after = (await controlBoxes(this)).boxes;
  const names = ['flame', 'plant', 'sync'].filter((n) => before[n] && after[n]);
  expect(names.length, 'widgets to compare').toBeGreaterThanOrEqual(2);
  const order = (bx: typeof before) => [...names].sort((p, q) => bx[p].x - bx[q].x);
  expect(order(after), 'left to right in left-handed mode').toEqual(order(before).reverse());
});

// --- sync icon ------------------------------------------------------------------------------------------------------

Then('I see the sync icon', async function (this: World) {
  await expect(syncIcon(this)).toBeVisible();
});

Then('I do not see the sync icon', async function (this: World) {
  // after the app has settled, so a sync problem that is still on its way cannot pass unseen
  await this.settled();
  await expect(syncIcon(this)).not.toHaveAttribute('data-state', 'error');
  await expect(syncIcon(this)).toBeHidden();
  // hidden, it takes no room in the top bar
  expect(await syncIcon(this).boundingBox(), 'sync icon box').toBeNull();
});

Then('the sync icon shows a problem', async function (this: World) {
  await expect(syncIcon(this)).toHaveAttribute('data-state', 'error');
  await expect(syncIcon(this)).toBeVisible();
});

Then('the {string} switch in the settings is off', async function (this: World, label: string) {
  const control = this.page.getByTestId('settings-view').getByRole('switch', { name: label, exact: true });
  await expect(control).toHaveAttribute('aria-checked', 'false');
});

/** The Today button's drawn fill and border: the pill inside on phones, the button itself on wide screens; `token` resolved to a colour. */
async function todayLook(w: World, token: string) {
  await expect(w.page.locator('[data-testid="month-cell"], [data-testid="week-header"], [data-testid="day-column"], [data-testid="timeline-now"]').first()).toBeVisible();
  return today(w).evaluate((btn, tok) => {
    const probe = document.createElement('i');
    probe.style.background = `var(${tok})`;
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const pill = btn.querySelector('.pill') as HTMLElement;
    const alpha = (c: string) => (c.startsWith('rgba') ? Number(c.split(',')[3].replace(')', '')) : 1);
    const drawn = [pill, btn as HTMLElement].find((el) => alpha(getComputedStyle(el).backgroundColor) > 0) ?? (btn as HTMLElement);
    const cs = getComputedStyle(drawn);
    return { shown: btn.getAttribute('data-today-shown'), bg: cs.backgroundColor, token, border: parseFloat(cs.borderTopWidth) };
  }, token);
}

Then('the Today button shows that today is on screen', async function (this: World) {
  await expect.poll(() => todayLook(this, '--md-sys-color-primary-container')).toMatchObject({ shown: 'true', border: 0 });
  const look = await todayLook(this, '--md-sys-color-primary-container');
  expect(look.bg, 'filled with the primary container colour').toBe(look.token);
});

Then('the Today button does not show that today is on screen', async function (this: World) {
  await expect.poll(async () => (await todayLook(this, '--md-sys-color-surface')).shown).toBe('false');
  const look = await todayLook(this, '--md-sys-color-surface');
  expect(look.border, 'outlined').toBeGreaterThanOrEqual(1);
  expect(look.bg, 'a solid surface fill').toBe(look.token);
});

Then('the day view shows no day header', async function (this: World) {
  await expect(this.page.getByTestId('day-view')).toBeVisible();
  await expect(this.page.getByTestId('day-column').first()).toBeVisible();
  await expect(this.page.getByTestId('day-header')).toHaveCount(0);
});

Then('the week view shows {int} day headers', async function (this: World, n: number) {
  await expect(this.page.getByTestId('week-header')).toHaveCount(n);
});
