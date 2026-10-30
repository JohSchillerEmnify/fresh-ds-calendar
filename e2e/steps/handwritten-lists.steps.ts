/** Handwritten lists steps (STEPS.md "Handwritten lists"): Labs switches, the writing mode, ink items and the pen. */
import { expect, type Locator } from '@playwright/test';
import { Given, Step, Then, When } from './fixtures.js';
import { call } from './sharing.steps.js';
import { dragItem, expandTaskList } from './support/tasklist.js';
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
Given('the device is an Android tablet that reports pen support', async function (this: World) {
  await this.page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/126 Safari/537.36' }));
  await penSupport(this, true);
});
Given('the device reports no pen support', async function (this: World) { await penSupport(this, false); });

Given('the writing mode is {string}', async function (this: World, mode: string) {
  await this.page.addInitScript((m) => { try { localStorage.setItem('cal.ink.mode', m); } catch { /* none */ } }, mode);
});

/** The words an ink item was created for and the ids the server gave them, so a step can name an ink item that has no title. */
const seeded = new WeakMap<World, { names: string[]; ids: string[] }>();
/** The number of strokes an ink item had before a step added to it. */
const strokesBefore = new WeakMap<World, number>();

async function seedInkList(w: World, title: string, date: string | null, words: string[]) {
  const items = words.map((_, i) => ({ title: '', strokes: [scribble(i)] }));
  const made = await w.api.post<{ items: { id: string }[] }>('/api/tasklists', { title, date, time: null, items });
  seeded.set(w, { names: words, ids: made.items.map((i) => i.id) });
}

Given('the calendar contains a task list {string} on {date} with the ink items {string}', async function (this: World, title: string, date: string, words: string) {
  await seedInkList(this, title, date, words.split(', '));
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
async function stroke(line: Locator, pointerType: 'pen' | 'touch' | 'mouse', opts: { buttons?: number; short?: boolean; noScroll?: boolean; contact?: number; pointerId?: number; keepDown?: boolean } = {}) {
  if (!opts.noScroll) await line.scrollIntoViewIfNeeded();
  await line.evaluate((el, o) => {
    const r = el.getBoundingClientRect();
    const fire = (type: string, i: number) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: o.pointerId, pointerType: o.pointerType, isPrimary: true, buttons: type === 'pointerup' ? 0 : o.buttons,
      clientX: r.left + 10 + i * 12, clientY: r.top + r.height / 2,
      pressure: 0.2 + i * 0.03, width: o.contact, height: o.contact,
    }));
    fire('pointerdown', 0);
    for (let i = 1; i <= o.n; i++) fire('pointermove', i);
    if (!o.keepDown) fire('pointerup', o.n);
  }, { pointerType, buttons: opts.buttons ?? 1, n: opts.short ? 2 : 12, contact: opts.contact ?? 1, pointerId: opts.pointerId ?? 7, keepDown: !!opts.keepDown });
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

// --- the expanded list: order, removing, mouse, finger, palm, grip ---------------------------------------------------
const inkRow = (w: World, n: number) => rows(w).nth(n - 1);
const inkOf = (w: World, n: number) => inkRow(w, n).getByTestId('ink-line');

Given('the expanded task list {string} has more ink items than fit the screen', async function (this: World, title: string) {
  await seedInkList(this, title, '2026-10-14', Array.from({ length: 14 }, (_, i) => `Line ${i + 1}`));
  await this.page.goto('/');
  await this.calendarShown();
  await expandTaskList(this, title);
});

