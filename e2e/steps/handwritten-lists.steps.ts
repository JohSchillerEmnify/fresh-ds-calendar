/** Handwritten lists steps (STEPS.md "Handwritten lists"): Labs switches, the writing mode, ink items and the pen. */
import { expect, type Locator } from '@playwright/test';
import { Given, Step, Then, When } from './fixtures.js';
import { box } from './support/ui.js';
import type { World } from './support/world.js';

const PREF: Record<string, string> = { 'Handwritten lists': 'labsHandwriting', 'Draw with finger': 'labsDrawWithFinger' };
const dialog = (w: World) => w.page.getByTestId('tasklist-dialog');
const rows = (w: World) => w.expanded.getByTestId('tasklist-item');

/** A squiggle for a word: points in line heights with pressure, so the seeded item has real ink. */
const scribble = (seed: number) => ({ p: Array.from({ length: 12 }, (_, i) => [0.3 + i * 0.2, 0.5 + 0.25 * Math.sin(i + seed), 0.3 + 0.05 * i]) });

async function setSwitch(w: World, name: string, on: boolean) {
  const key = PREF[name];
  expect(key, `known Labs setting "${name}"`).toBeDefined();
  await w.api.patch('/api/prefs', key === 'labsHandwriting' ? { labs: true, [key!]: on } : { [key!]: on });
}

Given('the Labs switch {string} is on', async function (this: World, name: string) { await setSwitch(this, name, true); });
Given('the Labs setting {string} is on', async function (this: World, name: string) { await setSwitch(this, name, true); });
/** The Labs row of a setting; the master switch is turned on when the row is not shown yet (it only hides the rows). */
async function labsRow(w: World, name: string): Promise<Locator> {
  const row = w.page.getByTestId(name === 'Handwritten lists' ? 'settings-labs-handwriting' : 'settings-labs-draw-with-finger');
  if (!(await row.count())) await w.page.getByTestId('settings-labs').click();
  return row;
}
/** One sentence for the given and the check: with the settings open it is checked on screen, else the pref is set. */
async function off(w: World, name: string) {
  if (!(await w.page.getByTestId('settings-view').isVisible().catch(() => false))) return setSwitch(w, name, false);
  await expect(await labsRow(w, name)).toHaveAttribute('aria-checked', 'false');
}
Step('the Labs switch {string} is off', async function (this: World, name: string) { await off(this, name); });
Step('the Labs setting {string} is off', async function (this: World, name: string) { await off(this, name); });

/** The pen flag of the device (`cal.ink.pen`), set before the app starts and now. */
async function penSupport(w: World, on: boolean) {
  await w.page.addInitScript((v) => { try { if (v) localStorage.setItem('cal.ink.pen', '1'); else localStorage.removeItem('cal.ink.pen'); } catch { /* none */ } }, on);
}
Given('the device reports pen support', async function (this: World) { await penSupport(this, true); });
Given('the device reports no pen support', async function (this: World) { await penSupport(this, false); });

Given('the writing mode is {string}', async function (this: World, mode: string) {
  await this.page.addInitScript((m) => { try { localStorage.setItem('cal.ink.mode', m); } catch { /* none */ } }, mode);
});

Given('the calendar contains a task list {string} on {date} with the ink items {string}', async function (this: World, title: string, date: string, words: string) {
  const items = words.split(', ').map((_, i) => ({ title: '', strokes: [scribble(i)] }));
  await this.api.post('/api/tasklists', { title, date, time: null, items });
  // the page the following steps work on
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/');
    await this.calendarShown();
  }
});

When('I open the new task list form', async function (this: World) {
  await this.page.goto('/');
  await this.calendarShown();
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-tasklist').click();
  await expect(dialog(this)).toBeVisible();
});

When('I open the new task list form on a screen {int} pixels wide', async function (this: World, width: number) {
  await this.page.setViewportSize({ width, height: 900 });
  await this.page.goto('/');
  await this.calendarShown();
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-tasklist').click();
  await expect(dialog(this)).toBeVisible();
});

