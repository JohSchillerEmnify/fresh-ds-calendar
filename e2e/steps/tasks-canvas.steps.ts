/** Tasks canvas steps (STEPS.md "Tasks canvas"): the Canvas tab of the Tasks view with its sticky notes, areas, zoom and pan. */
import { expect, type Locator, type Page } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, expectJoined, pathname, touchDrag } from './support/ui.js';
import { dragItem } from './support/tasklist.js';
import { attr, type World } from './support/world.js';

const isTasklistWrite = (method: string, tail = '') => (r: { url(): string; request(): { method(): string } }) =>
  new RegExp(`^/api/tasklists/[^/]+${tail}$`).test(new URL(r.url()).pathname) && r.request().method() === method;

/** Show the Tasks view (through the navigation when the app is open, else by its path) and its Canvas tab. */
async function openCanvas(world: World) {
  if (pathname(world.page) !== '/tasks') {
    const nav = world.page.getByTestId('view-switch-tasks');
    if (world.page.url().startsWith('http') && (await nav.isVisible())) await nav.click();
    else await world.page.goto('/tasks');
  }
  await expect(world.page.getByTestId('tasks-view')).toBeVisible();
  const tab = world.page.getByTestId('tasks-tab-canvas');
  if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await expect(world.page.getByTestId('tasks-canvas')).toBeVisible();
}

const viewport = (w: World): Locator => w.page.getByTestId('canvas-viewport');
const note = (w: World, title: string): Locator => w.byTestId('canvas-note', attr('data-title', title));
const area = (w: World, name: string): Locator => w.byTestId('canvas-area', attr('data-name', name));
const num = async (loc: Locator, name: string): Promise<number> => Number(await loc.getAttribute(name));

interface Pt { x: number; y: number }
const useTouch = (w: World) => !!w.testInfo.project.use.hasTouch;
const centre = (b: { x: number; y: number; width: number; height: number }): Pt => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Phones: a finger through CDP, with a long press first when `hold`; otherwise a plain mouse drag. */
async function dragBetween(w: World, from: Pt, to: Pt, hold = false) {
  if (useTouch(w)) {
    await touchDrag(w.page, from, to, { steps: 10, durationMs: 300, holdMs: hold ? 500 : 0 });
    return;
  }
  await w.page.mouse.move(from.x, from.y);
  await w.page.mouse.down();
  await w.page.mouse.move(to.x, to.y, { steps: 8 });
  await w.page.mouse.up();
}

/** Where a note is grabbed: with a finger anywhere (the middle of the note), with the mouse by its top strip. */
async function grabNote(w: World, n: Locator): Promise<Pt> {
  return useTouch(w) ? centre(await box(n)) : centre(await box(n.getByTestId('canvas-note-grip')));
}

/** Drag a note so that its top-left corner lands on (x, y) canvas units and wait for the saved place. */
async function moveNote(world: World, title: string, x: number, y: number) {
  const n = note(world, title);
  await expect(n).toBeVisible();
  const zoom = await num(viewport(world), 'data-zoom');
  const dx = (x - (await num(n, 'data-x'))) * zoom;
  const dy = (y - (await num(n, 'data-y'))) * zoom;
  const from = await grabNote(world, n);
  const saved = world.page.waitForResponse(isTasklistWrite('PATCH'));
  await dragBetween(world, from, { x: from.x + dx, y: from.y + dy }, true);
  expect((await saved).status(), 'place saved').toBe(200);
}

When('I open the Canvas', async function (this: World) {
  await openCanvas(this);
});

Then('the Canvas shows the notes {string}', async function (this: World, titles: string) {
  await expect
    .poll(async () => (await this.byTestId('canvas-note').evaluateAll((els) => els.map((e) => e.getAttribute('data-title') ?? ''))).sort().join(', '))
    .toBe(titles);
});

Then('the Canvas does not show the note {string}', async function (this: World, title: string) {
  await expect(note(this, title)).toHaveCount(0);
});

Then('the note {string} shows the date {date}', async function (this: World, title: string, date: string) {
  const n = note(this, title);
  await expect(n).toHaveAttribute('data-date', date);
  await expect(n.getByTestId('canvas-note-date')).toBeVisible();
});

Then('the note {string} shows the items {string}', async function (this: World, title: string, items: string) {
  await expectJoined(note(this, title).getByTestId('tasklist-item'), items, 'data-title');
});

When('I move the note {string} to {int}, {int} on the Canvas', async function (this: World, title: string, x: number, y: number) {
  await moveNote(this, title, x, y);
});