Then('the ink items are in the order {string}', async function (this: World, order: string) {
  const { names, ids } = seeded.get(this)!;
  await expect.poll(async () => (await rows(this).evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')))).map((id) => names[ids.indexOf(id!)] ?? '?').join(', ')).toBe(order);
});
When('I drag the item number {int} above the item number {int}', async function (this: World, n: number, above: number) {
  await dragItem(this, this.expanded, n - 1, { above: above - 1 }, true);
});
When('I drag the grip handle of the item number {int} above the item number {int} with the pen', async function (this: World, n: number, above: number) {
  await dragItem(this, this.expanded, n - 1, { above: above - 1 }, 'pen');
});
When('I long-press the item number {int} with the mouse and drag it above the item number {int}', async function (this: World, n: number, above: number) {
  await dragItem(this, this.expanded, n - 1, { above: above - 1 }, false);
});
When('I long-press the item number {int} with a finger and drag it above the item number {int}', async function (this: World, n: number, above: number) {
  if (!this.testInfo.project.use.hasTouch) throw new Error('a long press with a finger needs the touch (mobile) project');
  await dragItem(this, this.expanded, n - 1, { above: above - 1 }, false);
});
When('I delete the item number {int}', async function (this: World, n: number) {
  await inkRow(this, n).getByTestId('tasklist-item-delete').click();
});

When('I tap the ink item number {int} with a finger', async function (this: World, n: number) {
  const line = inkOf(this, n);
  await line.scrollIntoViewIfNeeded();
  if (this.testInfo.project.use.hasTouch) await line.tap();
  else await stroke(line, 'touch', { short: true, noScroll: true });
});
Then('the item number {int} is ticked and nothing is drawn', async function (this: World, n: number) {
  await expect(inkRow(this, n)).toHaveAttribute('data-done', 'true');
  await expect(inkOf(this, n)).toHaveAttribute('data-strokes', '1');
  await expect(nextLine(this)).toHaveAttribute('data-strokes', '0');
});

Then('the stroke is drawn on the line', async function (this: World) {
  await expect(nextLine(this)).toHaveAttribute('data-strokes', '1');
});
When('I draw a stroke with a finger', async function (this: World) { await stroke(nextLine(this), 'touch'); });
When('I draw a stroke with the pen on the ink item number {int}', async function (this: World, n: number) {
  strokesBefore.set(this, Number(await inkOf(this, n).getAttribute('data-strokes')));
  await stroke(inkOf(this, n), 'pen');
});
Then('the ink item number {int} has one more stroke', async function (this: World, n: number) {
  await expect(inkOf(this, n)).toHaveAttribute('data-strokes', String((strokesBefore.get(this) ?? 1) + 1));
});

Then('the stroke is drawn on the line, thicker where I pressed harder', async function (this: World) {
  const line = nextLine(this);
  await expect(line).toHaveAttribute('data-strokes', '1');
  // the filled outline is measured across the line at two places (line-height units): the harder the pressure, the thicker
  const [early, late] = await line.evaluate((svg) => {
    const path = svg.querySelector('[data-testid="ink-stroke"]') as SVGGeometryElement;
    const box = path.getBBox();
    const across = (x: number) => { let n = 0; for (let y = 0; y <= 1; y += 0.005) if (path.isPointInFill(new DOMPoint(x, y))) n++; return n * 0.005; };
    return [across(box.x + box.width * 0.15), across(box.x + box.width * 0.85)];
  });
  expect(early).toBeGreaterThan(0);
  expect(late).toBeGreaterThan(early! * 1.3);
});

When('I rest my palm on the writing area and draw a stroke with the pen', async function (this: World) {
  const line = nextLine(this);
  await line.scrollIntoViewIfNeeded();
  // a wide touch lands first and moves while the pen writes, lifting before the pen does
  await line.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const fire = (type: string, id: number, kind: string, x: number, y: number, extra: PointerEventInit = {}) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: kind, isPrimary: id === 7, clientX: r.left + x, clientY: r.top + y, buttons: type === 'pointerup' ? 0 : 1, pressure: 0.4, ...extra,
    }));
    const palm = { width: 70, height: 70 };
    fire('pointerdown', 9, 'touch', 30, 30, palm);
    fire('pointerdown', 7, 'pen', 10, r.height / 2);
    for (let i = 1; i <= 12; i++) {
      fire('pointermove', 9, 'touch', 30 + i * 3, 30 + i * 5, palm);
      fire('pointermove', 7, 'pen', 10 + i * 12, r.height / 2 + Math.sin(i / 2) * 6);
    }
    fire('pointerup', 9, 'touch', 70, 90, palm);
    fire('pointerup', 7, 'pen', 160, r.height / 2);
  });
});
Then('only the pen stroke is drawn', async function (this: World) {
  const line = nextLine(this);
  await expect(line).toHaveAttribute('data-strokes', '1');
  // the palm's path (far below the line's middle) is not in the stroke: the pen stroke has about 13 points
  const points = await line.evaluate((svg) => (svg.querySelector('[data-testid="ink-stroke"]') as SVGGeometryElement).getBBox().height);
  expect(points).toBeLessThan(0.9);
});