Then('the new list form has no writing mode switch', async function (this: World) {
  await expect(dialog(this).getByTestId('ink-mode')).toHaveCount(0);
});
Then('the new list form shows the writing mode switch with the pen icon', async function (this: World) {
  await expect(dialog(this).getByTestId('ink-mode-icon-pen')).toBeVisible();
});
When('I press the writing mode switch', async function (this: World) {
  await this.page.getByTestId('ink-mode').first().click();
});
Then('the writing mode is {string} and the switch shows the keyboard icon', async function (this: World, mode: string) {
  await expect(this.page.getByTestId('ink-mode').first()).toHaveAttribute('data-mode', mode);
  await expect(this.page.getByTestId('ink-mode-icon-keyboard').first()).toBeVisible();
});
Then('the writing mode is {string} and the switch shows the pen icon', async function (this: World, mode: string) {
  await expect(this.page.getByTestId('ink-mode').first()).toHaveAttribute('data-mode', mode);
  await expect(this.page.getByTestId('ink-mode-icon-pen').first()).toBeVisible();
});

// --- dialog size and ruling --------------------------------------------------------------------------------------
Then('the dialog shows ruled lines to write on', async function (this: World) {
  await expect(dialog(this).locator('.ruled')).not.toHaveCount(0);
});
Then('the dialog shows no ruled lines to write on', async function (this: World) {
  await expect(dialog(this).locator('.ruled')).toHaveCount(0);
});
Then('the dialog is larger than without the feature', async function (this: World) {
  expect((await box(dialog(this))).width).toBeGreaterThan(560);
});
Then('the dialog is as large as without the feature', async function (this: World) {
  expect((await box(dialog(this))).width).toBeLessThanOrEqual(530);
});
Then('the dialog fits the window', async function (this: World) {
  const v = this.page.viewportSize()!;
  // the sheet slides in: measured once it has settled
  await expect.poll(async () => {
    const b = await box(dialog(this));
    return b.x >= 0 && b.x + b.width <= v.width + 1 && b.y >= 0 && b.y + b.height <= v.height + 1;
  }).toBe(true);
});
Then('typing in the item field works as without the feature', async function (this: World) {
  const items = dialog(this).getByTestId('tasklist-items');
  await items.fill('Milk');
  await expect(items).toHaveValue('Milk');
});

// --- the pen -------------------------------------------------------------------------------------------------------
/** Sends pointer events of one stroke to `line`, as the given pointer type (a pen with pressure by default). */
async function stroke(line: Locator, pointerType: 'pen' | 'touch' | 'mouse', opts: { buttons?: number; short?: boolean; noScroll?: boolean } = {}) {
  if (!opts.noScroll) await line.scrollIntoViewIfNeeded();
  await line.evaluate((el, o) => {
    const r = el.getBoundingClientRect();
    const fire = (type: string, i: number) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: o.pointerType, isPrimary: true, buttons: type === 'pointerup' ? 0 : o.buttons,
      clientX: r.left + 10 + i * 12, clientY: r.top + r.height / 2 + Math.sin(i / 2) * 6, pressure: 0.2 + i * 0.03, width: 1, height: 1,
    }));
    fire('pointerdown', 0);
    for (let i = 1; i <= o.n; i++) fire('pointermove', i);
    fire('pointerup', o.n);
  }, { pointerType, buttons: opts.buttons ?? 1, n: opts.short ? 2 : 12 });
}
const nextLine = (w: World) => w.expanded.getByTestId('ink-next-line').getByTestId('ink-line');

When('I write an ink item with the pen', async function (this: World) { await stroke(nextLine(this), 'pen'); });
When('I drag with the mouse over the writing area', async function (this: World) { await stroke(nextLine(this), 'mouse'); });
Then('nothing is drawn', async function (this: World) {
  await expect(nextLine(this)).toHaveAttribute('data-strokes', '0');
});
Then('the expanded task list has {int} items', async function (this: World, n: number) {
  await expect(rows(this)).toHaveCount(n);
});
When('I tick the item number {int}', async function (this: World, n: number) {
  await rows(this).nth(n - 1).getByTestId('tasklist-item-checkbox').click();
});
Then('the item number {int} is ticked', async function (this: World, n: number) {
  await expect(rows(this).nth(n - 1)).toHaveAttribute('data-done', 'true');
});
When('I click the ink item number {int} with the mouse', async function (this: World, n: number) {
  await rows(this).nth(n - 1).getByTestId('ink-line').click();
});
Then('the item number {int} is an ink item', async function (this: World, n: number) {
  await expect(rows(this).nth(n - 1).getByTestId('ink-line')).toBeVisible();
});

