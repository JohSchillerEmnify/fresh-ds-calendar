/** Wheel scrolling over the main scrolling area, shared by the steps that hide the bottom bar. */
import { box } from './ui.js';
import type { World } from './world.js';

/** Turns the wheel over the calendar (or the Tasks view) in steps, like a person's flick. */
export async function wheel(w: World, dy: number) {
  const area = w.page.locator('[data-scroll-area]').first();
  const b = await box(area);
  await w.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 60));
  for (let i = 0; i < steps; i++) {
    await w.page.mouse.wheel(0, dy / steps);
    await w.page.waitForTimeout(30);
  }
}
