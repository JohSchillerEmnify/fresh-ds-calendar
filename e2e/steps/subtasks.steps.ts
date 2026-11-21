/** Subtask steps (feature tasklist-subtasks; STEPS.md "Subtasks"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { dragItem, expandTaskList, itemById } from './support/tasklist.js';
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

/** The pointer of a held item: where it is and how to move it (the press stays down until the world's cleanup). */
const finger = new WeakMap<World, { at: { x: number; y: number }; moveTo: (p: { x: number; y: number }) => Promise<void> }>();
/** The sideways places of every row's grip and bin before the item was held, by title. */
const sidesBefore = new WeakMap<World, Record<string, { grip: number; bin: number }>>();

const sides = (w: World) => w.expanded.getByTestId('tasklist-item').evaluateAll((els) => Object.fromEntries(els.map((e) => [
  e.getAttribute('data-title') ?? '',
  { grip: e.querySelector('[data-testid="tasklist-item-grip"]')?.getBoundingClientRect().left ?? NaN, bin: e.querySelector('[data-testid="tasklist-item-delete"]')?.getBoundingClientRect().left ?? NaN },
])));

/** The list's own place before the item was held, by world. */
const cornerBefore = new WeakMap<World, { x: number; y: number }>();

/** Presses the grip of the item and holds it, then moves by (dx, dy) px; the card is at rest when the step ends. */
async function hold(w: World, title: string, dx: number, dy: number): Promise<void> {
  const row = await itemById(w, title);
  await row.scrollIntoViewIfNeeded();
  const grip = await box(row.getByTestId('tasklist-item-grip'));
  sidesBefore.set(w, await sides(w));
  cornerBefore.set(w, await listCorner(w));
  heightBefore.set(w, { title, height: (await box(row)).height });
  const from = { x: Math.round(grip.x + grip.width / 2), y: Math.round(grip.y + grip.height / 2) };
  if (w.testInfo.project.use.hasTouch) {
    const cdp = await w.context.newCDPSession(w.page);
    const send = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }] : [] } as never);
    await send('touchStart', from);
    await w.page.waitForTimeout(500);
    finger.set(w, { at: from, moveTo: async (p) => { const f = finger.get(w)!; for (let i = 1; i <= 10; i++) await send('touchMove', { x: f.at.x + ((p.x - f.at.x) * i) / 10, y: f.at.y + ((p.y - f.at.y) * i) / 10 }); } });
    w.held = async () => {
      await send('touchEnd').catch(() => {});
      await cdp.detach().catch(() => {});
      w.held = undefined;
    };
  } else {
    const { mouse } = w.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    finger.set(w, { at: from, moveTo: (p) => mouse.move(p.x, p.y, { steps: 10 }) });
    w.held = async () => { await mouse.up(); w.held = undefined; };
  }
  await moveFinger(w, dx, dy);
}

async function moveFinger(w: World, dx: number, dy: number): Promise<void> {
  const f = finger.get(w);
  if (!f) throw new Error('no item is held');
  const to = { x: f.at.x + dx, y: f.at.y + dy };
  await f.moveTo(to);
  f.at = to;
  await w.page.waitForTimeout(900);
}

const toward = (n: number, dir: string): number => {
  if (dir === 'left' || dir === 'up') return -n;
  if (dir === 'right' || dir === 'down') return n;
  throw new Error(`"${dir}" is not a direction`);
};

When('I hold the item {string} {word} step(s) to the {word}', async function (this: World, title: string, n: string, dir: string) {
  await hold(this, title, steps(n, dir) * 28, 0);
});

When('I hold the item {string} and move the finger {int} px to the {word} and {int} px {word}', async function (this: World, title: string, x: number, xd: string, y: number, yd: string) {
  await hold(this, title, toward(x, xd), toward(y, yd));
});

When('I move the finger {int} px to the {word} and {int} px {word}', async function (this: World, x: number, xd: string, y: number, yd: string) {
  await moveFinger(this, toward(x, xd), toward(y, yd));
});

const heldRow = (w: World) => w.expanded.locator('[data-testid="tasklist-item"][data-dragging="true"]');

Then('the held card shows the checkbox and the title {string} but no grip and no bin', async function (this: World, title: string) {
  const card = heldRow(this);
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('tasklist-item-checkbox')).toBeVisible();
  await expect(card.getByTestId('tasklist-item-title')).toHaveText(title);
  await expect(card.getByTestId('tasklist-item-title')).toBeVisible();
  await expect(card.getByTestId('tasklist-item-grip')).toBeHidden();
  await expect(card.getByTestId('tasklist-item-delete')).toBeHidden();
});

