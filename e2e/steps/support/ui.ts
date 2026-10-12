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
  opts: { durationMs?: number; steps?: number; holdMs?: number } = {},
) {
  const { durationMs = 150, steps = 10, holdMs = 0 } = opts;
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
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
