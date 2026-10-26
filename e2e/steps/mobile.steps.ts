/** Mobile layout and gesture steps (STEPS.md "Mobile"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { gridHourHeight } from './support/grid.js';
import { box, touchDrag, viewport } from './support/ui.js';
import { attr, tid, type World } from './support/world.js';

Then('the page has no horizontal scroll', async function (this: World) {
  await this.settled();
  await expect
    .poll(() => this.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0);
});

Then('the page does not bounce when pulled', async function (this: World) {
  expect(await this.page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none');
});

Then('nothing on the calendar screen can be selected by a long press', async function (this: World) {
  await this.settled();
  const offenders = await this.page.evaluate(() => {
    const field = (e: Element) => !!e.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    const sel = (e: Element) => { const cs = getComputedStyle(e) as CSSStyleDeclaration & { webkitUserSelect?: string }; return cs.webkitUserSelect || cs.userSelect; };
    const seen = new Set<string>();
    for (let y = 2; y < innerHeight; y += 24) {
      for (let x = 2; x < innerWidth; x += 24) {
        const e = document.elementFromPoint(x, y);
        if (!e || field(e) || sel(e) === 'none') continue;
        seen.add(`${e.tagName.toLowerCase()}${(e as HTMLElement).dataset.testid ? `[${(e as HTMLElement).dataset.testid}]` : ''}.${String(e.className).split(' ')[0]} (${sel(e)})`);
      }
    }
    return [...seen];
  });
  expect(offenders, 'elements a long press could select text in').toEqual([]);
});

/** Elements with text of their own inside `area` that a long press could not select (STEPS.md "Mobile"). */
async function unselectableText(area: Locator): Promise<{ checked: number; bad: string[] }> {
  await expect(area).toBeVisible();
  // a phone sheet is "visible" while it still sits below the screen, sliding in: probe it at rest, as a finger would
  await area.evaluate((root) => Promise.all(root.getAnimations({ subtree: true })
    .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
    .map((a) => a.finished.catch(() => undefined))));
  return area.evaluate((root) => {
    const r = root.getBoundingClientRect();
    const sel = (e: Element) => { const cs = getComputedStyle(e) as CSSStyleDeclaration & { webkitUserSelect?: string }; return cs.webkitUserSelect || cs.userSelect; };
    const ownText = (e: Element) => [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
    let checked = 0;
    const bad = new Set<string>();
    for (let y = Math.max(0, r.top) + 2; y < Math.min(innerHeight, r.bottom); y += 16) {
      for (let x = Math.max(0, r.left) + 2; x < Math.min(innerWidth, r.right); x += 16) {
        const e = document.elementFromPoint(x, y);
        if (!e || !root.contains(e) || !ownText(e) || e.closest('button, [role="button"]')) continue;
        checked++;
        if (sel(e) === 'none') bad.add(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${e.textContent!.trim().slice(0, 20)}"`);
      }
    }
    return { checked, bad: [...bad] };
  });
}

Then('the text in the open dialog can be selected by a long press', async function (this: World) {
  const { checked, bad } = await unselectableText(this.page.getByRole('dialog').last());
  expect(checked, 'text found in the dialog').toBeGreaterThan(0);
  expect(bad, 'dialog text a long press could not select').toEqual([]);
});

Then('the text on the page can be selected by a long press', async function (this: World) {
  const { checked, bad } = await unselectableText(this.page.locator('section.page'));
  expect(checked, 'text found on the page').toBeGreaterThan(0);
  expect(bad, 'page text a long press could not select').toEqual([]);
});

Then('the text fields of the open form can be selected', async function (this: World) {
  const dialog = this.page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  const fields = await dialog.locator('input:visible, textarea:visible').evaluateAll((els) => els.map((e) => {
    const cs = getComputedStyle(e) as CSSStyleDeclaration & { webkitUserSelect?: string };
    return `${(e as HTMLInputElement).type || e.tagName}:${cs.webkitUserSelect || cs.userSelect}`;
  }));
  expect(fields.length, 'the form has text fields').toBeGreaterThan(0);
  expect(fields.filter((f) => f.endsWith(':none')), 'fields that cannot be selected').toEqual([]);
});

async function expectAtBottom(world: World, loc: Locator) {
  const vh = viewport(world.page).height;
  const b = await box(loc);
  const bottom = b.y + b.height;
  expect(bottom, 'bottom edge within the lowest 120 px of the viewport').toBeGreaterThanOrEqual(vh - 120);
  expect(bottom, 'bottom edge inside the viewport').toBeLessThanOrEqual(vh + 1);
}

Then('the view switcher is at the bottom of the screen', async function (this: World) {
  await expectAtBottom(this, this.page.getByTestId('view-switcher'));
});

Then('the create button is at the bottom of the screen', async function (this: World) {
  await expectAtBottom(this, this.page.getByTestId('create-button'));
});

const TOUCH_TARGETS = [
  'nav-prev', 'nav-next', 'nav-today', 'view-switch-month', 'view-switch-week', 'view-switch-day', 'create-button',
];

Then(
  'the navigation, view switcher and create buttons are at least {int} by {int} pixels',
  async function (this: World, width: number, height: number) {
    for (const id of TOUCH_TARGETS) {
      const b = await box(this.page.getByTestId(id).first());
      expect.soft(b.width, `${id} width`).toBeGreaterThanOrEqual(width);
      expect.soft(b.height, `${id} height`).toBeGreaterThanOrEqual(height);
    }
  },
);

/** Swipe on calendar-swipe-area: horizontal 200 px / 150 ms, vertical 300 px. Waits for the route change if any. */
async function swipe(world: World, dx: number, dy: number) {
  const area = await box(world.page.getByTestId('calendar-swipe-area'));
  const cx = area.x + area.width / 2;
  const cy = area.y + Math.min(area.height / 2, 400);
  const before = world.page.url();
  await touchDrag(world.page, { x: cx - dx / 2, y: cy - dy / 2 }, { x: cx + dx / 2, y: cy + dy / 2 }, { durationMs: 150 });
  if (dx !== 0) await expect.poll(() => world.page.url(), { message: 'swipe changes the period' }).not.toBe(before);
}

When('I swipe left on the calendar', async function (this: World) {
  await swipe(this, -200, 0);
});

When('I swipe right on the calendar', async function (this: World) {
  await swipe(this, 200, 0);
});

When('I swipe up on the calendar', async function (this: World) {
  await swipe(this, 0, -300);
});

/**
 * Live swipe (STEPS.md): touchstart near the right edge, then slow touchmoves (500 ms, so no flick) pulling left by
 * `fraction` of calendar-swipe-area's width. The finger stays down until "I let go" (`world.held`).
 */
async function startSwipe(world: World, fraction: number) {
  const area = await box(world.page.getByTestId('calendar-swipe-area'));
  const y = Math.round(area.y + Math.min(area.height / 2, 400));
  const x0 = area.x + area.width * 0.8;
  const dx = -area.width * fraction;
  const cdp = await world.page.context().newCDPSession(world.page);
  const at = (x: number) => [{ x: Math.round(x), y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(x0) });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await world.page.waitForTimeout(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x0 + (dx * i) / steps) });
  }
  world.held = async () => {
    world.held = undefined;
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await cdp.detach().catch(() => {});
    }
  };
}