/** The nearest scrolling ancestor of the line, as the writing area's own two-finger scroll finds it. */
async function scrollTop(line: Locator): Promise<number> {
  return line.evaluate((el) => {
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight) return n.scrollTop;
    }
    return -1;
  });
}
const scrolled = new WeakMap<World, number>();
async function swipeUp(w: World, fingers: 1 | 2) {
  // the first line, with the list scrolled to its top, so there is room to scroll up
  const line = inkOf(w, 1);
  await line.evaluate((el) => { for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) n.scrollTop = 0; });
  await line.scrollIntoViewIfNeeded();
  const before = await scrollTop(line);
  scrolled.set(w, before);
  const b = await box(line);
  const cdp = await w.context.newCDPSession(w.page);
  const pts = (dy: number) => Array.from({ length: fingers }, (_, k) => ({ x: Math.round(b.x + 40 + k * 60), y: Math.round(b.y + b.height / 2 + dy), id: k + 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(-i * 12) });
    await w.page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach().catch(() => {});
}
When('I swipe up on the writing area with a finger', async function (this: World) { await swipeUp(this, 1); });
When('I swipe up on the writing area with two fingers', async function (this: World) { await swipeUp(this, 2); });
Then('the list scrolls', async function (this: World) {
  const before = scrolled.get(this)!;
  await expect.poll(() => scrollTop(inkOf(this, 1))).toBeGreaterThan(before);
});

// --- mixing ink and text, typing -------------------------------------------------------------------------------------
When('I add the text item {string}', async function (this: World, title: string) {
  await this.expanded.getByTestId('tasklist-add').click();
  const input = this.expanded.getByTestId('tasklist-new-item');
  await input.fill(title);
  await input.press('Enter');
  // the add field is closed again, so the next click lands on its row and not on a field that closes under it
  await input.press('Escape');
  await expect(input).toBeHidden();
});
When('I click the next empty line and type {string}', async function (this: World, text: string) {
  await nextLine(this).click();
  const input = this.expanded.getByTestId('tasklist-new-item');
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press('Enter');
});
Then('the item number {int} is a text item', async function (this: World, n: number) {
  await expect(inkRow(this, n).getByTestId('tasklist-item-title')).toBeVisible();
  await expect(inkRow(this, n).getByTestId('ink-line')).toHaveCount(0);
});

// --- text mode ---------------------------------------------------------------------------------------------------------
Then('the item fields are ruled, ordinary text fields', async function (this: World) {
  const lines = dialog(this).getByTestId('tasklist-text-lines');
  await expect(lines).toHaveClass(/ruled/);
  await expect(lines.locator('textarea, input[type="text"]')).toBeVisible();
});
Then('the form has no button that turns ink into text', async function (this: World) {
  await expect(dialog(this).getByRole('button', { name: /recogni|convert|to text|in text|umwandeln|erkenn/i })).toHaveCount(0);
});
When('the device\'s handwriting recognition enters the text {string} in the item field', async function (this: World, text: string) {
  // Scribble and the Windows pen put recognised text into the focused field as an input event, like a keyboard's insertText
  await dialog(this).getByTestId('tasklist-items').focus();
  await this.page.keyboard.insertText(text);
});

// --- the title ---------------------------------------------------------------------------------------------------------
Then('the title field is an ordinary text field', async function (this: World) {
  const type = await dialog(this).getByTestId('tasklist-title').evaluate((el) => { const i = el.matches('input') ? el : el.querySelector('input'); return i ? i.getAttribute('type') ?? 'text' : 'missing'; });
  expect(type).toBe('text');
});
Then('the title field is not a writing area', async function (this: World) {
  await expect(dialog(this).getByTestId('tasklist-title').locator('svg[data-testid="ink-line"]')).toHaveCount(0);
});
Then('the collapsed task list shows the items {string}', async function (this: World, list: string) {
  const shown = this.page.locator('[data-testid="tasklist-card-item"], [data-testid="tasklist-item-title"]');
  await expect.poll(async () => (await shown.allTextContents()).map((s) => s.trim()).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(', ')).toBe(list);
});

// --- where the ink lives: other people, devices, Google, the backup, the server -------------------------------------------
const scribbles = (n: number) => Array.from({ length: n }, (_, i) => ({ title: '', strokes: [scribble(i)] }));

Given('{string} has an undated task list {string} with the ink items {string}', async function (this: World, owner: string, title: string, words: string) {
  // signing in needs the allow-list (the other person of the share is let in too)
  await this.api.setAuth([owner, 'anna@example.com']);
  const made = await call<{ items: { id: string }[] }>(this, owner, 'POST', '/api/tasklists', { title, date: null, items: scribbles(words.split(', ').length) });
  expect(made.status, 'list created').toBe(201);
  seeded.set(this, { names: words.split(', '), ids: made.body.items.map((i) => i.id) });
});