Then('the note {string} is at {int}, {int} on the Canvas', async function (this: World, title: string, x: number, y: number) {
  const n = note(this, title);
  await expect(n).toHaveAttribute('data-placed', 'true');
  await expect(n).toHaveAttribute('data-x', String(x));
  await expect(n).toHaveAttribute('data-y', String(y));
});

Then('the note {string} is in the Unsorted stack', async function (this: World, title: string) {
  await expect(note(this, title)).toHaveAttribute('data-placed', 'false');
});

Then('the note {string} is not in the Unsorted stack', async function (this: World, title: string) {
  await expect(note(this, title)).toHaveAttribute('data-placed', 'true');
});

When('I tick the item {string} of the note {string} on the Canvas', async function (this: World, itemTitle: string, title: string) {
  const row = note(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  await expect(row).toHaveAttribute('data-done', 'false');
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH', '/items/[^/]+'));
  await row.getByTestId('tasklist-item-checkbox').click();
  expect((await saved).status(), 'tick saved').toBe(200);
});

When('I drag the item {string} above the item {string} of the note {string} on the Canvas', async function (this: World, title: string, above: string, noteTitle: string) {
  const at = async () => [await note(this, noteTitle).getAttribute('data-x'), await note(this, noteTitle).getAttribute('data-y')];
  const before = await at();
  await dragItem(this, note(this, noteTitle), title, { above }, true);
  expect(await at(), 'the note stayed where it was').toEqual(before);
});

Then('the note {string} on the Canvas shows the items {string}', async function (this: World, noteTitle: string, items: string) {
  await expectJoined(note(this, noteTitle).getByTestId('tasklist-item'), items, 'data-title');
});

When('I create the area {string} on the Canvas', async function (this: World, name: string) {
  await this.page.getByTestId('canvas-area-add').click();
  const name_ = this.page.getByTestId('canvas-area-name-input');
  await expect(name_).toBeVisible();
  await name_.fill(name);
  await name_.press('Enter');
  await expect(this.page.getByTestId('canvas-area-editor')).toHaveCount(0);
  // the answer of the last write is not a single response (the area was saved once when it was created), so ask the server
  // (the page's own request context carries the session cookie, so this also works while sign-in is on)
  await expect.poll(async () => ((await (await this.page.request.get('/api/canvas')).json()) as { areas: { name: string }[] }).areas.map((a) => a.name)).toContain(name);
});

interface SavedArea { id: string; name: string; color: string; x: number; y: number; w: number; h: number }
const savedAreas = async (w: World): Promise<SavedArea[]> => (await w.api.get<{ areas: SavedArea[] }>('/api/canvas')).areas;

/** Fixture: the area (300, 200, 480 x 360) through `PUT /api/canvas` and the note placed 20, 56 inside it (as "into the area"). */
Given('the Canvas has the area {string} with the note {string} in it', async function (this: World, name: string, title: string) {
  const a = { id: 'fixture-area', name, color: '#43a047', x: 300, y: 200, w: 480, h: 360 };
  await this.api.put('/api/canvas', { areas: [...(await savedAreas(this)), a] });
  const lists = (await this.api.get<{ items: { id: string; title: string }[] }>('/api/tasklists/all-open')).items;
  const list = lists.find((l) => l.title === title);
  if (!list) throw new Error(`no open task list "${title}"`);
  await this.api.patch(`/api/tasklists/${list.id}`, { canvas: { x: a.x + 20, y: a.y + 56 } });
});

/** Opens the area's editor with a tap on its header, deletes it there and waits until the server no longer has it. */
When('I delete the area {string} on the Canvas', async function (this: World, name: string) {
  await openCanvas(this);
  const a = area(this, name);
  await expect(a).toBeVisible();
  // the premise: the fixture's note lies in the area before it goes
  const placedHere = this.byTestId('canvas-note', attr('data-area', name));
  await expect(placedHere.first()).toBeVisible();
  await a.getByTestId('canvas-area-header').click();
  await this.page.getByTestId('canvas-area-delete').click();
  await expect(a).toHaveCount(0);
  await expect.poll(async () => (await savedAreas(this)).map((x) => x.name)).not.toContain(name);
});

Then('the note {string} is in no area', async function (this: World, title: string) {
  await expect(note(this, title)).toBeVisible();
  await expect(note(this, title)).not.toHaveAttribute('data-area', /./);
});

/** Where each area was before the last long-press drag ("has moved by"). */
const areaBefore = new WeakMap<World, Pt>();

When('I long-press the area {string} and drag it by {int}, {int} pixels', async function (this: World, name: string, dx: number, dy: number) {
  const a = area(this, name);
  await expect(a).toBeVisible();
  areaBefore.set(this, { x: await num(a, 'data-x'), y: await num(a, 'data-y') });
  const b = await box(a);
  // the body of the area, away from its header and handles (as "release without moving")
  const from = { x: b.x + b.width / 2, y: b.y + b.height * 0.7 };
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy }, true);
});

