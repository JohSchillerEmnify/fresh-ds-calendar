import { expect, type Locator } from '@playwright/test';
import { box, touchDrag } from './ui.js';
import { attr, tid, type World } from './world.js';

/**
 * Open a task list's sheet: tap its card; when it grows over the calendar instead (Labs, feature tasklists-expand-card),
 * tap the grown card.
 * On phones a tap inside a month cell opens the day view instead (feature navigation); in that case the card is
 * tapped again in the day view.
 */
export async function expandTaskList(world: World, title: string) {
  const grown = world.byTestId('tasklist-expanded', attr('data-title', title) + attr('data-presentation', 'overlay'));
  const sheet = world.page.locator(`${tid('tasklist-expanded')}${attr('data-title', title)}:not(${attr('data-presentation', 'overlay')})`);
  // An open desktop tray that shows the list would reveal its row instead of opening the sheet: collapse it first.
  const tray = world.page.getByTestId('task-tray');
  if (!world.isPhoneProject && (await tray.isVisible()) && (await tray.getAttribute('data-expanded')) === 'true') {
    await world.page.getByTestId('task-tray-toggle').click();
    await expect(tray).toHaveAttribute('data-expanded', 'false');
  }
  const monthView = await world.page.getByTestId('month-view').isVisible();
  // Phone month chips are pointer-events:none by design (the cell takes the tap), so Playwright's hit-target check
  // would never pass: tap the card's position instead.
  const phoneMonth = monthView && world.isPhoneProject;
  // a card already grown (remembered, or grown earlier) lies over its own collapsed card: go straight to it
  // a remembered grown card may appear over the card while the click waits (a page just loaded): look again, then
  await expect(async () => { if (!(await grown.isVisible())) await world.taskCard(title).click({ force: phoneMonth, timeout: 2000 }); }).toPass();
  if (phoneMonth) {
    await expect(grown.or(world.page.getByTestId('day-view')).first()).toBeVisible();
    if (!(await grown.isVisible())) await world.taskCard(title).click();
  }
  // growing in place is a Labs setting (off by default) and a time block that already shows its whole title and every
  // open item does not grow: then the first tap opens the sheet
  await sheet.or(grown).first().waitFor();
  // the sheet slides in by spring: steps that measure rows (a long press, a held drag) need it at rest, as a finger would
  if (await sheet.isVisible()) return sheet.scrollIntoViewIfNeeded();
  // the very bottom edge of the grown card: a tap on its title row folds it back up instead, and a titles-only card has little but that row
  const card = grown.getByTestId('tasklist-card-grown');
  await card.click({ position: { x: 6, y: (await card.boundingBox())!.height - 1 } });
  await expect(sheet).toBeVisible();
  await sheet.scrollIntoViewIfNeeded();
}

/** Stable locator for an item: resolved once by title, then addressed by data-item-id (survives edit mode). */
export async function itemById(world: World, title: string) {
  const item = world.expandedItem(title);
  await expect(item).toHaveCount(1);
  const id = await item.getAttribute('data-item-id');
  return id ? world.expanded.locator(`${tid('tasklist-item')}${attr('data-item-id', id)}`) : item;
}

const isOrderPut = (r: { url(): string; request(): { method(): string } }) =>
  r.request().method() === 'PUT' && /\/api\/tasklists\/[^/]+\/items\/order$/.test(new URL(r.url()).pathname);

/** A trusted pen pointer (pointerType "pen") through the browser's own input, as a stylus on the handle would send; a pen picks a row up by a long press, like a finger. */
async function penDrag(world: World, grab: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await world.context.newCDPSession(world.page);
  const send = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', p: { x: number; y: number }) =>
    cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'pen' });
  await send('mouseMoved', grab);
  await send('mousePressed', grab);
  await world.page.waitForTimeout(500);
  for (let i = 1; i <= 10; i++) await send('mouseMoved', { x: grab.x, y: grab.y + ((to.y - grab.y) * i) / 10 });
  await send('mouseReleased', to);
  await cdp.detach().catch(() => {});
}

