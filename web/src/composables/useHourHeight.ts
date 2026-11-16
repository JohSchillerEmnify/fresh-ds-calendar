/**
 * Zoom of the day/week time grid (feature mobile-first-layout): one shared reactive hour height (px per hour), clamped to
 * `MIN_HOUR_PX`..`MAX_HOUR_PX` and remembered per device in `localStorage` (not a server pref). Until the person zooms
 * it follows the viewport default (44 px on a phone, 48 px otherwise). Also the gesture binding: two-finger pinch and
 * Ctrl+wheel (live preview during the gesture, one commit when it settles). Listeners are bound by `bindGridZoom`; the touch pinch never reaches the swipe carousel, which drops a
 * gesture as soon as a second finger lands (`bindSwipeCarousel`).
 */
import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue';
import { isPhone } from '@/composables/useViewport';
import { listen } from '@/lib/timers';

export const MIN_HOUR_PX = 24;
export const MAX_HOUR_PX = 160;
export const HOUR_HEIGHT_KEY = 'cal.hourHeight';
/** Ctrl+wheel: `exp(-deltaY * WHEEL_ZOOM_RATE)`; a 100 px mouse notch is about x1.5, a trackpad pinch (deltaY ~ 1-10) is smooth. */
const WHEEL_ZOOM_RATE = 0.004;

/** Time at the top of the visible grid (minutes), shared by all grids so a side swipe can keep the hours in view. */
export const gridTopMinutes = ref<number | null>(null);
/** True while a side swipe turns the period: grids keep `gridTopMinutes` instead of their opening position. */
export const swipeKeepsHours = ref(false);

/** Clamp an hour height to the allowed range, rounded to 0.01 px (keeps `data-hour-height` tidy). */
export function clampHourHeight(px: number): number {
  return Math.round(Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, px)) * 100) / 100;
}

/** Hour height for a pinch: the start height scaled by the finger distance ratio (limited by `clamp`). */
export function pinchHourHeight(startHeight: number, startDist: number, dist: number, clamp = clampHourHeight): number {
  return startDist > 0 ? clamp(startHeight * (dist / startDist)) : startHeight;
}

/** Scale factor of one Ctrl+wheel event (`deltaY` < 0 zooms in). */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_RATE);
}

/** Grid y (px at the committed hour height) shown `off` px below the scroller top, under `translateY(t) scaleY(k)` at `scrollTop`. */
export function gridYUnder(scrollTop: number, off: number, k: number, t: number): number {
  return (scrollTop + off - t) / k;
}

/** The `translateY` that keeps grid y `g` at `off` px below the scroller top under `scaleY(k)` at `scrollTop`. */
export function previewShift(scrollTop: number, off: number, g: number, k: number): number {
  return scrollTop + off - g * k;
}

/** The remembered hour height, or null when none is stored or it is unusable (storage blocked, garbage). */
export function readStoredHourHeight(): number | null {
  try {
    const raw = localStorage.getItem(HOUR_HEIGHT_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? clampHourHeight(n) : null;
  } catch {
    return null;
  }
}

const stored = ref<number | null>(readStoredHourHeight());
/** The hour height every time-grid consumer converts minutes and pixels with. */
export const hourHeight = computed(() => stored.value ?? (isPhone.value ? 44 : 48));

/** A subtree's own hour height (e.g. a fit-to-height grid), injected so descendants like the expanded card follow it. */
const HourHeightKey: InjectionKey<Ref<number>> = Symbol('hourHeight');
/** Provide an hour height for this subtree, overriding the shared zoom height for descendants. */
export function provideHourHeight(h: Ref<number>): void {
  provide(HourHeightKey, h);
}
/** The effective hour height here: a provided one (fit grid) or the shared zoom height. */
export function useEffectiveHourHeight(): Ref<number> {
  return inject(HourHeightKey, hourHeight);
}

/** Set (clamped) and remember the hour height. Returns the value now in effect. */
export function setHourHeight(px: number): number {
  const v = clampHourHeight(px);
  stored.value = v;
  try { localStorage.setItem(HOUR_HEIGHT_KEY, String(v)); } catch { /* storage unavailable: zoom still works for this session */ }
  return v;
}

/** Idle time after the last Ctrl+wheel event before the zoom counts as settled. */
export const WHEEL_SETTLE_MS = 150;

export interface GridZoomHooks {
  /** Committed hour height (what the blocks are laid out with). */
  get: () => number;
  /** Cheap live preview of a new hour height (CSS transform only); `clientY` is the pinch centre / pointer, which keeps its time under it. */
  preview: (px: number, clientY: number) => void;
  /** The gesture settled: commit `px` (re-lay out, remember) and drop the preview. */
  commit: (px: number) => void;
  /** Limits a zoomed value; the hour height's range unless the zoomed thing has its own (the month zoom). */
  clamp?: (v: number) => number;
}

const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const midY = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2;

/**
 * Binds pinch (touch) and Ctrl+wheel zoom to `el`. During a gesture only `hooks.preview` runs; `hooks.commit` runs once
 * on touchend (pinch) or after `WHEEL_SETTLE_MS` without wheel events. Returns a disposer.
 */
export function bindGridZoom(el: HTMLElement, h: GridZoomHooks): () => void {
  const clamp = h.clamp ?? clampHourHeight;
  let pinch: { startHeight: number; startDist: number } | null = null;
  /** Previewed, not yet committed hour height. */
  let live: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    clearTimeout(timer);
    timer = undefined;
    if (live === null) return;
    const v = live;
    live = null;
    h.commit(v);
  };
  const stops = [
    listen(el, 'touchstart', (e) => {
      const t = (e as TouchEvent).touches;
      pinch = t.length === 2 ? { startHeight: live ?? h.get(), startDist: dist(t) } : null;
    }, { passive: true }),
    // non-passive: a pinch must not also scroll the grid
    listen(el, 'touchmove', (e) => {
      const te = e as TouchEvent;
      if (!pinch || te.touches.length !== 2) return;
      if (te.cancelable) te.preventDefault();
      live = pinchHourHeight(pinch.startHeight, pinch.startDist, dist(te.touches), clamp);
      h.preview(live, midY(te.touches));
    }, { passive: false }),
    listen(el, 'touchend', (e) => { if ((e as TouchEvent).touches.length < 2) { pinch = null; settle(); } }, { passive: true }),
    listen(el, 'touchcancel', () => { pinch = null; settle(); }, { passive: true }),
    // non-passive: preventDefault keeps the browser's page zoom (Ctrl+wheel, trackpad pinch) from firing
    listen(el, 'wheel', (e) => {
      const we = e as WheelEvent;
      if (!we.ctrlKey) return;
      we.preventDefault();
      live = clamp((live ?? h.get()) * wheelZoomFactor(we.deltaY));
      h.preview(live, we.clientY);
      clearTimeout(timer);
      timer = setTimeout(settle, WHEEL_SETTLE_MS);
    }, { passive: false }),
  ];
  return () => { clearTimeout(timer); stops.forEach((s) => s()); };
}
