/** The Tasks view's toolbar sheets (ARCHITECTURE "Tasks filter"): open one, act in it, close it again with "Done". */
import { expect } from '@playwright/test';
import type { World } from './world.js';

export type SheetKind = 'filter' | 'sort';

/** Opens the filter or sort sheet (when it is not open), runs `act` inside it and closes it so the page is clickable again. */
export async function inSheet<T>(world: World, kind: SheetKind, act: () => Promise<T>): Promise<T> {
  const sheet = world.page.getByTestId(`tasks-${kind}-sheet`);
  if (!(await sheet.isVisible())) await world.page.getByTestId(`tasks-${kind}-open`).click();
  await expect(sheet).toBeVisible();
  const result = await act();
  await sheet.getByTestId('tasks-sheet-done').click();
  await expect(sheet).toHaveCount(0);
  return result;
}
