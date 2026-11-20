/** Subtask steps (feature tasklist-subtasks; STEPS.md "Subtasks"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { checkInMessageGone, dragItem, expandTaskList, itemById } from './support/tasklist.js';
import { box } from './support/ui.js';
import { leaveSettings, settingControl } from './support/settings.js';
import { attr, type World } from './support/world.js';

const NUMBER: Record<string, number> = { one: 1, two: 2, three: 3 };
const steps = (word: string, dir: string): number => {
  if (!(word in NUMBER) || (dir !== 'right' && dir !== 'left')) throw new Error(`"${word} steps to the ${dir}" is not a known drag`);
  return NUMBER[word]! * (dir === 'right' ? 1 : -1);
};

/** The level of every row of the open list with its title, in order. */
const rowLevels = (w: World) => w.expanded.getByTestId('tasklist-item').evaluateAll((els) => els.map((e) => ({ title: e.getAttribute('data-title') ?? '', level: Number(e.getAttribute('data-level') ?? 0) })));

/** The title of the task an item hangs under: the nearest row above with a lower level, or null for a task. */
async function parentOf(w: World, title: string): Promise<string | null | undefined> {
  const rows = await rowLevels(w);
  const at = rows.findIndex((r) => r.title === title);
  if (at < 0) return undefined;
  for (let i = at - 1; i >= 0; i--) if (rows[i]!.level < rows[at]!.level) return rows[i]!.title;
  return null;
}

When('I drag the item {string} {word} step(s) to the {word}', async function (this: World, title: string, n: string, dir: string) {
  await dragItem(this, this.expanded, title, { sideways: steps(n, dir) });
});

When('I long-press the item {string} and drag it {word} step(s) to the {word}', async function (this: World, title: string, n: string, dir: string) {
  if (!this.testInfo.project.use.hasTouch) throw new Error('a long press needs the touch (mobile) project');
  await dragItem(this, this.expanded, title, { sideways: steps(n, dir) });
});

When('I drag the item {string} below the item {string}', async function (this: World, title: string, below: string) {
  await dragItem(this, this.expanded, title, { below });
});

const rightEdgeBefore = new WeakMap<World, number>();

When('I hold the item {string} {word} step(s) to the {word}', async function (this: World, title: string, n: string, dir: string) {
  await checkInMessageGone(this);
  const row = await itemById(this, title);
  await row.scrollIntoViewIfNeeded();
  const grip = await box(row.getByTestId('tasklist-item-grip'));
  const rb = await box(row);
  rightEdgeBefore.set(this, rb.x + rb.width);
  const from = { x: Math.round(grip.x + grip.width / 2), y: Math.round(grip.y + grip.height / 2) };
  const to = { x: from.x + steps(n, dir) * 28, y: from.y };
  if (this.testInfo.project.use.hasTouch) {
    const cdp = await this.context.newCDPSession(this.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    await this.page.waitForTimeout(500);
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(from.x + ((to.x - from.x) * i) / 10), y: from.y, id: 1 }] });
    this.held = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await cdp.detach().catch(() => {});
      this.held = undefined;
    };
  } else {
    const { mouse } = this.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move(to.x, to.y, { steps: 10 });
    this.held = async () => { await mouse.up(); this.held = undefined; };
  }
  await this.page.waitForTimeout(900);
});

Then('the dashed gap is indented {word} level(s)', async function (this: World, n: string) {
  const level = NUMBER[n]!;
  const gap = this.page.getByTestId('tasklist-drop-gap');
  await expect(gap).toHaveAttribute('data-level', String(level));
  const [g, b] = [await box(gap), await box(this.page.getByTestId('tasklist-drop-gap-box'))];
  expect(Math.abs(b.x - g.x - (4 + level * 28)), 'the dashed part starts one indent per level in').toBeLessThanOrEqual(2);
});

Then('the item {string} keeps its right side where it was', async function (this: World, title: string) {
  const rb = await box(await itemById(this, title));
  expect(Math.abs(rb.x + rb.width - rightEdgeBefore.get(this)!), 'right edge of the held row').toBeLessThanOrEqual(14);
});

