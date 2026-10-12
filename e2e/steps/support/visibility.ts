import type { Page } from '@playwright/test';

/**
 * Simulate the page being hidden / shown again: override `document.visibilityState` and `document.hidden`, dispatch
 * `visibilitychange`, and on "visible" also `focus` on window (STEPS.md "the app regains focus" / "the app is hidden").
 */
export async function setVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    if (s === 'visible') window.dispatchEvent(new Event('focus'));
    else window.dispatchEvent(new Event('blur'));
  }, state);
}
