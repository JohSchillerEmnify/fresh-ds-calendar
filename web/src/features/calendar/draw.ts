/**
 * Drawing a block on the empty time grid to create an event or a task list (feature event-editing, owner 2026-10-25,
 * design C1-C3). A mouse presses on empty grid space and drags; a finger long-presses (haptic tick) and then drags, while a
 * plain swipe keeps scrolling. The block snaps to quarter hours, is at least 15 minutes long, may be drawn upwards, and in
 * the week view may reach into the next (or previous) day column. On release the "new" dialog opens with the drawn start
 * and length; the block stays drawn behind it until the dialog closes. A plain tap keeps the slot's own click (as today).
 *
 * Touch follows the iOS rules of the drag controller (`motion/drag.ts`): a non-passive `touchmove` listener on the grid
 * from mount (iOS decides at touchstart whether moves can stop scrolling), moves before the long press are never
 * prevented, the touch events steer once drawing (iOS may cancel or stop the pointer events), the scroll container is
 * locked while drawing, and a press that may draw never starts a text selection or a callout.
 */
import { shallowRef, watch } from 'vue';
import { claimGesture, haptic } from '@/motion';
import { minutesToTime } from '@/lib/dates';
import { openNew } from '@/extensions/create';
import { useUiStore } from '@/stores/ui';

/** A drawn range in minutes counted from 00:00 of the grid's first day column. */
export interface DrawRange { start: number; end: number }

const STEP = 15;
const DAY = 1440;
/** Long press before a finger draws (as picking up a card). */
const LONG_PRESS_MS = 350;
/** Finger movement that gives the press to the scroll; mouse movement that starts drawing. */
const TOUCH_SLOP = 8;
const MOUSE_SLOP = 4;
/** Auto-scroll near the top or bottom of the scroll container while drawing (as dragging). */
const EDGE_PX = 56;
const EDGE_DWELL_MS = 400;

/**
 * The block a press and the pointer's place give: each end snapped to the nearest quarter hour, the earlier one first,
 * at least 15 minutes; a long press that never moved gives the quarter hour under the finger.
 *
 * @param press Minutes where the press was.
 * @param at Minutes where the pointer is now.
 * @param still True when the pointer has not moved since a long press (no drawing yet).
 * @returns The drawn range.
 */
export function drawRange(press: number, at: number, still: boolean): DrawRange {
  if (still) {
    const start = Math.floor(press / STEP) * STEP;
    return { start, end: start + STEP };
  }
  const a = Math.round(press / STEP) * STEP, b = Math.round(at / STEP) * STEP;
  const start = Math.min(a, b);
  return { start, end: Math.max(a, b, start + STEP) };
}

/**
 * One piece of a drawn range per day column it covers.
 *
 * @param r The drawn range.
 * @returns For each day (index from the grid's first column) the minutes of that day it covers; an end of day is 1440.
 */
export function splitByDay(r: DrawRange): { day: number; start: number; end: number }[] {
  const out: { day: number; start: number; end: number }[] = [];
  for (let d = Math.floor(r.start / DAY); d * DAY < r.end; d++) {
    out.push({ day: d, start: Math.max(r.start, d * DAY) - d * DAY, end: Math.min(r.end, (d + 1) * DAY) - d * DAY });
  }
  return out;
}

/** The block being drawn, or kept behind the "new" dialog it opened: the dates of the grid's columns and the range. */
export const drawPreview = shallowRef<{ dates: string[]; range: DrawRange } | null>(null);

/** The block piece of one day column (time grid layer), null when the drawn block does not cover that day. */
export function drawnPiece(date: string): { start: number; end: number } | null {
  const p = drawPreview.value;
  if (!p) return null;
  const day = p.dates.indexOf(date);
  return splitByDay(p.range).find((x) => x.day === day) ?? null;
}

export interface GridDrawOptions {
  /** The grid's scroll container (locked and auto-scrolled while drawing). */
  scroller: () => HTMLElement | null;
  /** True when drawing is off (the two-row overview, a swipe preview). */
  disabled: () => boolean;
}

/**
 * Binds drawing to a time grid element (`[data-testid=time-grid]` with its day columns). Returns the disposer.
 *
 * @param grid The time grid element.
 * @param o Scroll container and the switch.
 * @returns A function that removes every listener.
 */
