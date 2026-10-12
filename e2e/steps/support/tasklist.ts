import { expect } from '@playwright/test';
import { attr, type World } from './world.js';

/**
 * Expand a task list by tapping its card. On phones a tap inside a month cell opens the day view instead (ARCHITECTURE
 * §5); in that case the card is tapped again in the day view.
 */
export async function expandTaskList(world: World, title: string) {
  const expanded = world.byTestId('tasklist-expanded', attr('data-title', title));
  const monthView = await world.page.getByTestId('month-view').isVisible();
  await world.taskCard(title).click();
  if (monthView && world.isPhoneProject) {
    await expect(expanded.or(world.page.getByTestId('day-view')).first()).toBeVisible();
    if (!(await expanded.isVisible())) await world.taskCard(title).click();
  }
  await expect(expanded).toBeVisible();
}
