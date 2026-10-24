/**
 * Visual-state steps (STEPS.md "Visual states"): rules that need no reference picture — no clipped text, no overlap,
 * the pill covers its card — and `toHaveScreenshot` pictures as regression guards (baselines in e2e/snapshots).
 */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box } from './support/ui.js';
import type { World } from './support/world.js';

/** The named regions of the spec, as locators. */
function region(w: World, name: string): Locator {
  const col = /^day column of (\d{4}-\d{2}-\d{2})$/.exec(name);
  if (col) return w.byTestId('week-day-column', `[data-date="${col[1]}"]`);
  switch (name) {
    case 'week overview': return w.byTestId('week-view');
    case 'top row': return w.byTestId('week-overview-row', '[data-row="0"]');
    case 'expanded task list': return w.byTestId('tasklist-expanded');
    case 'all-day band': return w.byTestId('week-overview-row', '[data-row="0"]').locator('.alldays');
    case 'list form': return w.byTestId('tasklist-dialog');
    case 'day column': return w.byTestId('day-column');
    case 'clock': return w.byTestId('clock-view').locator('svg.face');
    default: throw new Error(`unknown region "${name}"`);
  }
}

const grownReal = (w: World) => w.byTestId('tasklist-expanded').getByTestId('tasklist-grown-real');
const grownRow = (w: World) => w.byTestId('tasklist-expanded').locator('.tl.grown > .row');
const grownItems = (w: World) => w.byTestId('tasklist-expanded').locator('.tl.grown .items');

/**
 * Every text-bearing element must lie inside the box of its nearest clipping ancestor. Exempt by design: the 24-hour
 * grid (`data-scroll-area`, it clips to the window), the all-day band scroller, and a collapsed card's faded items (rows
 * below the title, or the names run next to it in a short block).
 */
Then('no text in the {string} is clipped', async function (this: World, name: string) {
  const root = region(this, name);
  await expect(root).toBeVisible();
  const clipped: string[] = await root.evaluate((rootEl) => {
    const out: string[] = [];
    const clipsHere = (el: Element) => { const o = getComputedStyle(el); return [o.overflowX, o.overflowY].some((v) => v === 'hidden' || v === 'clip'); };
    // by design: the 24-hour grid clips to its window, the band scrolls, a collapsed card fades its cut items (also inline), and a
    // visually-hidden box (1×1 px, screen-reader only) hides on purpose
    const tiny = (el: Element) => { const r = el.getBoundingClientRect(); return r.width <= 2 && r.height <= 2; };
    const exempt = (el: Element) => el.hasAttribute('data-scroll-area') || el.classList.contains('alldays') || (el.classList.contains('items') && (el.hasAttribute('data-fade') || !!el.closest('.block[data-fit="inline"]'))) || tiny(el);
    const texts = rootEl.querySelectorAll('.tx, .it, .est, .count, .time, .dow, .dn, .lead, .from, .taskcount');
    for (const t of texts) {
      if (!(t as HTMLElement).innerText.trim()) continue;
      const r = t.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let a: Element | null = t.parentElement;
      while (a && a !== rootEl.parentElement) {
        if (exempt(a)) break;
        if (clipsHere(a)) {
          const c = a.getBoundingClientRect();
          const edges: Record<string, number> = { left: c.left - r.left, right: r.right - c.right, top: c.top - r.top, bottom: r.bottom - c.bottom };
          const [edge, cut] = Object.entries(edges).sort((p, q) => q[1] - p[1])[0];
          const cls = (el: Element) => String(el.className).split(' ').filter((x) => x && x !== 'skin' && x !== 'm3-state').slice(0, 3).join('.');
          const sz = (b: DOMRect) => `${Math.round(b.width)}×${Math.round(b.height)}@${Math.round(b.left)},${Math.round(b.top)}`;
          if (cut > 1.5) out.push(`"${(t as HTMLElement).innerText.trim().slice(0, 40)}" (${sz(r)}) cut ${Math.round(cut)}px at the ${edge} of ${a.tagName.toLowerCase()}.${cls(a)} (${sz(c)})`);
          break;
        }
        a = a.parentElement;
      }
    }
    return out;
  });
  expect(clipped, `clipped text in the ${name}`).toEqual([]);
});

/** Preset the remembered hour height before the app loads, as if the person had pinched to that zoom. */
Given('the time grid is zoomed to {int} pixels per hour', async function (this: World, px: number) {
  await this.context.addInitScript((h: number) => localStorage.setItem('cal.hourHeight', String(h)), px);
});

/**
 * No entry card is drawn over any part of another entry's title line (feature event-display: a cascade keeps the earlier title readable).
 * Probes each title near its left end, 2 px inside its top and bottom edge; only other entry cards count as cover.
 */
Then('no title in the {string} is covered by another entry', async function (this: World, name: string) {
  const root = region(this, name);
  await expect(root).toBeVisible();
  const card = '[data-testid="tasklist-card"], [data-testid="event-chip"]';
  const titles = root.locator('.tx, .lead, [data-testid="event-chip-title"]');
  await expect(titles.first()).toBeVisible();
  const covered: string[] = [];
  for (const t of await titles.all()) {
    if (!(await t.isVisible())) continue;
    await t.scrollIntoViewIfNeeded();
    const hit = await t.evaluate((el, sel) => {
      const own = el.closest(sel);
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(4, r.width / 2);
      for (const y of [r.top + 2, r.bottom - 2]) {
        const over = document.elementFromPoint(x, y)?.closest(sel);
        if (over && over !== own) return `"${(el as HTMLElement).innerText.trim().slice(0, 40)}" is covered at y=${Math.round(y - r.top)} of ${Math.round(r.height)} px by "${over.getAttribute('data-title')}"`;
      }
      return null;
    }, card);
    if (hit) covered.push(hit);
  }
  expect(covered, `covered titles in the ${name}`).toEqual([]);
});