export function bindGridDraw(grid: HTMLElement, o: GridDrawOptions): () => void {
  let state: 'idle' | 'pending' | 'drawing' = 'idle';
  let isTouch = false;
  let pointerId = -1;
  let touchId: number | null = null;
  let startPt = { x: 0, y: 0 };
  let cur = { x: 0, y: 0 };
  let moved = false;
  /** Minutes of the press (from the first column's 00:00) and its column. */
  let pressAt = 0;
  let pressCol = 0;
  let dates: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;
  let edgeSince = 0;
  let lastT = 0;
  let release: (() => void) | null = null;
  let locked: HTMLElement | null = null;
  let lockedOverflow = '';
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  const columns = () => [...grid.querySelectorAll<HTMLElement>('[data-testid="week-day-column"],[data-testid="day-column"]')];
  const hourHeight = () => Number(grid.dataset.hourHeight) || 44;

  /** Minutes (from the first column's 00:00) under a point; the column is kept to the press column and its neighbours. */
  function minutesAt(x: number, y: number): number {
    const cols = columns();
    const r = grid.getBoundingClientRect();
    let c = cols.findIndex((el) => { const b = el.getBoundingClientRect(); return x >= b.left && x < b.right; });
    if (c < 0) c = x < (cols[0]?.getBoundingClientRect().left ?? 0) ? 0 : cols.length - 1;
    c = Math.min(Math.max(c, pressCol - 1, 0), pressCol + 1, cols.length - 1);
    const m = Math.min(Math.max(((y - r.top) / hourHeight()) * 60, 0), DAY);
    return c * DAY + m;
  }

  function show() {
    const r = drawRange(pressAt, minutesAt(cur.x, cur.y), !moved);
    // never past the grid's first or last day
    const range = { start: Math.max(0, r.start), end: Math.min(dates.length * DAY, Math.max(r.end, Math.max(0, r.start) + STEP)) };
    drawPreview.value = { dates, range };
  }

  const onSelect = (e: Event) => { if (state !== 'idle') e.preventDefault(); };
  const onClickCapture = (e: Event) => {
    window.removeEventListener('click', onClickCapture, true);
    e.stopPropagation();
    e.preventDefault();
  };

  function listen(on: boolean) {
    const f = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
    f('pointermove', onMove, true);
    f('pointerup', onUp, true);
    f('pointercancel', onCancel, true);
    f('touchmove', onTouchMove as EventListener, { capture: true, passive: false } as AddEventListenerOptions);
    f('touchend', onTouchEnd as EventListener, true);
    f('touchcancel', onTouchCancel as EventListener, true);
    f('selectstart', onSelect, true);
    f('contextmenu', onSelect, true);
    f('keydown', onKey as EventListener, true);
  }

  function reset() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    listen(false);
    o.scroller()?.removeEventListener('scroll', onScroll);
    if (locked) { locked.style.overflowY = lockedOverflow; locked = null; }
    release?.();
    release = null;
    state = 'idle';
    pointerId = -1;
    touchId = null;
  }

  function onDown(e: PointerEvent) {
    if (state !== 'idle' || o.disabled() || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target as Element | null;
    // empty grid only: an entry or its handles start their own gestures
    if (!t?.closest('[data-testid="time-slot"]')) return;
    const cols = columns();
    dates = cols.map((c) => c.dataset.date ?? '');
    const c = cols.findIndex((el) => { const b = el.getBoundingClientRect(); return e.clientX >= b.left && e.clientX < b.right; });
    if (c < 0) return;
    pressCol = c;
    isTouch = e.pointerType !== 'mouse';
    pointerId = e.pointerId;
    startPt = { x: e.clientX, y: e.clientY };
    cur = { ...startPt };
    moved = false;
    pressAt = minutesAt(e.clientX, e.clientY);
    state = 'pending';
    listen(true);
    if (isTouch) timer = setTimeout(begin, LONG_PRESS_MS);
  }

  /** The press becomes a drawing: claim the gesture, lock the scroll, show the block. */
  function begin() {
    timer = null;
    if (state !== 'pending') return;
    state = 'drawing';
    release = claimGesture();
    const sc = o.scroller();
    if (isTouch && sc) { locked = sc; lockedOverflow = sc.style.overflowY; sc.style.overflowY = 'hidden'; }
    sc?.addEventListener('scroll', onScroll, { passive: true });
    if (isTouch) haptic(10);
    show();
    edgeSince = 0;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function track(x: number, y: number) {
    cur = { x, y };
    if (state === 'pending') {
      const d = Math.hypot(x - startPt.x, y - startPt.y);
      if (isTouch) { if (d > TOUCH_SLOP) reset(); }
      else if (d > MOUSE_SLOP) { moved = true; begin(); }
      return;
    }
    if (state === 'drawing') {
      if (Math.hypot(x - startPt.x, y - startPt.y) > (isTouch ? TOUCH_SLOP : MOUSE_SLOP)) moved = true;
      show();
    }
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (state === 'drawing') { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
    track(e.clientX, e.clientY);
  }
  const finger = (l: TouchList | undefined) => (l ? [...l].find((t) => t.identifier === touchId) : undefined);
  function onTouchMove(e: TouchEvent) {
    if (state === 'pending' && touchId === null) touchId = e.changedTouches?.[0]?.identifier ?? null;
    if (state !== 'drawing') return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const t = finger(e.touches) ?? e.touches[0];
    if (t) track(t.clientX, t.clientY);
  }
  function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    finish(e.clientX, e.clientY);
  }
  function onTouchEnd(e: TouchEvent) {
    if (state !== 'drawing') return;
    const t = finger(e.changedTouches) ?? e.changedTouches?.[0];
    finish(t ? t.clientX : cur.x, t ? t.clientY : cur.y);
  }
  function onCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    // a touch drawing goes on with the touch events (the browser took the pointer for its pan); else it ends
    if (state === 'drawing' && isTouch) return;
    abort();
  }
  function onTouchCancel() {
    if (state === 'drawing') abort();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && state !== 'idle') abort();
  }
  function onScroll() {
    if (state === 'drawing') show();
  }

  /** Ends without a block (Escape, a cancelled touch). */
  function abort() {
    const was = state;
    reset();
    if (was === 'drawing') drawPreview.value = null;
  }

  /** Release: a drawing opens the "new" dialog with its range; a press that never drew leaves the slot's click alone. */
  function finish(x: number, y: number) {
    if (state === 'pending') { reset(); return; }
    if (state !== 'drawing') return;
    track(x, y);
    const p = drawPreview.value;
    reset();
    if (!p) return;
    // the slot under the pointer must not also open the dialog at its hour
    window.addEventListener('click', onClickCapture, true);
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickTimer = null; window.removeEventListener('click', onClickCapture, true); }, 400);
    const day = Math.floor(p.range.start / DAY);
    openNew(p.dates[day], minutesToTime(p.range.start - day * DAY), p.range.end - p.range.start);
    keepUntilDialogCloses();
  }

  /** Auto-scroll while the pointer rests near the top or bottom of the scroll container. */
  function frame(t: number) {
    raf = 0;
    if (state !== 'drawing') return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    const sc = o.scroller();
    if (sc) {
      const r = sc.getBoundingClientRect();
      let v = 0;
      if (cur.y < r.top + EDGE_PX) v = -(1 - Math.min(Math.max((cur.y - r.top) / EDGE_PX, 0), 1));
      else if (cur.y > r.bottom - EDGE_PX) v = 1 - Math.min(Math.max((r.bottom - cur.y) / EDGE_PX, 0), 1);
      if (!v) edgeSince = 0;
      else if (!edgeSince) edgeSince = performance.now();
      if (v && performance.now() - edgeSince >= EDGE_DWELL_MS) sc.scrollTop += v * 600 * dt;
    }
    raf = requestAnimationFrame(frame);
  }

  // iOS: a non-passive touchmove listener on the grid from the start, so a drawing can stop the scroll once it begins
  const onGridTouchMove = (e: TouchEvent) => { if (state === 'drawing' && e.cancelable) e.preventDefault(); };
  const onGridTouchStart = (e: TouchEvent) => { if (state === 'pending' && touchId === null) touchId = e.changedTouches?.[0]?.identifier ?? null; };
  grid.addEventListener('pointerdown', onDown);
  grid.addEventListener('touchstart', onGridTouchStart, { passive: true });
  grid.addEventListener('touchmove', onGridTouchMove, { passive: false });
  return () => {
    reset();
    if (clickTimer) clearTimeout(clickTimer);
    window.removeEventListener('click', onClickCapture, true);
    grid.removeEventListener('pointerdown', onDown);
    grid.removeEventListener('touchstart', onGridTouchStart);
    grid.removeEventListener('touchmove', onGridTouchMove);
  };
}

/** The drawn block stays behind the "new" dialog it opened and goes when that dialog closes (Cancel or Save). */
function keepUntilDialogCloses() {
  const ui = useUiStore();
  const opened = ui.dialog;
  const stop = watch(() => ui.dialog, (d) => {
    if (d === opened) return;
    // switching Event <-> Task list replaces the dialog but keeps the block
    if (d && (d.props as { mode?: string }).mode === 'create') return;
    drawPreview.value = null;
    stop();
  });
}