When('I start swiping left on the calendar by a quarter of the width', async function (this: World) {
  await startSwipe(this, 1 / 4);
});

When('I start swiping left on the calendar by half the width', async function (this: World) {
  await startSwipe(this, 1 / 2);
});

When('I let go', async function (this: World) {
  if (!this.held) throw new Error('no finger is down');
  await this.held();
});

Then('the week of {date} is shown beside the current one', async function (this: World, date: string) {
  const neighbour = this.byTestId('swipe-neighbour', attr('data-period-start', date));
  await expect(neighbour).toBeVisible();
  const current = this.page.locator(`${tid('week-view')}:not(${tid('swipe-neighbour')} *)`);
  const area = await box(this.page.getByTestId('calendar-swipe-area'));
  // the frame after the last move may still be pending: poll
  await expect
    .poll(async () => {
      const [c, n] = [await current.boundingBox(), await neighbour.boundingBox()];
      if (!c || !n) return 'no box';
      if (Math.abs(n.x - (c.x + c.width)) > 2) return `current ends at ${c.x + c.width}, neighbour starts at ${n.x}`;
      return n.x < area.x + area.width - 10 ? 'beside, in view' : `neighbour still off screen at ${n.x}`;
    })
    .toBe('beside, in view');
});

/**
 * Pinch: two CDP touch points on the visible part of the time grid, moving apart (vertically, around the centre) over
 * 400 ms until their distance has doubled.
 */
When('I pinch out on the time grid to twice the size', async function (this: World) {
  this.hourHeightBefore = await gridHourHeight(this);
  const area = await box(this.page.getByTestId('time-grid').first().locator('xpath=..'));
  const cx = Math.round(area.x + area.width / 2);
  const cy = area.y + area.height / 2;
  const startGap = 80;
  const cdp = await this.page.context().newCDPSession(this.page);
  try {
    const at = (gap: number) => [
      { x: cx, y: Math.round(cy - gap / 2), id: 1 },
      { x: cx, y: Math.round(cy + gap / 2), id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(startGap) });
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await this.page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(startGap * (1 + i / steps)) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
});

async function expectTwiceAsTall(world: World) {
  const before = world.hourHeightBefore;
  if (before === undefined) throw new Error('no hour height was captured before the pinch');
  await expect
    .poll(async () => (await gridHourHeight(world)) / before, { message: 'hour height relative to before the pinch' })
    .toBeGreaterThanOrEqual(1.8);
  expect((await gridHourHeight(world)) / before).toBeLessThanOrEqual(2.2);
}

Then('one hour of the time grid is about twice as tall as before', async function (this: World) {
  await expectTwiceAsTall(this);
});

Then('one hour of the time grid is still about twice as tall as at the start', async function (this: World) {
  await expectTwiceAsTall(this);
});

Then('the viewport meta tag contains {string}', async function (this: World, text: string) {
  await expect(this.page.locator('meta[name="viewport"]')).toHaveAttribute('content', new RegExp(escape(text)));
});

Then('the bottom bar reserves the safe-area inset at the bottom', async function (this: World) {
  await expect(this.page.getByTestId('bottom-bar')).toHaveAttribute('data-safe-area', 'true');
});

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
