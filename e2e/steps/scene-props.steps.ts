/**
 * Fall and Winter props, their resting leaves and snowflakes, the glide and the left-handed flip (theme-scenes.feature,
 * the two rules at the end; STEPS.md "Scenes and the support cat").
 */
import { expect, type Page } from '@playwright/test';
import { Then } from './fixtures.js';
import type { World } from './support/world.js';

/** A part's `data-part` name from its label: lowercased and hyphenated. */
const partName = (label: string) => label.trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-');

/** The particles of a kind: Fall's leaves, Winter's or Christmas's snowflakes. */
const PARTICLES: Record<string, string> = { leaves: '.season.fall .p', snowflakes: '.season.winter .p, .season.christmas .p' };
const particles = (kind: string) => {
  const sel = PARTICLES[kind];
  if (!sel) throw new Error(`Unknown particles "${kind}"`);
  return `[data-testid="top-bar-scene"] :is(${sel})`;
};

/** The full heights of the props (px), and the kite's. */
const FULL: Record<string, number> = { 'autumn-tree': 36, 'snowy-tree': 36, snowman: 42, 'leaf-pile': 13, sledge: 13, kite: 20 };

/** The boxes of the particles of a kind: position, visibility and whether an animation runs on them. */
async function readParticles(page: Page, kind: string) {
  return page.locator(particles(kind)).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, shown: getComputedStyle(el).visibility !== 'hidden', running: el.getAnimations().filter((a) => a.playState === 'running').length };
  }));
}

const barBox = async (w: World) => {
  const b = await w.page.getByTestId('top-bar').boundingBox();
  if (!b) throw new Error('the top bar has no box');
  return b;
};

Then('the top bar scene shows the {string}', async function (this: World, label: string) {
  // a part left out where it would be under a control carries data-hidden; another one of its kind may show
  const el = this.page.getByTestId('top-bar-scene').locator(`[data-part="${partName(label)}"]:not([data-hidden])`).first();
  await expect(el, label).toBeVisible();
  const bar = await barBox(this);
  // a visitor flies in from outside the bar: wait for it to come in
  await expect.poll(async () => {
    const b = await el.boundingBox();
    return !!b && Math.min(b.x + b.width, bar.x + bar.width) - Math.max(b.x, bar.x) >= 1 && Math.min(b.y + b.height, bar.y + bar.height) - Math.max(b.y, bar.y) >= 1;
  }, { message: `${label} inside the top bar` }).toBe(true);
});

Then('the top bar scene does not show the {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId('top-bar-scene').locator('[data-part]').first()).toBeAttached();
  const part = partName(label);
  const sel = part === 'hare' ? '.tbs .hare' : `[data-testid="top-bar-scene"] [data-part="${part}"]`;
  await expect(this.page.locator(`${sel} >> visible=true`)).toHaveCount(0);
});

Then('the {string} of the top bar scene is drawn at its full size', async function (this: World, label: string) {
  const part = partName(label);
  const full = FULL[part];
  if (!full) throw new Error(`No full size for "${label}"`);
  const bar = await barBox(this);
  const boxes = await this.page.locator(`[data-testid="top-bar-scene"] [data-part="${part}"] >> visible=true`).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; }));
  expect(boxes.length, `visible ${label}`).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.h, `${label} height`).toBeGreaterThanOrEqual(full - 0.5);
    // the kite hangs from the sky, inside the bar; everything else stands on the bar's bottom edge
    if (part === 'kite') expect(b.top, `${label} top`).toBeGreaterThanOrEqual(bar.y);
    // standing on the bottom edge; a prop may sink below it (the bar cuts it there), never float above it
    else {
      const lift = bar.y + bar.height - b.bottom;
      expect(lift, `${label} above the bottom edge`).toBeLessThanOrEqual(1);
      // the deepest a prop stands is the one-row sledge, 2 px below the edge
      expect(lift, `${label} sunk below the bottom edge`).toBeGreaterThanOrEqual(-2.5);
    }
  }
});