/** The pill (head row) and the items never share a pixel row, whichever side the card grew to. */
Then('the head row and the items of the expanded task list do not overlap', async function (this: World) {
  const row = await box(grownRow(this));
  const items = await box(grownItems(this));
  const rowBottom = row.y + row.height, itemsBottom = items.y + items.height;
  const apart = rowBottom <= items.y + 1 || itemsBottom <= row.y + 1;
  expect(apart, `head row ${Math.round(row.y)}–${Math.round(rowBottom)} vs items ${Math.round(items.y)}–${Math.round(itemsBottom)}`).toBe(true);
});

/** The real layer of the grown card covers the collapsed card it grew from, so nothing of that card peeks out. */
Then('the pill of the expanded task list covers the card {string} it grew from', async function (this: World, title: string) {
  const card = await box(this.taskCard(title));
  const real = await box(grownReal(this));
  const tol = 2;
  const covers = real.x <= card.x + tol && real.y <= card.y + tol && real.x + real.width >= card.x + card.width - tol && real.y + real.height >= card.y + card.height - tol;
  expect(covers, `pill ${JSON.stringify(real)} does not cover card ${JSON.stringify(card)}`).toBe(true);
});

/** The pill keeps its count (checkbox, icon, title and count are what the pill holds — owner), whatever else it drops. */
Then('the pill of the expanded task list shows the count {string}', async function (this: World, count: string) {
  const c = grownRow(this).locator('.count');
  await expect(c).toBeVisible();
  await expect(c).toHaveText(count);
  const r = await box(c);
  expect(r.width, 'count width').toBeGreaterThan(8);
});

/** A regression picture of the region; the baseline is written on the first run and reviewed by whoever changes the UI. */
Then('the {string} still looks like {string}', async function (this: World, name: string, picture: string) {
  const target = region(this, name);
  await expect(target).toBeVisible();
  await expect(target).toHaveScreenshot(`${picture}.png`, { mask: [this.page.getByTestId('now-marker')] });
});

Then("the band's lists are one-line pills", async function (this: World) {
  const toggle = this.byTestId('tasks-section-toggle').first();
  await expect(toggle).toBeEnabled();
  await expect(toggle.locator('svg')).toHaveCount(1);
  await expect(toggle).toHaveAttribute('data-mode', 'titles');
  const cards = this.page.locator('.alldays').first().locator('.tl');
  await expect(cards.first()).toBeVisible();
  const bad = await cards.evaluateAll((els) => els.flatMap((c) => {
    const h = c.getBoundingClientRect().height;
    const shown = [...c.querySelectorAll('.it')].filter((i) => i.getBoundingClientRect().height > 1).length;
    return [...(h > 30 ? [`${c.getAttribute('data-title')} is ${Math.round(h)}px tall`] : []), ...(shown ? [`${c.getAttribute('data-title')} shows ${shown} items`] : [])];
  }));
  expect(bad, 'every band list is a one-line pill without its items').toEqual([]);
});

/** Two levels only (titles, full): each tap flips the first grid's switch to the other one. */
When("I tap the band's section switch", async function (this: World) {
  const toggle = this.byTestId('tasks-section-toggle').first();
  const before = await toggle.getAttribute('data-mode');
  await toggle.click();
  await expect(toggle).not.toHaveAttribute('data-mode', before ?? '');
});

Then("the band's lists show their items", async function (this: World) {
  await expect(this.byTestId('tasks-section-toggle').first()).toHaveAttribute('data-mode', 'full');
  const cards = this.page.locator('.alldays').first().locator('.tl');
  await expect(cards.first()).toBeVisible();
  const bare = await cards.evaluateAll((els) => els.filter((c) => ![...c.querySelectorAll('.it')].some((i) => i.getBoundingClientRect().height > 1)).map((c) => c.getAttribute('data-title')));
  expect(bare, 'band lists without a visible item').toEqual([]);
});

/** Parses `rgb(a)(...)` and `color(srgb r g b)` computed colours to 0–255 channels; null for transparent or unknown. */
const channels = (s: string): number[] | null => {
  const m = s.match(/^rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(/[\s,/]+/).map(Number); return p[3] === 0 ? null : p.slice(0, 3); }
  const c = s.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  return c ? [c[1], c[2], c[3]].map((v) => Math.round(Number(v) * 255)) : null;
};
Then('the list of the expanded task list stands out from the grid behind it', async function (this: World) {
  const ext = this.byTestId('tasklist-expanded').getByTestId('tasklist-grown-ext');
  await expect(ext).toBeVisible();
  const [extBg, behind] = await ext.evaluate((e) => {
    const bg = (el: Element) => getComputedStyle(el).backgroundColor;
    let node: Element | null = document.querySelector('[data-testid="week-day-column"]');
    const opaque = (s: string) => s !== 'rgba(0, 0, 0, 0)' && s !== 'transparent';
    while (node && !opaque(bg(node))) node = node.parentElement;
    return [bg(e), node ? bg(node) : bg(document.body)];
  });
  const a = channels(extBg), b = channels(behind);
  expect(a, `list background ${extBg}`).not.toBeNull();
  expect(b, `grid background ${behind}`).not.toBeNull();
  const dist = Math.hypot(...a!.map((v, i) => v - b![i]));
  expect(dist, `list ${extBg} vs grid ${behind}`).toBeGreaterThanOrEqual(24);
});
