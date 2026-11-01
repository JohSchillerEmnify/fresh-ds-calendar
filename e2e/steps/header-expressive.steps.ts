/** Top bar sizes and the month-only week title (STEPS.md "UI redesign E", feature header-expressive). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { chooseOption, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

/** The two top bar sizes and the stored `headerLayout` values behind them (Expressive = the former two rows). */
const LAYOUT: Record<string, 'auto' | 'two-rows' | 'one-row'> = { Automatic: 'auto', Expressive: 'two-rows', Compact: 'one-row' };
const layoutValue = (label: string) => {
  const v = LAYOUT[label];
  if (!v) throw new Error(`Unknown top bar size "${label}"`);
  return v;
};

Given('the top bar size is set to {string}', async function (this: World, label: string) {
  await this.api.patch('/api/prefs', { headerLayout: layoutValue(label) });
});

When('I choose {string} as the top bar size', async function (this: World, label: string) {
  layoutValue(label);
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption((await settingControl(this, 'settings-top-bar-size')), label);
  expect((await saved).status(), 'top bar size saved').toBe(200);
});

Then('the top bar size {string} is selected', async function (this: World, label: string) {
  layoutValue(label);
  await expect.poll(async () => selectedLabel((await settingControl(this, 'settings-top-bar-size')))).toBe(label);
});

Then('the top bar size {string} is the default', async function (this: World, label: string) {
  layoutValue(label);
  expect((await this.api.get<{ headerLayout: string }>('/api/prefs')).headerLayout, 'nothing chosen').toBe('auto');
  await expect(this.page.getByTestId('top-bar')).toHaveAttribute('data-size', label.toLowerCase());
});

When('I tap the period title', async function (this: World) {
  await this.page.getByTestId('period-title').click();
});

// --- scenes keep every large element visible ------------------------------------------------------------------------------

const SCENE = '[data-testid="top-bar-scene"]';
/** The scene's heroes: the cat and the large part that defines each scene. They are always drawn, whole, and never under a control. */
const HEROES = ['cat', 'hare', 'mordor-eye', 'mordor-tower', 'moon', 'sun', 'sunrise', 'xmas-tree', 'snowman', 'beach-umbrella'];
/** The other large props are decoration (owner 2026-10-30): they stay where they are, even partly under a control or cut by the bar, so only the heroes are judged. */
const PROPS = ['autumn-tree', 'snowy-tree', 'bare-tree', 'sprouting-tree', 'jack-o-lantern', 'sledge', 'leaf-pile'];
const LARGE_SEL = [...HEROES, ...PROPS].map((p) => `${SCENE} [data-part="${p}"]`).join(', ');
/** The drawn controls of the bar (the Today pill, not its larger tap area). */
const DRAWN = ['[data-testid=period-title] .t', '[data-testid=period-title] > svg', '[data-testid=menu-button] svg', '[data-testid=nav-prev] svg', '[data-testid=nav-next] svg', '[data-testid=nav-today] .pill',
  '[data-testid=streak-flame]', '[data-testid=plant-button]', '[data-testid=sync-status] svg', '[data-testid=filter-button] svg', '[data-testid=settings-button] svg'];

interface Rect { l: number; r: number; t: number; b: number }

/** Boxes of the bar and of each matched part (an svg by its drawn shapes), and which parts are hidden. */
async function partBoxes(w: World, selector: string) {
  return w.page.evaluate(({ selector, scene }) => {
    const bar = document.querySelector('[data-testid="top-bar"]')!.getBoundingClientRect();
    const rect = (el: Element): { l: number; r: number; t: number; b: number } | null => {
      const shapes = el.tagName.toLowerCase() === 'svg' ? [...el.querySelectorAll('path, circle, rect, ellipse')] : [...el.querySelectorAll('svg path, svg circle, svg rect, svg ellipse')];
      const rs = (shapes.length ? shapes : [el]).map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      return rs.length ? { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), t: Math.min(...rs.map((r) => r.top)), b: Math.max(...rs.map((r) => r.bottom)) } : null;
    };
    const parts = [...document.querySelectorAll<HTMLElement>(selector)].map((el) => ({ name: el.dataset.part ?? el.className, hidden: el.hasAttribute('data-hidden') || getComputedStyle(el).visibility === 'hidden', box: rect(el) }));
    return { bar: { l: bar.left, r: bar.right, t: bar.top, b: bar.bottom }, parts, hasScene: !!document.querySelector(scene) };
  }, { selector, scene: SCENE });
}