Then('the held card is one line tall', async function (this: World) {
  const card = await box(heldRow(this));
  const rows = await this.expanded.locator('[data-testid="tasklist-item"]:not([data-dragging="true"])').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  // the lift scales the card by 1.05
  expect(card.height, 'the held card is taller than a row: its title wrapped').toBeLessThanOrEqual(Math.min(...rows) * 1.05 + 6);
});

Then('the held card is under the finger', async function (this: World) {
  const f = finger.get(this);
  if (!f) throw new Error('no item is held');
  const b = await box(heldRow(this));
  expect(f.at.x, 'finger across the card').toBeGreaterThanOrEqual(b.x - 2);
  expect(f.at.x).toBeLessThanOrEqual(b.x + b.width + 2);
  expect(f.at.y, 'finger down the card').toBeGreaterThanOrEqual(b.y - 2);
  expect(f.at.y).toBeLessThanOrEqual(b.y + b.height + 2);
});

const slot = (w: World) => w.page.getByTestId('tasklist-drop-slot');
const slotCheckbox = (w: World) => w.page.getByTestId('tasklist-drop-checkbox');
const otherRows = (w: World) => w.expanded.locator('[data-testid="tasklist-item"]:not([data-dragging="true"])');

Then('the slot is at level {int}', async function (this: World, level: number) {
  await expect(slot(this)).toHaveAttribute('data-level', String(level));
  // the checkbox of a task (level 0) plus one indent per level
  const task = this.expanded.locator('[data-testid="tasklist-item"][data-level="0"]:not([data-dragging="true"])').first();
  const [g, c] = [await box(slotCheckbox(this)), await box(task.getByTestId('tasklist-item-checkbox'))];
  expect(Math.abs(g.x - (c.x + level * 28)), 'the slot checkbox sits where the checkbox of the level sits').toBeLessThanOrEqual(1);
});

Then('the slot has the size of a row, holds its checkbox and the grips, and no part of it is under a bin', async function (this: World) {
  const [s, g, row] = [await box(slot(this)), await box(slotCheckbox(this)), await box(otherRows(this).first())];
  expect(Math.abs(s.height - row.height), 'the slot is as tall as a row').toBeLessThanOrEqual(1);
  // the checkbox's 48 px target reaches past the slot's edge: its middle (the drawn box) is inside
  expect(g.x + g.width / 2, 'checkbox inside, at the left').toBeGreaterThanOrEqual(s.x + 8);
  expect(g.x + g.width / 2).toBeLessThanOrEqual(s.x + s.width);
  const edges = await this.expanded.locator('[data-testid="tasklist-item"]:not([data-dragging="true"])').evaluateAll((els) => els.map((e) => ({
    grip: e.querySelector('[data-testid="tasklist-item-grip"]')!.getBoundingClientRect().right,
    bin: e.querySelector('[data-testid="tasklist-item-delete"]')!.getBoundingClientRect().left,
  })));
  for (const e of edges) {
    expect(s.x + s.width, 'the grip is inside the slot').toBeGreaterThanOrEqual(e.grip - 1);
    expect(s.x + s.width, 'the slot ends before the bin').toBeLessThanOrEqual(e.bin + 1);
  }
});

const tree = (w: World) => w.page.getByTestId('tasklist-drop-tree');

Then('the lit tree line starts under the checkbox of {string}, is primary coloured and 2 px wide', async function (this: World, parent: string) {
  const [t, c] = [await box(tree(this)), await box((await itemById(this, parent)).getByTestId('tasklist-item-checkbox'))];
  expect(Math.abs(t.x + 1 - (c.x + c.width / 2)), 'the line runs under the middle of the parent checkbox').toBeLessThanOrEqual(2);
  expect(t.y, 'the line starts under the parent checkbox').toBeGreaterThanOrEqual(c.y + c.height / 2);
  expect(t.y).toBeLessThanOrEqual(c.y + c.height + 8);
  const [css, primary] = await tree(this).evaluate((el) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--md-sys-color-primary)';
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    const cs = getComputedStyle(el);
    return [{ width: cs.width, color: cs.backgroundColor }, want];
  });
  expect(css.width).toBe('2px');
  expect(css.color).toBe(primary);
});

Then('the lit tree line runs down to the slot and stays clear of its checkbox', async function (this: World) {
  const [s, g, t] = [await box(slot(this)), await box(slotCheckbox(this)), await box(tree(this))];
  expect(Math.abs(t.y + t.height - s.y), 'the line ends at the top of the slot').toBeLessThanOrEqual(2);
  expect(t.x + t.width, 'the line is left of the slot').toBeLessThanOrEqual(s.x + 1);
  expect(t.x + t.width, 'the line stops before the checkbox').toBeLessThanOrEqual(g.x + 1);
});

