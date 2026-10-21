/** Time-grid geometry checks (week/day views). */
import { expect, type Locator } from '@playwright/test';
import { minutesOf } from './dates.js';
import type { World } from './world.js';

/** Assert a chip's top/height match the time grid for [from, to) within ±3 px. */
export async function expectPositioned(world: World, chip: Locator, from: string, to?: string) {
  const date = await chip.getAttribute('data-date');
  if (!date) throw new Error('chip has no data-date');
  const grid = world.page.getByTestId('time-grid').first();
  await expect(grid).toHaveAttribute('data-hour-height', /\d/);
  const hourHeight = Number(await grid.getAttribute('data-hour-height'));
  await expect
    .poll(async () => {
      const col = await world.dayColumn(date).boundingBox();
      const b = await chip.boundingBox();
      if (!col || !b) return 'chip or day column not visible';
      const wantTop = col.y + (minutesOf(from) / 60) * hourHeight;
      if (Math.abs(b.y - wantTop) > 3) return `top ${b.y.toFixed(1)} != expected ${wantTop.toFixed(1)}`;
      if (to !== undefined) {
        const wantHeight = ((minutesOf(to) - minutesOf(from)) / 60) * hourHeight;
        // no minimum height: every block is drawn at its real length (timeline.feature)
        if (Math.abs(b.height - wantHeight) > 3) return `height ${b.height.toFixed(1)} != expected ${wantHeight.toFixed(1)}`;
      }
      return 'ok';
    }, { message: `positioned from ${from}${to ? ` to ${to}` : ''}` })
    .toBe('ok');
}


/** Current hour height (px) of the time grid, from its `data-hour-height`. */
export async function gridHourHeight(world: World): Promise<number> {
  const grid = world.page.getByTestId('time-grid').first();
  await expect(grid).toHaveAttribute('data-hour-height', /\d/);
  return Number(await grid.getAttribute('data-hour-height'));
}