Then('the area {string} has moved by {int}, {int} on the Canvas', async function (this: World, name: string, dx: number, dy: number) {
  const was = areaBefore.get(this);
  if (!was) throw new Error('needs "I long-press the area ... and drag it by ..." first');
  const a = area(this, name);
  const zoom = await num(viewport(this), 'data-zoom');
  const want = { x: Math.round(was.x + dx / zoom), y: Math.round(was.y + dy / zoom) };
  const near = (v: number, w: number) => Math.abs(v - w) <= 1;
  await expect.poll(async () => near(await num(a, 'data-x'), want.x) && near(await num(a, 'data-y'), want.y), `moved to ${want.x}, ${want.y}`).toBe(true);
  // and saved
  await expect.poll(async () => {
    const s = (await savedAreas(this)).find((x) => x.name === name);
    return !!s && near(s.x, want.x) && near(s.y, want.y);
  }, 'saved').toBe(true);
});

When('I move the note {string} into the area {string} on the Canvas', async function (this: World, title: string, name: string) {
  const a = area(this, name);
  await expect(a).toBeVisible();
  await moveNote(this, title, (await num(a, 'data-x')) + 20, (await num(a, 'data-y')) + 56);
});

Then('the note {string} is in the area {string}', async function (this: World, title: string, name: string) {
  await expect(note(this, title)).toHaveAttribute('data-area', name);
});

Then('the Canvas shows the area {string}', async function (this: World, name: string) {
  // a reopened app starts on the Open tab: the person opens the Canvas tab first
  if (!(await this.page.getByTestId('tasks-canvas').isVisible())) await openCanvas(this);
  await expect(area(this, name)).toBeVisible();
});

When('I pan the Canvas by {int}, {int} pixels', async function (this: World, dx: number, dy: number) {
  const b = await box(viewport(this));
  const from = { x: b.x + b.width * 0.6, y: b.y + b.height * 0.6 };
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy });
});

Then('the Canvas is panned to {int}, {int}', async function (this: World, x: number, y: number) {
  await expect(viewport(this)).toHaveAttribute('data-pan-x', String(x));
  await expect(viewport(this)).toHaveAttribute('data-pan-y', String(y));
});

When('I zoom the Canvas in with Ctrl+wheel', async function (this: World) {
  const before = await num(viewport(this), 'data-zoom');
  // the wheel event is dispatched on the page, as the time grid's zoom step does (Control held for the whole turn)
  await viewport(this).evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => num(viewport(this), 'data-zoom')).toBeGreaterThan(before);
  // the view is remembered a moment after the last change
  await expect.poll(() => this.page.evaluate(() => JSON.parse(localStorage.getItem('cal.canvasView') ?? '{}').zoom as number)).toBeGreaterThan(before);
});

Then('the Canvas zoom is above {float}', async function (this: World, zoom: number) {
  await expect.poll(() => num(viewport(this), 'data-zoom')).toBeGreaterThan(zoom);
});

When('I long-press the note {string} on its first item and drag it to {int}, {int}', async function (this: World, title: string, x: number, y: number) {
  const n = note(this, title);
  await expect(n).toBeVisible();
  const zoom = await num(viewport(this), 'data-zoom');
  const dx = (x - (await num(n, 'data-x'))) * zoom;
  const dy = (y - (await num(n, 'data-y'))) * zoom;
  const from = centre(await box(n.getByTestId('tasklist-item-title').first()));
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy }, true);
  expect((await saved).status(), 'place saved').toBe(200);
});

When('I long-press the item {string} of the note {string} and drag the note to {int}, {int}', async function (this: World, itemTitle: string, title: string, x: number, y: number) {
  const n = note(this, title);
  await expect(n).toBeVisible();
  const zoom = await num(viewport(this), 'data-zoom');
  const dx = (x - (await num(n, 'data-x'))) * zoom;
  const dy = (y - (await num(n, 'data-y'))) * zoom;
  const row = n.getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  const from = centre(await box(row.getByTestId('tasklist-item-title')));
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy }, true);
  expect((await saved).status(), 'place saved').toBe(200);
});

When('I long-press the checkbox of the item {string} of the note {string} and drag the note to {int}, {int}', async function (this: World, itemTitle: string, title: string, x: number, y: number) {
  const n = note(this, title);
  await expect(n).toBeVisible();
  const zoom = await num(viewport(this), 'data-zoom');
  const dx = (x - (await num(n, 'data-x'))) * zoom;
  const dy = (y - (await num(n, 'data-y'))) * zoom;
  const row = n.getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)));
  const from = centre(await box(row.getByTestId('tasklist-item-checkbox')));
  const saved = this.page.waitForResponse(isTasklistWrite('PATCH'));
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy }, true);
  expect((await saved).status(), 'place saved').toBe(200);
});