/** Like `partBoxes`, measured once nothing moves: the Mordor eye's opening flare plays once and swells its glow. */
async function stableBoxes(w: World, selector: string) {
  let last = await partBoxes(w, selector);
  for (let i = 0; i < 12; i++) {
    await w.page.waitForTimeout(250);
    const again = await partBoxes(w, selector);
    const same = JSON.stringify(again.parts) === JSON.stringify(last.parts);
    last = again;
    if (same) break;
  }
  return last;
}

Then('the support cat is fully visible in the top bar scene', async function (this: World) {
  // the app has settled and the scene (a lazy chunk) has drawn its parts, so a picture taken later is of the finished scene
  await this.settled();
  await expect(this.page.locator(`${SCENE} [data-part]`).first()).toBeAttached();
  // a scene with a cat shows it whole; the sunflower field has none
  const { bar, parts } = await partBoxes(this, `${SCENE} [data-part="cat"]`);
  for (const p of parts) {
    expect(p.hidden, 'the cat is left out').toBe(false);
    expect(p.box, 'the cat has a box').not.toBeNull();
    const c = p.box!;
    expect(c.l >= bar.l - 0.5 && c.r <= bar.r + 0.5 && c.t >= bar.t - 0.5 && c.b <= bar.b + 2.5, `the cat ${JSON.stringify(c)} inside the bar ${JSON.stringify(bar)}`).toBe(true);
  }
});

/** The large parts a scene really shows: every hero, and the props that were not left out. A part that is not drawn at all has no box. */
async function shownLarge(w: World) {
  const { bar, parts } = await stableBoxes(w, LARGE_SEL);
  return { bar, parts: parts.filter((p) => HEROES.includes(p.name) || (!p.hidden && p.box)) };
}

Then('every large element of the top bar scene is fully visible', async function (this: World) {
  await expect(this.page.locator(SCENE)).toBeAttached();
  const { bar, parts: all } = await shownLarge(this);
  const parts = all.filter((p) => HEROES.includes(p.name));
  // ground-standing parts may sink 2.5 px into the bar's bottom edge, trees may touch the side edges by 2 px
  const bad = parts.filter((p) => p.hidden || !p.box || p.box.l < bar.l - 2 || p.box.r > bar.r + 2 || p.box.t < bar.t - 0.5 || p.box.b > bar.b + 2.5)
    .map((p) => `${p.name} ${p.hidden ? 'left out' : JSON.stringify(p.box)}`);
  expect(bad, `large elements cut or left out (bar ${JSON.stringify(bar)})`).toEqual([]);
});

/** Every drawn control box of the bar. */
async function drawnControls(w: World): Promise<Rect[]> {
  return w.page.evaluate((sels) => sels.flatMap((sel) => [...document.querySelectorAll(`[data-testid="top-bar"] ${sel}`)].flatMap((el) => {
    if (getComputedStyle(el).visibility === 'hidden') return [];
    const shapes = el.tagName.toLowerCase() === 'svg' ? [...el.querySelectorAll('path, circle, rect, ellipse')] : [el];
    const rs = shapes.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    return rs.length ? [{ l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), t: Math.min(...rs.map((r) => r.top)), b: Math.max(...rs.map((r) => r.bottom)) }] : [];
  })), DRAWN);
}

