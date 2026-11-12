/** Entry type scale steps (feature entry-scale): the computed text of an entry in the month, week and day views. */
import { expect, type Locator } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import type { View } from './parameters.js';
import type { World } from './support/world.js';

/** Opens a view on the date the way a person navigates to it. */
async function open(w: World, view: View, date: string): Promise<void> {
  await w.page.goto(`/${view}/${view === 'month' ? date.slice(0, 7) : date}`);
  await w.settled();
}

/** The first visible title of the entry as any of the three renderers draws it (chip or block, bar, task list card). */
function titleOf(w: World, name: string): Locator {
  const q = (id: string, inner: string) => `[data-testid="${id}"][data-title=${JSON.stringify(name)}] [data-testid="${inner}"]`;
  return w.page.locator([q('event-chip', 'event-chip-title'), q('event-bar', 'event-bar-title'), q('tasklist-card', 'tasklist-card-title')].join(', ')).locator('visible=true').first();
}

Given('the density is {string}', async function (this: World, density: string) {
  await this.api.patch('/api/prefs/theme', { overrides: { density: density.toLowerCase() } });
});

Then('in the {view} view of {date} the title of {string} is {float} px at weight {int}', async function (this: World, view: View, date: string, name: string, px: number, weight: number) {
  await open(this, view, date);
  const title = titleOf(this, name);
  await expect(title).toBeVisible();
  await expect.poll(() => title.evaluate((n) => parseFloat(getComputedStyle(n).fontSize))).toBeCloseTo(px, 1);
  expect(await title.evaluate((n) => getComputedStyle(n).fontWeight)).toBe(String(weight));
});

Then('in the {view} view of {date} the title of {string} fades out instead of ending in an ellipsis', async function (this: World, view: View, date: string, name: string) {
  await open(this, view, date);
  const title = titleOf(this, name);
  await expect(title).toBeVisible();
  const style = await title.evaluate((n) => { const s = getComputedStyle(n); return { overflow: s.textOverflow, clamp: s.webkitLineClamp }; });
  expect(style.overflow).toBe('clip');
  // a line clamp draws its own ellipsis whatever text-overflow says
  expect(style.clamp).toBe('none');
  // the fade sits on the title or, on a task list card, on its text once that is measured as cut
  const masked = () => title.evaluate((n) => [n, ...n.querySelectorAll('.tx')].some((e) => { const s = getComputedStyle(e); return (s.maskImage || s.webkitMaskImage) !== 'none'; }));
  await expect.poll(masked).toBe(true);
});

Then('in the {view} view of {date} the title of {string} shows in full without a fade', async function (this: World, view: View, date: string, name: string) {
  await open(this, view, date);
  const title = titleOf(this, name);
  await expect(title).toBeVisible();
  await this.settled();
  const state = () => title.evaluate((n) => ({ fits: n.scrollWidth <= n.clientWidth, masked: [n, ...n.querySelectorAll('.tx')].some((e) => { const s = getComputedStyle(e); return (s.maskImage || s.webkitMaskImage) !== 'none'; }) }));
  await expect.poll(state).toEqual({ fits: true, masked: false });
});

Then('in the {view} view of {date} the marker of {string} is {float} px', async function (this: World, view: View, date: string, name: string, px: number) {
  await open(this, view, date);
  const marker = this.page.locator(`[data-title=${JSON.stringify(name)}] [data-testid="event-marker"]`).locator('visible=true').first();
  await expect(marker).toBeVisible();
  await expect.poll(() => marker.evaluate((n) => parseFloat(getComputedStyle(n).fontSize))).toBeCloseTo(px, 1);
});