/** Sets the levels through the server (the list's items in the given levels), then loads the page again with the list open. */
async function setLevels(w: World, levels: Record<string, number>): Promise<void> {
  const title = (await w.expanded.getAttribute('data-title')) ?? '';
  const id = (await w.expanded.getAttribute('data-tasklist-id')) ?? '';
  const list = await w.api.get<{ items: { id: string; title: string; level?: number }[] }>(`/api/tasklists/${encodeURIComponent(id)}`);
  const now = Object.fromEntries(list.items.map((i) => [i.title, i.level ?? 0]));
  const next = list.items.map((i) => levels[i.title] ?? now[i.title] ?? 0);
  await w.api.call('PUT', `/api/tasklists/${encodeURIComponent(id)}/items/order`, { itemIds: list.items.map((i) => i.id), levels: next });
  await w.page.reload();
  await w.settled();
  await expandTaskList(w, title);
}

/** Set-up: the item is made a subtask of its parent (one level deeper) through the server. */
Given('the item {string} was made a subtask of {string}', async function (this: World, title: string, parent: string) {
  if ((await parentOf(this, title)) === parent) return;
  const rows = await rowLevels(this);
  const level = rows.find((r) => r.title === parent)?.level;
  if (level === undefined) throw new Error(`no item "${parent}" in the open list`);
  await setLevels(this, { [title]: level + 1 });
});

Then('the item {string} is a subtask of {string}', async function (this: World, title: string, parent: string) {
  await expect.poll(() => parentOf(this, title), { message: `parent of "${title}"` }).toBe(parent);
});

Then('the item {string} is not a subtask', async function (this: World, title: string) {
  // the row may be in its edit field (no title button): the rows are read by their data
  await expect.poll(() => parentOf(this, title), { message: `parent of "${title}"` }).toBeNull();
});

When('I start renaming the item {string} and press Tab', async function (this: World, title: string) {
  const item = await itemById(this, title);
  await item.getByTestId('tasklist-item-title').click();
  const input = item.getByTestId('tasklist-item-title-input');
  await expect(input).toBeFocused();
  await input.press('Tab');
});

When('I press Shift+Tab', async function (this: World) {
  await this.page.keyboard.press('Shift+Tab');
});

When('I type the items:', async function (this: World, text: string) {
  await this.page.getByTestId('tasklist-dialog').getByTestId('tasklist-items').fill(text);
});

Then('the items {string} are ticked', async function (this: World, titles: string) {
  for (const t of titles.split(', ')) await expect(this.expandedItem(t)).toHaveAttribute('data-done', 'true');
});

Then('the items {string} are not ticked', async function (this: World, titles: string) {
  for (const t of titles.split(', ')) await expect(this.expandedItem(t)).toHaveAttribute('data-done', 'false');
});

When('I set {string} to {string} in the task list settings', async function (this: World, setting: string, choice: string) {
  const ids: Record<string, string> = { 'Subtask lines': 'subtask-lines' };
  const id = ids[setting];
  if (!id) throw new Error(`"${setting}" is not a task list setting known to this step`);
  await this.page.goto('/');
  await this.calendarShown();
  await settingControl(this, `settings-${id}`);
  const option = this.page.getByTestId(`settings-${id}-${choice.toLowerCase()}`);
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await option.click();
  expect((await saved).status(), 'prefs saved').toBe(200);
  await leaveSettings(this);
});

Then('the expanded task list {string} looks like the picture {string}', async function (this: World, title: string, picture: string) {
  const list = this.byTestId('tasklist-expanded', `${attr('data-title', title)}:not([data-presentation="overlay"])`);
  await expect(list).toBeVisible();
  await this.page.addStyleTag({ content: '[data-testid="streak-message"] { display: none !important; }' });
  await expect(list).toHaveScreenshot(`${picture}.png`);
});

Then('the collapsed task list {string} shows the item {string} indented under {string}', async function (this: World, title: string, item: string, parent: string) {
  const card = this.taskCard(title);
  await expect(card).toBeVisible();
  // the indent is the item's own left padding: the marker and the text both start after it
  const indent = (name: string) => card.getByTestId('tasklist-card-item').evaluateAll((els, n) => {
    const el = els.find((e) => e.getAttribute('data-title') === n);
    return el ? parseFloat(getComputedStyle(el).paddingLeft) : null;
  }, name);
  await expect.poll(async () => {
    const [a, b] = [await indent(item), await indent(parent)];
    return a !== null && b !== null && a > b + 2;
  }, { message: `"${item}" is indented under "${parent}"` }).toBe(true);
});