Then("no control covers any part of the top bar scene's large elements", async function (this: World) {
  await expect(this.page.locator(SCENE)).toBeAttached();
  const [controls, { parts }] = await Promise.all([drawnControls(this), shownLarge(this)]);
  const hits = parts.filter((p) => HEROES.includes(p.name) && p.box && controls.some((c) => Math.min(p.box!.r, c.r) - Math.max(p.box!.l, c.l) > 0 && Math.min(p.box!.b, c.b) - Math.max(p.box!.t, c.t) > 0)).map((p) => p.name);
  expect(hits, 'large elements under a control').toEqual([]);
});

Then('the top bar scene is drawn at its full {int} pixels height', async function (this: World, px: number) {
  const h = await this.page.locator(SCENE).evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.round(h), 'scene height').toBeGreaterThanOrEqual(px);
});

Then("the Mordor eye and tower sit between the period title and the top bar's icons", async function (this: World) {
  // the title button stretches over the free room: its text and chevron are what the gap starts after
  const title = await this.page.getByTestId('period-title').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const right = Math.max(...[...el.querySelectorAll('.t, svg')].map((c) => c.getBoundingClientRect().right));
    return { x: r.left, y: r.top, width: right - r.left, height: r.height };
  });
  const { parts } = await stableBoxes(this, `${SCENE} [data-part="mordor-eye"], ${SCENE} [data-part="mordor-tower"]`);
  expect(parts.map((p) => p.name).sort(), 'eye and tower drawn').toEqual(['mordor-eye', 'mordor-tower']);
  // the icons that share the title's row
  const icons = (await drawnControls(this)).filter((c) => c.l > title!.x + title!.width && c.t < title!.y + title!.height && c.b > title!.y);
  const left = Math.min(...icons.map((c) => c.l));
  for (const p of parts) {
    expect(p.box!.l, `${p.name} right of the title`).toBeGreaterThanOrEqual(title!.x + title!.width - 0.5);
    expect(p.box!.r, `${p.name} left of the icons`).toBeLessThanOrEqual(left + 0.5);
  }
});

Then('no visitor of the top bar scene is ever drawn under a control', async function (this: World) {
  await expect(this.page.locator(SCENE)).toBeAttached();
  const sample = () => this.page.evaluate((sels) => {
    const VIS = '[data-testid="top-bar-scene"] :is([data-part=butterfly], [data-part=bat], [data-part=ghost], [data-part=bird-flock], [data-part=robin])';
    const controls = sels.flatMap((sel) => [...document.querySelectorAll(`[data-testid="top-bar"] ${sel}`)].flatMap((el) => {
      const shapes = el.tagName.toLowerCase() === 'svg' ? [...el.querySelectorAll('path, circle, rect, ellipse')] : [el];
      return shapes.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    }));
    const seen: string[] = [];
    const hits: string[] = [];
    for (const v of document.querySelectorAll<HTMLElement>(VIS)) {
      seen.push(v.dataset.part ?? '');
      if (v.hasAttribute('data-hidden') || getComputedStyle(v).visibility === 'hidden') continue;
      const r = v.getBoundingClientRect();
      if (controls.some((c) => Math.min(r.right, c.right) - Math.max(r.left, c.left) > 0.5 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 0.5)) hits.push(`${v.dataset.part} at ${Math.round(r.left)},${Math.round(r.top)}`);
    }
    return { seen, hits };
  }, DRAWN);
  // one visit lasts about ten seconds: sample it every 80 ms
  const seen = new Set<string>();
  const hits = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const r = await sample();
    r.seen.forEach((p) => seen.add(p));
    r.hits.forEach((h) => hits.add(h));
    await this.page.waitForTimeout(80);
  }
  expect(seen.size, 'a visitor came by').toBeGreaterThan(0);
  expect([...hits].slice(0, 5), 'visitors drawn under a control').toEqual([]);
});