/** What the backup carries: the files it collects for the person (the Drive upload itself is feature drive-backup). */
let backupFiles: Record<string, string> = {};
When('the backup to Drive runs', async function (this: World) {
  backupFiles = (await this.api.get<{ files: Record<string, string> }>('/api/__test/backup/collect')).files;
});
Then('the backup holds the ink of the task list {string}', async function (this: World) {
  const ink = Object.entries(backupFiles).find(([name]) => name.endsWith('/ink.json'));
  expect(ink, 'the backup has the ink file').toBeDefined();
  for (const id of seeded.get(this)!.ids) expect(ink![1]).toContain(id);
});

Then('the item writing area offers no writing mode switch', async function (this: World) {
  await expect(this.page.getByTestId('ink-mode')).toHaveCount(0);
});
Then('I can still tick the item number {int}', async function (this: World, n: number) {
  const row = this.page.getByTestId('tasklist-view').first().getByTestId('tasklist-item').nth(n - 1);
  await row.getByTestId('tasklist-item-checkbox').click();
  await expect(row).toHaveAttribute('data-done', 'true');
});

When('I delete the task list {string}', async function (this: World) {
  await this.expanded.getByTestId('tasklist-delete').click();
});
/** The ids of the seeded list that the server still holds ink for. */
async function inkHeld(w: World): Promise<number> {
  const { items } = await w.api.get<{ items: Record<string, unknown> }>('/api/ink');
  return seeded.get(w)!.ids.filter((id) => id in items).length;
}
Then('the server holds {int} ink item(s) for the task list {string}', async function (this: World, n: number) {
  this.extendTimeout(30_000);
  await expect.poll(() => inkHeld(this), { timeout: 20_000 }).toBe(n);
});
Then('the server holds no ink for the task list {string}', async function (this: World) {
  this.extendTimeout(30_000);
  await expect.poll(() => inkHeld(this), { timeout: 20_000 }).toBe(0);
});

// --- templates and repeating lists ---------------------------------------------------------------------------------------
const made = new WeakMap<World, string>();
Given('the template {string} has the ink items {string}', async function (this: World, name: string, words: string) {
  await this.api.post('/api/templates', { name, items: scribbles(words.split(', ').length) });
});
When('I create a task list from the template {string}', async function (this: World, name: string) {
  await this.page.goto('/');
  await this.calendarShown();
  await this.page.getByTestId('create-button').click();
  await this.page.getByTestId('new-kind-tasklist').click();
  await expect(dialog(this)).toBeVisible();
  await dialog(this).getByTestId('tasklist-from-template').click();
  await this.page.getByTestId('template-picker').getByTestId('template-picker-item').and(this.page.locator(`[data-name="${name}"]`)).click();
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
  await dialog(this).getByTestId('tasklist-save').click();
  expect((await saved).status(), 'list created').toBe(201);
  await expect(dialog(this)).toBeHidden();
  made.set(this, name);
});
Then('the new task list shows {int} ink items, scaled down', async function (this: World, n: number) {
  await this.page.getByTestId('view-switch-tasks').click();
  const items = this.page.locator(`[data-testid="tasklist-view"][data-title="${made.get(this)}"]`).getByTestId('tasklist-item-ink');
  await expect(items).toHaveCount(n);
  expect((await box(items.first().getByTestId('ink-line'))).height).toBeLessThanOrEqual(48);
});
Given('the calendar contains a repeating task list {string} with the ink items {string}', async function (this: World, title: string, words: string) {
  await this.api.post('/api/tasklists', { title, date: '2026-10-12', time: null, items: scribbles(words.split(', ').length), recurrence: 'weekly' });
  await this.page.goto('/');
  await this.calendarShown();
});
When('the next occurrence of the task list {string} is created', async function (this: World) {
  await this.page.goto('/day/2026-10-19');
  await this.settled();
});
Then('the next occurrence shows {int} ink items, scaled down', async function (this: World, n: number) {
  const items = this.taskCard('Groceries').locator('[data-ink="true"]');
  await expect(items).toHaveCount(n);
});

