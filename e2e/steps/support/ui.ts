/** Generic UI helpers shared by step files. */
import { expect, type Locator, type Page } from '@playwright/test';

export const pathname = (page: Page) => new URL(page.url()).pathname;

export interface Box { x: number; y: number; width: number; height: number }

export async function box(loc: Locator): Promise<Box> {
  await expect(loc).toBeVisible();
  const b = await loc.boundingBox();
  if (!b) throw new Error(`No bounding box for ${loc}`);
  return b;
}

/** Open the settings, turn the Labs switch `testId` on (waiting for the prefs to be saved) and go back. */
export async function turnOnLabsSwitch(page: Page, testId: string) {
  await setLabsSwitch(page, testId, true);
}

/** Open the settings, set the switch `testId` to `on` (waiting for the prefs to be saved) and go back. */
export async function setLabsSwitch(page: Page, testId: string, on: boolean) {
  await page.getByTestId('settings-button').click();
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) !== String(on)) {
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
    await control.click();
    expect((await saved).status(), 'prefs saved').toBe(200);
  }
  await page.getByTestId('settings-back').click();
}

export const viewport = (page: Page) => page.viewportSize() ?? { width: 0, height: 0 };

/**
 * Text (or attribute) of all matched elements joined with ", " equals `expected` (auto-retrying).
 * Lists are compared exactly and in order (STEPS.md conventions).
 */
export async function expectJoined(loc: Locator, expected: string, attribute?: string) {
  await expect
    .poll(async () =>
      (
        await loc.evaluateAll(
          (els, a) => els.map((e) => (a ? e.getAttribute(a) ?? '' : (e.textContent ?? '').replace(/\s+/g, ' ').trim())),
          attribute,
        )
      ).join(', '),
    )
    .toBe(expected);
}

/**
 * Choose an option by its visible label in a control that may be a native <select> or a radio group / segmented
 * button / swatch list (the testid catalogue allows either).
 */
export async function chooseOption(control: Locator, label: string) {
  await expect(control).toBeVisible();
  const tag = await control.evaluate((e) => e.tagName.toLowerCase());
  if (tag === 'select') {
    await control.selectOption({ label });
    return;
  }
  const byName = (role: 'radio' | 'option' | 'button' | 'menuitemradio') =>
    control.getByRole(role, { name: label, exact: true });
  const target = byName('radio')
    .or(byName('option'))
    .or(byName('menuitemradio'))
    .or(byName('button'))
    .or(control.locator(`[data-name="${label}"]`))
    .first();
  await target.click();
}

/** Label of the currently selected option of a <select> or a radio-like group. */
export async function selectedLabel(control: Locator): Promise<string> {
  return control.evaluate((root) => {
    if (root instanceof HTMLSelectElement) return root.selectedOptions[0]?.label.trim() ?? '';
    const sel = root.querySelector(
      'input:checked, [aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], option:checked',
    ) as HTMLElement | null;
    if (!sel) return '';
    const input = sel as HTMLInputElement;
    const name =
      sel.getAttribute('aria-label') ||
      sel.getAttribute('data-name') ||
      (input.labels && input.labels[0]?.textContent) ||
      sel.getAttribute('title') ||
      sel.textContent ||
      '';
    return name.replace(/\s+/g, ' ').trim();
  });
}

/** Labels of all options of a <select> or radio-like group, in DOM order. */
export async function optionLabels(control: Locator): Promise<string[]> {
  return control.evaluate((root) => {
    if (root instanceof HTMLSelectElement) return [...root.options].map((o) => o.label.trim());
    const opts = [...root.querySelectorAll('[role="radio"], input[type="radio"], [role="option"]')] as HTMLElement[];
    return opts.map((sel) => {
      const input = sel as HTMLInputElement;
      return (
        sel.getAttribute('aria-label') ||
        sel.getAttribute('data-name') ||
        (input.labels && input.labels[0]?.textContent) ||
        sel.getAttribute('title') ||
        sel.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim();
    });
  });
}

/** Touch gesture through CDP (`Input.dispatchTouchEvent`), interpolated over `durationMs` in `steps` moves. */
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { durationMs?: number; steps?: number; holdMs?: number; release?: boolean } = {},
) {
  const { durationMs = 150, steps = 10, holdMs = 0, release = true } = opts;
  const cdp = await page.context().newCDPSession(page);
  try {
    const point = (p: { x: number; y: number }) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
    if (holdMs) await page.waitForTimeout(holdMs);
    // Keep to the wall clock: each CDP round trip is slow on a loaded or CPU-capped machine, and gestures such as a
    // swipe (< 600 ms) must take the requested time, so once it is used up the last move goes straight to the target.
    const start = Date.now();
    for (let i = 1; i <= steps; i++) {
      const late = Date.now() - start >= durationMs;
      const t = late ? 1 : i / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }),
      });
      if (late) break;
      const wait = start + (durationMs * i) / steps - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
    }
    // `release: false` keeps the finger down, so a step can look at the live preview of a drag
    if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** Element's own box fully inside the viewport (1 px tolerance). */
