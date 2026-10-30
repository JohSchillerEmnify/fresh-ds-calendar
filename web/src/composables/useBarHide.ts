import { ref } from 'vue';
import { useListener } from '@/lib/timers';

/** Scrolling down this far hides the bar; scrolling up this far brings it back (px). */
const HIDE_AFTER = 40;
const SHOW_AFTER = 24;
/** A scroll counts as the person's own while their finger or wheel is on it and this long after (momentum), so a programmatic scroll never hides the bar. */
const INPUT_GRACE_MS = 700;

/** The bar's state after a scroll of `delta` px to `top`, given the run of same-direction scrolling so far; pure so it is unit-testable. */
export function nextBarHidden(hidden: boolean, delta: number, run: number, top: number): { hidden: boolean; run: number } {
  if (top <= 8) return { hidden: false, run: 0 };
  // a change of direction starts a new run
  const total = Math.sign(run) === Math.sign(delta) ? run + delta : delta;
  if (!hidden && total >= HIDE_AFTER) return { hidden: true, run: 0 };
  if (hidden && total <= -SHOW_AFTER) return { hidden: false, run: 0 };
  return { hidden, run: total };
}

/** The scrolling element of a scroll event's target (a Document scrolls its scrolling element), or null for anything else. */
export function scrollerOf(target: EventTarget | null): Element | null {
  if (target instanceof Document) return target.scrollingElement;
  return target instanceof Element ? target : null;
}

/** Only the main view's scrollers move the bar, not a dialog, the open tasks tray or other chrome. */
export function countsForBar(el: Element | null): boolean {
  return !!el && !!el.closest('main, [data-scroll-area]') && !el.closest('[role="dialog"], [data-testid="task-tray"]');
}

/** The keys that scroll a view; other keys are not scrolling input. */
export function isScrollKey(key: string): boolean {
  return ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' '].includes(key);
}

/** Whether the bottom bar is slid away: down while the person scrolls a view down, back on the first scroll up or at the top (feature nav-expressive). */
export function useBarHide() {
  const hidden = ref(false);
  const tops = new WeakMap<Element, number>();
  let run = 0;
  let inputUntil = 0;
  let touching = false;
  let last: Element | null = null;
  const bump = () => { inputUntil = Date.now() + INPUT_GRACE_MS; };
  const onTouchStart = () => { touching = true; };
  const onTouchEnd = () => { touching = false; bump(); };
  function onScroll(e: Event) {
    const el = scrollerOf(e.target);
    if (!countsForBar(el) && !(el && el === document.scrollingElement)) return;
    // a change of scroller starts a new run
    if (el !== last) { last = el; run = 0; }
    const top = el!.scrollTop;
    const before = tops.get(el!) ?? top;
    tops.set(el!, top);
    if (!touching && Date.now() > inputUntil) return;
    const next = nextBarHidden(hidden.value, top - before, run, top);
    hidden.value = next.hidden;
    run = next.run;
  }
  const opts = { capture: true, passive: true };
  useListener(document, 'scroll', onScroll, opts);
  useListener(document, 'wheel', bump, opts);
  useListener(document, 'touchstart', onTouchStart, opts);
  useListener(document, 'touchend', onTouchEnd, opts);
  useListener(document, 'touchcancel', onTouchEnd, opts);
  // scroll keys are scrolling input; Tab brings the bar back so a keyboard user always reaches it
  useListener(document, 'keydown', (e) => { const key = (e as KeyboardEvent).key; if (isScrollKey(key)) bump(); else if (key === 'Tab') { hidden.value = false; run = 0; } }, opts);
  useListener(document, 'focusin', (e) => { if ((e.target as Element | null)?.closest?.('[data-testid="bottom-bar"], [data-testid="create-button"]')) { hidden.value = false; run = 0; } }, opts);
  return { hidden, show: () => { hidden.value = false; run = 0; } };
}