Then('no tree line is lit', async function (this: World) {
  await expect(slot(this)).toBeVisible();
  await expect(tree(this)).toHaveCount(0);
});

/** The height of the held item's row before it was held, by world. */
const heightBefore = new WeakMap<World, { title: string; height: number }>();

/** The list's own top left: a bottom sheet that grows with a taller row moves, so places are compared from it. */
const listCorner = (w: World) => box(w.expanded.locator('ul').first());
const slotBoxes = new WeakMap<World, { slot: Awaited<ReturnType<typeof box>>; checkbox: Awaited<ReturnType<typeof box>>; list: Awaited<ReturnType<typeof box>> }>();

When('I let go of the item', async function (this: World) {
  slotBoxes.set(this, { slot: await box(slot(this)), checkbox: await box(slotCheckbox(this)), list: await listCorner(this) });
  if (!this.held) throw new Error('no item is held');
  await this.held();
  finger.delete(this);
  await this.page.waitForTimeout(900);
});

Given('the task list is scrolled to its end', async function (this: World) {
  await this.expanded.locator('ul').first().evaluate(async (ul) => {
    let n: HTMLElement | null = ul.parentElement;
    while (n && !(getComputedStyle(n).overflowY.match(/auto|scroll/) && n.scrollHeight > n.clientHeight)) n = n.parentElement;
    if (n) n.scrollTop = n.scrollHeight;
    await new Promise((r) => setTimeout(r, 200));
  });
});

Then('the list has not moved since the item was picked up', async function (this: World) {
  const [was, now] = [cornerBefore.get(this), await listCorner(this)];
  if (!was) throw new Error('no item was held');
  expect(Math.abs(now.y - was.y), 'the list moved under the finger').toBeLessThanOrEqual(1);
});

Then('the item {string} is taller than it was before it was held', async function (this: World, title: string) {
  const was = heightBefore.get(this);
  if (!was || was.title !== title) throw new Error(`"${title}" was not the held item`);
  expect((await box(await itemById(this, title))).height, 'the title wraps one line more at the deeper level').toBeGreaterThan(was.height + 8);
});

Then('the item {string} sits exactly where the slot was', async function (this: World, title: string) {
  const was = slotBoxes.get(this);
  if (!was) throw new Error('the item was not let go');
  const row = await itemById(this, title);
  const [r, c, list] = [await box(row), await box(row.getByTestId('tasklist-item-checkbox')), await listCorner(this)];
  const [dx, dy] = [list.x - was.list.x, list.y - was.list.y];
  expect(Math.abs(r.y - dy - was.slot.y), 'top').toBeLessThanOrEqual(1);
  expect(Math.abs(r.height - was.slot.height), 'height').toBeLessThanOrEqual(1);
  const mine = { x: c.x - dx, y: c.y - dy, width: c.width, height: c.height };
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(mine[k] - was.checkbox[k]), `checkbox ${k}`).toBeLessThanOrEqual(1);
});

Then('the grips and bins of the other items have not moved sideways', async function (this: World) {
  const held = await heldRow(this).evaluateAll((els) => els.map((e) => e.getAttribute('data-title') ?? ''));
  const [before, now] = [sidesBefore.get(this)!, await sides(this)];
  for (const [title, was] of Object.entries(before)) {
    if (held.includes(title)) continue;
    expect(Math.abs(now[title]!.grip - was.grip), `grip of ${title}`).toBeLessThanOrEqual(1);
    expect(Math.abs(now[title]!.bin - was.bin), `bin of ${title}`).toBeLessThanOrEqual(1);
  }
});

When('the item {string} gets the title {string}', async function (this: World, title: string, next: string) {
  const list = await this.api.get<{ id: string; items: { id: string; title: string }[] }>(`/api/tasklists/${encodeURIComponent((await this.expanded.getAttribute('data-tasklist-id')) ?? '')}`);
  const item = list.items.find((i) => i.title === title);
  if (!item) throw new Error(`no item "${title}" in the open list`);
  await this.api.call('PATCH', `/api/tasklists/${encodeURIComponent(list.id)}/items/${encodeURIComponent(item.id)}`, { title: next });
  const name = (await this.expanded.getAttribute('data-title')) ?? '';
  await this.page.reload();
  await this.settled();
  await expandTaskList(this, name);
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
  await this.page.addStyleTag({ content: '[data-testid="streak-message"], .drag-cat { display: none !important; }' });
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