Then('the checkbox of the item number {int} is right of its grip handle', async function (this: World, n: number) {
  const row = rows(this).nth(n - 1);
  const [c, g] = [await box(row.getByTestId('tasklist-item-checkbox')), await box(row.getByTestId('tasklist-item-grip'))];
  expect(c.x).toBeGreaterThan(g.x);
});
Then('the writing of the item number {int} starts at least {int} pixels right of its grip handle', async function (this: World, n: number, gap: number) {
  const row = rows(this).nth(n - 1);
  const [w, g] = [await box(row.getByTestId('ink-line')), await box(row.getByTestId('tasklist-item-grip'))];
  expect(w.x - (g.x + g.width)).toBeGreaterThanOrEqual(gap);
});

// --- writing in the new list form: undo, eraser, colours ------------------------------------------------------------
const formLines = (w: World) => dialog(w).getByTestId('tasklist-ink-lines').getByTestId('ink-line');
const formStrokes = (w: World) => dialog(w).getByTestId('tasklist-ink-lines').getByTestId('ink-stroke');
/** Draws `n` pen strokes, each on its own line of the form, so the first one can be touched alone. */
async function drawStrokes(w: World, n: number, start = 0) {
  for (let i = 0; i < n; i++) await stroke(formLines(w).nth(start + i), 'pen');
}
When('I draw {int} stroke(s) with the pen', async function (this: World, n: number) { await drawStrokes(this, n); });
Given('I have drawn {int} stroke(s) with the pen', async function (this: World, n: number) { await drawStrokes(this, n); });
When('I draw a stroke with the pen', async function (this: World) {
  const open = nextLine(this);
  if (await open.count()) return stroke(open, 'pen');
  await stroke(formLines(this).last(), 'pen');
});
Then('the writing area shows {int} stroke(s)', async function (this: World, n: number) {
  await expect(formStrokes(this)).toHaveCount(n);
});
When('I press the undo button', async function (this: World) { await this.page.getByTestId('ink-undo').click(); });
Given('the device passes the pen double tap on', async function (this: World) { /* the host dispatches `pencildoubletap`; nothing to switch on */ });
When('I double tap the pen', async function (this: World) {
  await this.page.evaluate(() => window.dispatchEvent(new CustomEvent('pencildoubletap')));
});
When('I touch the first stroke with the eraser end of the pen', async function (this: World) {
  await stroke(formLines(this).first(), 'pen', { buttons: 32 });
});
When('I touch the first stroke with the pen', async function (this: World) { await stroke(formLines(this).first(), 'pen'); });
When('I press the eraser button', async function (this: World) { await this.page.getByTestId('ink-eraser').click(); });
Given('the task list {string} holds about 200 KB of ink', async function (this: World, title: string) {
  // three strokes of ~66 KB: just under the 200 KB the server allows, so one more stroke is too much
  const pts = (n: number) => ({ p: Array.from({ length: n }, (_, i) => [1 + (i % 9) / 10, 0.5, 0.5]), c: '#d32f2f' });
  // the server counts the JSON of each item's strokes: grow the last stroke until the list is just under the limit
  const measure = (items: { strokes: unknown[] }[]) => JSON.stringify(items.map((i) => i.strokes)).length;
  let n = 4700;
  let items = [{ title: '', strokes: [pts(4750), pts(4750)] }, { title: '', strokes: [pts(n)] }];
  while (measure(items) < 199_800) items = [items[0]!, { title: '', strokes: [pts(++n)] }];
  await this.api.post('/api/tasklists', { title, date: '2026-10-14', time: null, items });
  if (!this.page.url().startsWith('http')) { await this.page.goto('/'); await this.calendarShown(); }
});
Then('the app says the list is full and suggests starting a new list', async function (this: World) {
  await expect(this.page.getByText('Start a new list')).toBeVisible();
});
Step('I choose the ink colour preset {string}', async function (this: World, name: string) { await this.page.getByTestId(`ink-color-${name}`).click(); });
Step('I choose the custom ink colour {string} in the colour picker', async function (this: World, hex: string) {
  await this.page.getByTestId('ink-color-custom').fill(hex.toLowerCase());
});
Given('I choose the custom ink colour {string}', async function (this: World, hex: string) {
  await this.page.getByTestId('ink-color-custom').fill(hex.toLowerCase());
});
Then('the stroke has the theme\'s text colour', async function (this: World) {
  await expect(formStrokes(this).first()).toHaveAttribute('data-colour', 'theme');
});
Then('the stroke is red', async function (this: World) {
  await expect(formStrokes(this).first()).toHaveAttribute('data-colour', '#d32f2f');
});
Then('the stroke has the colour {string}', async function (this: World, hex: string) {
  await expect(formStrokes(this).first()).toHaveAttribute('data-colour', hex.toLowerCase());
});
When('the theme is dark', async function (this: World) {
  await this.api.patch('/api/settings', { themeMode: 'dark' });
  await expect(this.page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
Then('the stroke is adjusted so it is readable on the dark background', async function (this: World) {
  if (!(await formStrokes(this).count())) await drawStrokes(this, 1);
  const rgb = await formStrokes(this).first().evaluate((el) => getComputedStyle(el).fill);
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number) as [number, number, number];
  // black (0,0,0) is moved towards white until it reads on the dark surface
  expect(r + g + b).toBeGreaterThan(300);
});
Then('the chosen ink colour is {string}', async function (this: World, name: string) {
  await expect(this.page.getByTestId(`ink-color-${name}`)).toHaveAttribute('aria-pressed', 'true');
});

// --- reading ink: cards, the Tasks view, the Canvas, screen readers --------------------------------------------------
Then('the card of {string} shows {int} ink items, scaled down', async function (this: World, title: string, n: number) {
  const items = this.taskCard(title).locator('[data-ink="true"]');
  await expect(items).toHaveCount(n);
  // a band card may show only its title row; the ink line is 24 px high wherever it is laid out
  const h = await items.first().getByTestId('ink-line').evaluate((el) => getComputedStyle(el).height);
  expect(parseFloat(h)).toBeLessThanOrEqual(26);
});
Then('a pen stroke on the card draws nothing', async function (this: World) {
  const line = this.taskCard('Groceries').locator('[data-ink="true"]').first().getByTestId('ink-line');
  await stroke(line, 'pen', { short: true, noScroll: true });
  await expect(line).toHaveAttribute('data-strokes', '1');
});
Then('the task list {string} shows {int} ink items, scaled down', async function (this: World, title: string, n: number) {
  const items = this.page.locator(`[data-testid="tasklist-view"][data-title="${title}"]`).getByTestId('tasklist-item-ink');
  await expect(items).toHaveCount(n);
  expect((await box(items.first().getByTestId('ink-line'))).height).toBeLessThanOrEqual(48);
});
const note = (w: World, title: string) => w.page.locator(`[data-testid="canvas-note"][data-title="${title}"]`);
When('I write an ink item on the note {string} with the pen', async function (this: World, title: string) {
  await stroke(note(this, title).getByTestId('ink-next-line').getByTestId('ink-line'), 'pen');
});
Then('the note {string} shows {int} ink items', async function (this: World, title: string, n: number) {
  await expect(note(this, title).getByTestId('tasklist-item-ink')).toHaveCount(n);
});
Then('a screen reader reads the item number {int} as {string}', async function (this: World, n: number, text: string) {
  await expect(rows(this).nth(n - 1).getByTestId('ink-line')).toHaveAttribute('aria-label', text);
});