export async function expectInViewport(page: Page, loc: Locator) {
  const vp = viewport(page);
  await expect
    .poll(async () => {
      const b = await loc.boundingBox();
      if (!b) return 'no box';
      const ok = b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1;
      return ok ? 'inside' : `box ${JSON.stringify(b)} exceeds viewport ${vp.width}x${vp.height}`;
    })
    .toBe('inside');
}

/** Phone bottom sheet: data-presentation="sheet", anchored to the bottom edge, (almost) full width. */
export async function expectBottomSheet(page: Page, loc: Locator) {
  await expect(loc).toHaveAttribute('data-presentation', 'sheet');
  const vp = viewport(page);
  await expect
    .poll(async () => {
      const b = await loc.boundingBox();
      if (!b) return 'no box';
      if (Math.abs(b.y + b.height - vp.height) > 2) return `bottom edge at ${b.y + b.height}, viewport ${vp.height}`;
      if (b.width < vp.width * 0.95) return `width ${b.width} < 95% of ${vp.width}`;
      return 'sheet';
    })
    .toBe('sheet');
}

/**
 * The edge midpoints of a W x H box centred on the element, 1 px inside, where `document.elementFromPoint` does not
 * return the element or a descendant: an empty list means its hit area is at least W x H (STEPS.md "Header layout";
 * corners are not probed, as hit testing follows a round button's rounded corners).
 */
export async function hitAreaMisses(loc: Locator, width: number, height: number): Promise<string[]> {
  return loc.evaluate((el, [w, h]) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const points: [string, number, number][] = [['top', cx, cy - h / 2 + 1], ['bottom', cx, cy + h / 2 - 1], ['left', cx - w / 2 + 1, cy], ['right', cx + w / 2 - 1, cy]];
    const out: string[] = [];
    for (const [side, x, y] of points) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) out.push(`${side} (${Math.round(x)}, ${Math.round(y)}) hits ${hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? hit?.tagName ?? 'nothing'}`);
    }
    return out;
  }, [width, height] as const);
}

/** The app's touch layout (phones and touch tablets, `html[data-touch]`): no ‹ › arrows there (owner, 2026-10-26). */
export async function isTouchScreen(page: Page): Promise<boolean> {
  await expect(page.getByTestId('top-bar')).toBeVisible();
  return (await page.locator('html[data-touch]').count()) > 0;
}

/** Swipe on calendar-swipe-area: horizontal 200 px / 150 ms, vertical 300 px. Waits for the route change if any. */
export async function swipeCalendar(page: Page, dx: number, dy: number) {
  const area = await box(page.getByTestId('calendar-swipe-area'));
  const cx = area.x + area.width / 2;
  const cy = area.y + Math.min(area.height / 2, 400);
  const before = page.url();
  await touchDrag(page, { x: cx - dx / 2, y: cy - dy / 2 }, { x: cx + dx / 2, y: cy + dy / 2 }, { durationMs: 150 });
  if (dx !== 0) await expect.poll(() => page.url(), { message: 'swipe changes the period' }).not.toBe(before);
}

/**
 * Moves one period forward or back the way a person does: the ‹ › arrows where the top bar has them (desktop), a swipe
 * on the calendar on touch screens, which have no arrows (owner, 2026-10-26). Waits for the route change.
 */
export async function goToPeriod(page: Page, dir: 'next' | 'prev') {
  // decided by the device, not by what the bar shows, so a desktop that lost its arrows fails here
  if (await isTouchScreen(page)) return swipeCalendar(page, dir === 'next' ? -200 : 200, 0);
  const before = page.url();
  await page.getByTestId(`nav-${dir}`).click();
  await expect.poll(() => page.url()).not.toBe(before);
}
