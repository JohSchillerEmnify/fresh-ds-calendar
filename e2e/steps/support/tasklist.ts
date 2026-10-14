import { expect } from '@playwright/test';
import { attr, tid, type World } from './world.js';

/**
 * Open a task list's sheet: tap its card (it grows over the calendar), then tap the grown card (ARCHITECTURE "Expanded task
 * list card"). On phones a tap inside a month cell opens the day view instead (ARCHITECTURE §5); in that case the card is
 * tapped again in the day view.
 */
export async function expandTaskList(world: World, title: string) {
  const grown = world.byTestId('tasklist-expanded', attr('data-title', title) + attr('data-presentation', 'overlay'));
  const sheet = world.page.locator(`${tid('tasklist-expanded')}${attr('data-title', title)}:not(${attr('data-presentation', 'overlay')})`);
  const monthView = await world.page.getByTestId('month-view').isVisible();
  // Phone month chips are pointer-events:none by design (the cell takes the tap), so Playwright's hit-target check
  // would never pass: tap the card's position instead.
  const phoneMonth = monthView && world.isPhoneProject;
  await world.taskCard(title).click({ force: phoneMonth });
  if (phoneMonth) {
    await expect(grown.or(world.page.getByTestId('day-view')).first()).toBeVisible();
    if (!(await grown.isVisible())) await world.taskCard(title).click();
  }
  await expect(grown).toBeVisible();
  await grown.getByTestId('tasklist-card-grown').click();
  await expect(sheet).toBeVisible();
}

/** Stable locator for an item: resolved once by title, then addressed by data-item-id (survives edit mode). */
export async function itemById(world: World, title: string) {
  const item = world.expandedItem(title);
  await expect(item).toHaveCount(1);
  const id = await item.getAttribute('data-item-id');
  return id ? world.expanded.locator(`${tid('tasklist-item')}${attr('data-item-id', id)}`) : item;
}
