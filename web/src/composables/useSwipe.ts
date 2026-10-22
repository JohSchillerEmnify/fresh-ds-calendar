import { listen } from '@/lib/timers';

export interface SwipeOptions {
  onLeft?: () => void;
  onRight?: () => void;
  /** Return true to ignore the gesture (e.g. while dragging an item). */
  disabled?: () => boolean;
}

/**
 * Horizontal swipe: >= 60 px, |dx| > 1.5 |dy|, < 600 ms (feature mobile-first-layout). Vertical moves scroll normally.
 * Passive listeners; returns a disposer (call it in onBeforeUnmount).
 */
export function bindSwipe(el: HTMLElement, o: SwipeOptions): () => void {
  let x = 0, y = 0, t = 0, active = false;
  const stops = [
    listen(el, 'touchstart', (e) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1 || o.disabled?.()) { active = false; return; }
      active = true;
      x = te.touches[0].clientX;
      y = te.touches[0].clientY;
      t = Date.now();
    }, { passive: true }),
    listen(el, 'touchend', (e) => {
      if (!active) return;
      active = false;
      const c = (e as TouchEvent).changedTouches[0];
      const dx = c.clientX - x, dy = c.clientY - y;
      if (Date.now() - t > 600 || Math.abs(dx) < 60 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      (dx < 0 ? o.onLeft : o.onRight)?.();
    }, { passive: true }),
    listen(el, 'touchcancel', () => { active = false; }, { passive: true }),
  ];
  return () => stops.forEach((s) => s());
}
