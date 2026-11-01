/** Month view zoom (month-zoom): a week-row factor 1..`MAX_MONTH_ZOOM`, kept per device like the hour height; gestures via `bindGridZoom`. */
import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue';
import { bindGridZoom } from '@/composables/useHourHeight';

export const MIN_MONTH_ZOOM = 1;
export const MAX_MONTH_ZOOM = 4;
export const MONTH_ZOOM_KEY = 'cal.monthZoom';

/** Weeks of a usual month: each zoom step adds this share of the box to every week row, the same for every month. */
const ZOOM_BASE_WEEKS = 5;

/** Sideways grid height: at zoom 1 the weeks share the box; each step adds `boxH / 5` per row, so swiping on keeps the row height. */
export function zoomedGridHeight(boxH: number, weeks: number, z: number): number {
  return boxH + Math.max(0, z - 1) * (boxH / ZOOM_BASE_WEEKS) * weeks;
}

/** A month zoom limited to its range, rounded to 0.001 (a non-finite value is the whole month). */
export function clampMonthZoom(z: number): number {
  return Number.isFinite(z) ? Math.round(Math.min(MAX_MONTH_ZOOM, Math.max(MIN_MONTH_ZOOM, z)) * 1000) / 1000 : MIN_MONTH_ZOOM;
}

/** The remembered month zoom, or 1 when none is stored or storage is blocked. */
export function readStoredMonthZoom(): number {
  try {
    const raw = localStorage.getItem(MONTH_ZOOM_KEY);
    return raw === null ? MIN_MONTH_ZOOM : clampMonthZoom(Number(raw));
  } catch {
    return MIN_MONTH_ZOOM;
  }
}

const stored = ref(readStoredMonthZoom());
/** The zoom of a gesture under way (null when none). */
const live = ref<number | null>(null);
/** The month zoom in effect: the gesture's live value, else the remembered one. */
export const monthZoom = computed(() => live.value ?? stored.value);
/** True while a pinch or Ctrl+wheel gesture is under way. */
export const monthZooming = computed(() => live.value !== null);

/** Sets (clamped) and remembers the month zoom; ends a live preview. */
export function setMonthZoom(z: number): void {
  const v = clampMonthZoom(z);
  stored.value = v;
  live.value = null;
  try { localStorage.setItem(MONTH_ZOOM_KEY, String(v)); } catch { /* storage unavailable: the zoom holds for this session */ }
}

/** Binds pinch and Ctrl+wheel on `el` to the month zoom; `onZoom` runs per live step (to keep the point under the fingers). */
export function bindMonthZoom(el: HTMLElement, onZoom?: (from: number, to: number, clientY: number) => void): () => void {
  return bindGridZoom(el, {
    get: () => monthZoom.value,
    preview: (z, y) => { const from = monthZoom.value; live.value = z; onZoom?.(from, z, y); },
    commit: setMonthZoom,
    clamp: clampMonthZoom,
  });
}

/** A zoomed-in month shows the start times on its chips, also on a phone (where chips are otherwise titles only). */
const ChipTimesKey: InjectionKey<Ref<boolean>> = Symbol('chipTimes');
/** Provide, for this subtree, whether chips show their start times. */
export function provideChipTimes(on: Ref<boolean>): void {
  provide(ChipTimesKey, on);
}
/** Whether a provider above asks chips to show their start times (false without one). */
export function useChipTimes(): Ref<boolean> {
  return inject(ChipTimesKey, ref(false));
}
