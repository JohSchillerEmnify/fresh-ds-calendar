import { expect, type Locator } from '@playwright/test';
import { box, touchDrag } from './ui.js';
import { attr, tid, type World } from './world.js';

/**
 * Open a task list's sheet: tap its card (it grows over the calendar), then tap the grown card (feature tasklists-expand-card).
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
  await world.taskCard(title).click({ force: phoneMonth });
  if (phoneMonth) {
    await expect(grown.or(world.page.getByTestId('day-view')).first()).toBeVisible();
    if (!(await grown.isVisible())) await world.taskCard(title).click();
  }
  // growing in place is a Labs setting (off by default) and a time block that already shows its whole title and every
  // open item does not grow: then the first tap opens the sheet
  await sheet.or(grown).first().waitFor();
  if (await sheet.isVisible()) return;
  // the very bottom edge of the grown card: a tap on its title row folds it back up instead, and a titles-only card has little but that row
  const card = grown.getByTestId('tasklist-card-grown');
  await card.click({ position: { x: 6, y: (await card.boundingBox())!.height - 1 } });
  await expect(sheet).toBeVisible();
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

/**
 * Drag the item `title` inside `list` (a `tasklist-view` or the sheet) and drop it where `drop` says: `above` an item (the place
 * just before it), or `home` (away and back). A mouse (or `byGrip`) grabs the drag handle; a finger long-presses the row,
 * as the calendar's drag steps do. Waits for the saved order (`PUT .../items/order`) unless the drop changes nothing.
 */
export async function dragItem(world: World, list: Locator, title: string, drop: { above: string } | 'home', byGrip = false) {
  const rows = list.getByTestId('tasklist-item');
  const row = rows.filter({ has: world.page.locator(attr('data-title', title)) }).or(rows.and(world.page.locator(attr('data-title', title)))).first();
  await row.scrollIntoViewIfNeeded();
  const titles = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  const touch = !!world.testInfo.project.use.hasTouch;
  const rb = await box(row);
  const grab = touch && !byGrip ? { x: rb.x + rb.width * 0.5, y: rb.y + rb.height / 2 } : await box(row.getByTestId('tasklist-item-grip')).then((g) => ({ x: g.x + g.width / 2, y: g.y + g.height / 2 }));
  let to = { ...grab };
  let moves = false;
  if (drop !== 'home') {
    const target = rows.nth(titles.indexOf(drop.above));
    const tb = await box(target);
    // moving down, "above X" is the place of the item before X
    to = { x: grab.x, y: titles.indexOf(title) < titles.indexOf(drop.above) ? tb.y - 4 : tb.y + 4 };
    moves = titles.indexOf(drop.above) - (titles.indexOf(title) < titles.indexOf(drop.above) ? 1 : 0) !== titles.indexOf(title);
  }
  const saved = moves ? world.page.waitForResponse(isOrderPut) : null;
  if (touch) {
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
