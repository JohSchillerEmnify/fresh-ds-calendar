/**
 * Zoom of the day/week time grid (ARCHITECTURE "Zoom"): one shared reactive hour height (px per hour), clamped to
 * `MIN_HOUR_PX`..`MAX_HOUR_PX` and remembered per device in `localStorage` (not a server pref). Until the person zooms
 * it follows the viewport default (44 px on a phone, 48 px otherwise). Also the gesture binding: two-finger pinch and
 * Ctrl+wheel. Listeners are bound by `bindGridZoom`; the touch pinch never reaches the swipe carousel, which drops a
 * gesture as soon as a second finger lands (`bindSwipeCarousel`).
 */
import { computed, ref } from 'vue';
import { isPhone } from '@/composables/useViewport';
import { listen } from '@/lib/timers';

export const MIN_HOUR_PX = 24;
export const MAX_HOUR_PX = 160;
export const HOUR_HEIGHT_KEY = 'cal.hourHeight';
/** Ctrl+wheel: `exp(-deltaY * WHEEL_ZOOM_RATE)`; a 100 px mouse notch is about x1.5, a trackpad pinch (deltaY ~ 1-10) is smooth. */
export const WHEEL_ZOOM_RATE = 0.004;

/** Clamp an hour height to the allowed range, rounded to 0.01 px (keeps `data-hour-height` tidy). */
export function clampHourHeight(px: number): number {
  return Math.round(Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, px)) * 100) / 100;
}

/** Hour height for a pinch: the start height scaled by the finger distance ratio. */
export function pinchHourHeight(startHeight: number, startDist: number, dist: number): number {
  return startDist > 0 ? clampHourHeight(startHeight * (dist / startDist)) : startHeight;
}

/** Scale factor of one Ctrl+wheel event (`deltaY` < 0 zooms in). */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_RATE);
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

/** Set (clamped) and remember the hour height. Returns the value now in effect. */
export function setHourHeight(px: number): number {
  const v = clampHourHeight(px);
  stored.value = v;
  try { localStorage.setItem(HOUR_HEIGHT_KEY, String(v)); } catch { /* storage unavailable: zoom still works for this session */ }
  return v;
}

export interface GridZoomHooks {
  /** Current hour height. */
  get: () => number;
  /** Apply a new hour height; `clientY` is the pinch centre / pointer, which should keep its time under it. */
  set: (px: number, clientY: number) => void;
}

const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const midY = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2;

/** Binds pinch (touch) and Ctrl+wheel zoom to `el`. Returns a disposer. */
export function bindGridZoom(el: HTMLElement, h: GridZoomHooks): () => void {
  let pinch: { startHeight: number; startDist: number } | null = null;
  const stops = [
    listen(el, 'touchstart', (e) => {
      const t = (e as TouchEvent).touches;
      pinch = t.length === 2 ? { startHeight: h.get(), startDist: dist(t) } : null;
    }, { passive: true }),
    // non-passive: a pinch must not also scroll the grid
    listen(el, 'touchmove', (e) => {
      const te = e as TouchEvent;
      if (!pinch || te.touches.length !== 2) return;
      if (te.cancelable) te.preventDefault();
      h.set(pinchHourHeight(pinch.startHeight, pinch.startDist, dist(te.touches)), midY(te.touches));
    }, { passive: false }),
    listen(el, 'touchend', (e) => { if ((e as TouchEvent).touches.length < 2) pinch = null; }, { passive: true }),
    listen(el, 'touchcancel', () => { pinch = null; }, { passive: true }),
    // non-passive: preventDefault keeps the browser's page zoom (Ctrl+wheel, trackpad pinch) from firing
    listen(el, 'wheel', (e) => {
      const we = e as WheelEvent;
      if (!we.ctrlKey) return;
      we.preventDefault();
      h.set(h.get() * wheelZoomFactor(we.deltaY), we.clientY);
    }, { passive: false }),
  ];
  return () => stops.forEach((s) => s());
}