Then('the {string} of the top bar scene runs the full width of the bar', async function (this: World, label: string) {
  const el = this.page.getByTestId('top-bar-scene').locator(`[data-part="${partName(label)}"]`).first();
  await expect(el).toBeVisible();
  const [b, bar] = [await el.boundingBox(), await barBox(this)];
  expect(b, label).not.toBeNull();
  expect(b!.x, `${label} left`).toBeLessThanOrEqual(bar.x + 1);
  expect(b!.x + b!.width, `${label} right`).toBeGreaterThanOrEqual(bar.x + bar.width - 1);
  expect(Math.abs(b!.y + b!.height - (bar.y + bar.height)), `${label} bottom`).toBeLessThanOrEqual(1);
});

Then('the top bar scene shows {int} {string} at rest', async function (this: World, n: number, kind: string) {
  await expect(this.page.locator(particles(kind))).toHaveCount(n);
  // the glide runs on the page's animation timeline (real time): wait until nothing moves
  await expect.poll(async () => (await readParticles(this.page, kind)).reduce((s, p) => s + p.running, 0), { message: `running ${kind} animations` }).toBe(0);
  const bar = await barBox(this);
  const first = await readParticles(this.page, kind);
  for (const [i, p] of first.entries()) {
    expect(p.shown, `${kind} ${i} shown`).toBe(true);
    const inside = p.x >= bar.x && p.x + p.w <= bar.x + bar.width && p.y >= bar.y + 1 && p.y + p.h <= bar.y + bar.height;
    expect(inside, `${kind} ${i} at ${Math.round(p.x - bar.x)},${Math.round(p.y - bar.y)} inside the bar`).toBe(true);
  }
  await this.page.waitForTimeout(500);
  expect(await readParticles(this.page, kind), `${kind} still`).toEqual(first);
});

Then('the {string} of the top bar scene are spread over the whole bar', async function (this: World, kind: string) {
  const bar = await barBox(this);
  const ps = (await readParticles(this.page, kind)).filter((p) => p.shown);
  const left = Math.min(...ps.map((p) => p.x)) - bar.x, right = bar.x + bar.width - Math.max(...ps.map((p) => p.x + p.w));
  expect(left, `${kind}: room left of the leftmost`).toBeLessThanOrEqual(bar.width / 4);
  expect(right, `${kind}: room right of the rightmost`).toBeLessThanOrEqual(bar.width / 4);
});

Then('the {string} of the top bar scene glide to their resting spots within {int} second(s)', async function (this: World, kind: string, seconds: number) {
  await expect(this.page.locator('html')).toHaveAttribute('data-scenes', 'still');
  // read the glides themselves (not positions over real time, which a slow machine would make flaky)
  const glides = await this.page.locator(particles(kind)).evaluateAll((els) => els.map((el) => {
    const a = el.getAnimations().find((x) => !('animationName' in x));
    const first = a ? (a.effect as KeyframeEffect).getKeyframes()[0] : null;
    return { duration: Number(a?.effect?.getTiming().duration ?? 0), from: String(first?.translate ?? '') };
  }));
  expect(glides.every((g) => g.duration > 0 && g.duration <= seconds * 1000), `every ${kind} glides within ${seconds} s: ${JSON.stringify(glides)}`).toBe(true);
  const moving = glides.filter((g) => g.from.split(/\s+/).some((v) => Math.abs(parseFloat(v)) > 0.5)).length;
  expect(moving, `${kind} that start away from their spot`).toBeGreaterThanOrEqual(7);
  // the glide runs on the page's animation timeline, which the fake clock does not drive
  await expect.poll(async () => (await readParticles(this.page, kind)).reduce((s, p) => s + p.running, 0), { message: `${kind} still gliding`, timeout: seconds * 1000 + 2000 }).toBe(0);
  const end = await readParticles(this.page, kind);
  await this.page.waitForTimeout(500);
  expect(await readParticles(this.page, kind), `${kind} at their resting spots`).toEqual(end);
});

Then('the top bar scene is drawn mirrored', async function (this: World) {
  const scene = this.page.getByTestId('top-bar-scene');
  await expect(scene.locator('[data-part]').first()).toBeAttached();
  await expect.poll(() => scene.evaluate((el) => getComputedStyle(el).transform), { message: 'scene transform' }).toMatch(/^matrix\(-1, /);
});
