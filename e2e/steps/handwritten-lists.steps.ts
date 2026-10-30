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
  expect((await box(dialog(this))).width).toBeLessThanOrEqual(521);
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
async function stroke(line: Locator, pointerType: 'pen' | 'touch' | 'mouse', opts: { buttons?: number } = {}) {
  await line.scrollIntoViewIfNeeded();
  await line.evaluate((el, o) => {
    const r = el.getBoundingClientRect();
    const fire = (type: string, i: number) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: o.pointerType, isPrimary: true, buttons: type === 'pointerup' ? 0 : o.buttons,
      clientX: r.left + 10 + i * 12, clientY: r.top + r.height / 2 + Math.sin(i / 2) * 6, pressure: 0.2 + i * 0.03, width: 1, height: 1,
    }));
    fire('pointerdown', 0);
    for (let i = 1; i <= 12; i++) fire('pointermove', i);
    fire('pointerup', 12);
  }, { pointerType, buttons: opts.buttons ?? 1 });
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