/** Where a sideways drag ends (one level = 28 px, the item stays on its row) and whether the level can change (not for the first item, nor deeper than the item above allows). */
async function sidewaysTarget(rows: Locator, from: number, grab: { x: number; y: number }, steps: number) {
  const level = Number(await rows.nth(from).getAttribute('data-level'));
  const above = from > 0 ? Number(await rows.nth(from - 1).getAttribute('data-level')) : -1;
  return { to: { x: grab.x + steps * 28, y: grab.y }, moves: Math.max(0, Math.min(level + steps, above + 1)) !== level };
}

type Drop = { above: string | number } | { below: string } | { sideways: number } | 'home';

/** Where the pointer lets go for `drop`, and whether the order or a level changes (then the order is saved). */
async function dropPoint(rows: Locator, from: number, place: (k: string | number) => number, grab: { x: number; y: number }, drop: Drop) {
  if (drop === 'home') return { to: { ...grab }, moves: false };
  if ('sideways' in drop) return sidewaysTarget(rows, from, grab, drop.sideways);
  // the lower edge of the item `below` (the dragged item and its subtasks land after it), or just above an item
  if ('below' in drop) {
    const lower = await box(rows.nth(place(drop.below)));
    return { to: { x: grab.x, y: lower.y + lower.height - 4 }, moves: true };
  }
  const at = place(drop.above);
  const tb = await box(rows.nth(at));
  // moving down, "above X" is the place of the item before X
  return { to: { x: grab.x, y: from < at ? tb.y - 4 : tb.y + 4 }, moves: at - (from < at ? 1 : 0) !== from };
}

/**
 * Drag the item `title` inside `list` (a `tasklist-view` or the sheet) and drop it where `drop` says: `above` an item (the place
 * just before it), or `home` (away and back). A mouse (or `byGrip`) grabs the drag handle; a finger long-presses the row,
 * as the calendar's drag steps do. Waits for the saved order (`PUT .../items/order`) unless the drop changes nothing.
 */
export async function dragItem(world: World, list: Locator, title: string | number, drop: Drop, byGrip: boolean | 'pen' = false) {
  const rows = list.getByTestId('tasklist-item');
  // a number is the 0-based place of the row (an ink item has no title to find it by)
  const row = typeof title === 'number' ? rows.nth(title) : rows.filter({ has: world.page.locator(attr('data-title', title)) }).or(rows.and(world.page.locator(attr('data-title', title)))).first();
  await row.scrollIntoViewIfNeeded();
  const titles: (string | number | null)[] = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  const place = (k: string | number) => (typeof k === 'number' ? k : titles.indexOf(k));
  const from = place(title);
  const touch = !!world.testInfo.project.use.hasTouch;
  const rb = await box(row);
  const grab = touch && !byGrip ? { x: rb.x + rb.width * 0.5, y: rb.y + rb.height / 2 } : await box(row.getByTestId('tasklist-item-grip')).then((g) => ({ x: g.x + g.width / 2, y: g.y + g.height / 2 }));
  const { to, moves } = await dropPoint(rows, from, place, grab, drop);
  const saved = moves ? world.page.waitForResponse(isOrderPut) : null;
  if (byGrip === 'pen') {
    await penDrag(world, grab, to);
  } else if (touch) {
    await touchDrag(world.page, grab, to, { steps: 10, durationMs: 300, holdMs: 500 });
  } else {
    const { mouse } = world.page;
    await mouse.move(grab.x, grab.y);
    await mouse.down();
    if (drop === 'home') await mouse.move(grab.x, grab.y + 30, { steps: 5 });
    await mouse.move(to.x, to.y, { steps: 10 });
    await mouse.up();
  }
  if (saved) expect((await saved).status(), 'order saved').toBe(200);
  await expect(list.locator('[data-testid="tasklist-item"][data-dragging]:not([data-dragging="false"])')).toHaveCount(0);
}