// --- ticked ink, scaling, left-handed -------------------------------------------------------------------------------------
Then('the ink item number {int} has the same strike line as the text item number {int}', async function (this: World, ink: number, text: number) {
  await expect(inkRow(this, ink)).toHaveAttribute('data-done', 'true');
  // the text strike draws itself over a short transition
  await expect.poll(() => inkRow(this, text).locator('.tt').evaluate((el) => getComputedStyle(el).backgroundSize)).toBe('100% 1.6px');
  const [a, b] = await Promise.all([
    inkRow(this, ink).getByTestId('tasklist-item-ink').evaluate((el) => { const s = getComputedStyle(el, '::after'); return { h: s.height, top: parseFloat(s.top) / el.getBoundingClientRect().height, colour: s.backgroundColor, text: getComputedStyle(el).color }; }),
    inkRow(this, text).locator('.tt').evaluate((el) => { const s = getComputedStyle(el); return { size: s.backgroundSize, pos: s.backgroundPositionY, text: s.color }; }),
  ]);
  expect(b.size).toMatch(/1\.6px$/);
  expect(parseFloat(a.h)).toBeCloseTo(1.6, 1);
  expect(a.top).toBeCloseTo(0.55, 1);
  expect(b.pos).toBe('55%');
  expect(a.colour).toBe(a.text);
  expect(a.text).toBe(b.text);
});
Then('the ink item number {int} is faded to about half', async function (this: World, n: number) {
  const cell = inkRow(this, n).getByTestId('tasklist-item-ink');
  await expect.poll(async () => Number(await cell.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.4);
  expect(Number(await cell.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.65);
});

/** The proportions of the ink of the first item to its line, at one window width. */
async function inkProportions(w: World, title: string, width: number) {
  await w.page.setViewportSize({ width, height: 900 });
  await w.page.goto('/day/2026-10-14');
  await w.calendarShown();
  await expandTaskList(w, title);
  await expect(inkOf(w, 1)).toBeVisible();
  return inkOf(w, 1).evaluate((svg) => {
    const line = svg.getBoundingClientRect();
    const p = svg.querySelector('[data-testid="ink-stroke"]')!.getBoundingClientRect();
    return { w: p.width / line.height, h: p.height / line.height, inside: p.right <= line.right + 0.5 && p.left >= line.left - 0.5 && p.bottom <= line.bottom + 0.5 && p.top >= line.top - 0.5 };
  });
}
const scaled = new WeakMap<World, { w: number; h: number; inside: boolean }>();
When('I expand the task list {string} on a screen {int} pixels wide', async function (this: World, title: string, width: number) {
  scaled.set(this, await inkProportions(this, title, width));
  this.scaleTitle = title;
});
Then('the ink of the item number {int} has the same proportions to its line as on a {int} pixel wide screen', async function (this: World, _n: number, ref: number) {
  const mine = scaled.get(this)!;
  const there = await inkProportions(this, this.scaleTitle!, ref);
  expect(mine.w).toBeCloseTo(there.w, 1);
  expect(mine.h).toBeCloseTo(there.h, 1);
});
Then('the ink of the item number {int} is not cut off', async function (this: World) {
  expect(scaled.get(this)!.inside).toBe(true);
});

const toolBoxes = async (w: World) => dialog(w).getByTestId('ink-tools').evaluate((row) => {
  const r = row.getBoundingClientRect();
  const parts = [...row.querySelectorAll('[data-testid="ink-mode"], [data-testid="ink-undo"], [data-testid="ink-eraser"], [data-testid^="ink-color-"]')];
  return { width: r.width, parts: parts.map((el) => { const b = (el.closest('label') ?? el).getBoundingClientRect(); return { id: el.getAttribute('data-testid')!, x: b.x - r.x, w: b.width, y: b.y - r.y }; }) };
});
const toolsBefore = new WeakMap<World, Awaited<ReturnType<typeof toolBoxes>>>();
When('I note where the writing tools are', async function (this: World) { toolsBefore.set(this, await toolBoxes(this)); });
Then('every writing tool is at the mirror image of where it was, within {int} pixel', async function (this: World, px: number) {
  const before = toolsBefore.get(this)!;
  const after = await toolBoxes(this);
  expect(after.parts.map((p) => p.id).sort()).toEqual(before.parts.map((p) => p.id).sort());
  for (const b of before.parts) {
    const a = after.parts.find((p) => p.id === b.id)!;
    expect(Math.abs(a.x - (before.width - b.x - b.w)), `${b.id} x`).toBeLessThanOrEqual(px);
    expect(Math.abs(a.y - b.y), `${b.id} y`).toBeLessThanOrEqual(px);
  }
});
