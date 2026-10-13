/** Tasks canvas steps (STEPS.md "Tasks canvas"): the Canvas tab of the Tasks view with its sticky notes, areas, zoom and pan. */
import { expect, type Locator, type Page } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { box, expectJoined, pathname } from './support/ui.js';
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

/** A plain mouse drag from `from` to `to` (client px) in a few steps; `release` runs just before the button goes up. */
async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release?: () => void) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  release?.();
  await page.mouse.up();
}

/** Drag a note by its grip so that its top-left corner lands on (x, y) canvas units and wait for the saved place. */
async function moveNote(world: World, title: string, x: number, y: number) {
  const n = note(world, title);
  await expect(n).toBeVisible();
  const zoom = await num(viewport(world), 'data-zoom');
  const dx = (x - (await num(n, 'data-x'))) * zoom;
  const dy = (y - (await num(n, 'data-y'))) * zoom;
  const g = await box(n.getByTestId('canvas-note-grip'));
  const from = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  let saved: ReturnType<Page['waitForResponse']> | undefined;
  await mouseDrag(world.page, from, { x: from.x + dx, y: from.y + dy }, () => { saved = world.page.waitForResponse(isTasklistWrite('PATCH')); });
  expect((await saved!).status(), 'place saved').toBe(200);
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

When('I create the area {string} on the Canvas', async function (this: World, name: string) {
  await this.page.getByTestId('canvas-area-add').click();
  const name_ = this.page.getByTestId('canvas-area-name-input');
  await expect(name_).toBeVisible();
  await name_.fill(name);
  await name_.press('Enter');
  await expect(this.page.getByTestId('canvas-area-editor')).toHaveCount(0);
  // the answer of the last write is not a single response (the area was saved once when it was created), so ask the server
  await expect.poll(async () => (await this.api.get<{ areas: { name: string }[] }>('/api/canvas')).areas.map((a) => a.name)).toContain(name);
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
  await expect(area(this, name)).toBeVisible();
});

When('I pan the Canvas by {int}, {int} pixels', async function (this: World, dx: number, dy: number) {
  const b = await box(viewport(this));
  const from = { x: b.x + b.width * 0.6, y: b.y + b.height * 0.6 };
  await mouseDrag(this.page, from, { x: from.x + dx, y: from.y + dy });
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