Then('the item {string} of the note {string} is not ticked', async function (this: World, itemTitle: string, title: string) {
  await expect(note(this, title).getByTestId('tasklist-item').and(this.page.locator(attr('data-title', itemTitle)))).toHaveAttribute('data-done', 'false');
});

When('I swipe across the note {string} on the Canvas', async function (this: World, title: string) {
  const n = note(this, title);
  await expect(n).toBeVisible();
  const from = centre(await box(n));
  await dragBetween(this, from, { x: from.x + 60, y: from.y + 80 });
});

When('I tap the empty Canvas', async function (this: World) {
  const b = await box(viewport(this));
  // lower middle: the floating list tools sit bottom left and the create button bottom right
  await this.page.mouse.click(b.x + b.width * 0.6, b.y + b.height * 0.85);
});

When('I long-press the area {string} and release without moving', async function (this: World, name: string) {
  const a = area(this, name);
  await expect(a).toBeVisible();
  const b = await box(a);
  // the body of the area, away from the header and handles; a mouse has no long press, a click on the header does the same
  if (!useTouch(this)) {
    await a.getByTestId('canvas-area-header').click();
    await this.page.getByTestId('canvas-area-editor-close').click();
    return;
  }
  const cdp = await this.context.newCDPSession(this.page);
  try {
    const touch = [{ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height * 0.7), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch });
    await this.page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
});

Then('the area {string} shows resize handles', async function (this: World, name: string) {
  await expect(area(this, name).getByTestId('canvas-area-handle')).toHaveCount(4);
});

Then('the area {string} shows no resize handles', async function (this: World, name: string) {
  await expect(area(this, name)).toBeVisible();
  await expect(area(this, name).getByTestId('canvas-area-handle')).toHaveCount(0);
});

When('I drag the bottom right handle of the area {string} by {int}, {int} pixels', async function (this: World, name: string, dx: number, dy: number) {
  const handle = area(this, name).locator('[data-testid="canvas-area-handle"][data-corner="se"]');
  const from = centre(await box(handle));
  await dragBetween(this, from, { x: from.x + dx, y: from.y + dy });
});

Then('the area {string} is {int} wide and {int} high', async function (this: World, name: string, w: number, h: number) {
  await expect(area(this, name)).toHaveAttribute('data-w', String(w));
  await expect(area(this, name)).toHaveAttribute('data-h', String(h));
  // and saved
  await expect.poll(async () => (await this.api.get<{ areas: { name: string; w: number; h: number }[] }>('/api/canvas')).areas.find((a) => a.name === name)).toMatchObject({ w, h });
});

/** A phone's page can scroll a little (the browser's address bar collapses), so a native pan can start and cancel a touch. */
When('the page is a little taller than the screen', async function (this: World) {
  // an invisible 1 px box below the screen gives the document scroll range without moving anything
  await this.page.evaluate(() => {
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;left:0;top:calc(100dvh + 120px);width:1px;height:1px;pointer-events:none';
    document.body.appendChild(pad);
  });
  expect(await this.page.evaluate(() => document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight)).toBe(true);
});

When('I add an area on the Canvas', async function (this: World) {
  await this.page.getByTestId('canvas-area-add').click();
  await expect(this.page.getByTestId('canvas-area-editor')).toBeVisible();
});

const PANELS: Record<string, string> = { 'writing area': 'tasklist-dialog', 'area editor': 'canvas-area-editor', 'filter sheet': 'tasks-filter-sheet', 'sort sheet': 'tasks-sort-sheet', 'install sheet': 'ios-install-sheet', 'view switcher': 'view-switcher', 'expanded task list': 'tasklist-expanded', 'app update hint': 'apk-available', 'release note': 'whats-new-note' };

Then('the add button covers no control of the {string}', async function (this: World, panel: string) {
  const fab = this.page.getByTestId('create-button');
  const buttons = this.page.getByTestId(PANELS[panel]!).locator('button');
  const covered = async () => {
    const f = (await fab.isVisible()) ? await fab.boundingBox() : null;
    if (!f) return [];
    const hits: string[] = [];
    for (const b of await buttons.all()) {
      const r = await b.boundingBox();
      if (r && r.x < f.x + f.width && f.x < r.x + r.width && r.y < f.y + f.height && f.y < r.y + r.height) hits.push((await b.getAttribute('data-testid')) ?? 'button');
    }
    return hits;
  };
  // the button slides out over a fraction of a second
  await expect.poll(covered).toEqual([]);
});
