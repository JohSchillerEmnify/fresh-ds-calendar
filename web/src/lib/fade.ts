/**
 * `v-fade`: marks a clipping container `data-fade="true"` while its content is taller than the box (re-measured on every
 * update and resize), or while it left entries out (`data-more`, the count of entries not built because they would lie
 * completely below the box); the CSS fades the content out at the bottom then (month cells: no visible "+N").
 */
import type { Directive } from 'vue';

const observers = new WeakMap<HTMLElement, ResizeObserver>();
/** Whether the box has more content than it shows; a box that left entries out needs no layout read. */
const over = (el: HTMLElement) => !!el.dataset.more || el.scrollHeight > el.clientHeight + 1;
const measure = (el: HTMLElement) => { el.dataset.fade = over(el) ? 'true' : 'false'; };

/**
 * Boxes mounted or updated in the current render, measured together once it is done (still before the frame is painted):
 * all reads, then all writes, so a month of cells costs one layout instead of one per cell (a read after a write forces one).
 */
const queued = new Set<HTMLElement>();
function flush(): void {
  const els = [...queued].filter((el) => el.isConnected);
  queued.clear();
  const fades = els.map(over);
  els.forEach((el, i) => { el.dataset.fade = fades[i] ? 'true' : 'false'; });
}
function queue(el: HTMLElement): void {
  if (!queued.size) queueMicrotask(flush);
  queued.add(el);
}

export const vFade: Directive<HTMLElement> = {
  mounted(el) {
    if (typeof ResizeObserver !== 'undefined') {
      // resize callbacks run after layout: measuring there forces nothing
      const ro = new ResizeObserver(() => measure(el));
      ro.observe(el);
      observers.set(el, ro);
    }
    queue(el);
  },
  updated: queue,
  unmounted(el) { observers.get(el)?.disconnect(); },
};
