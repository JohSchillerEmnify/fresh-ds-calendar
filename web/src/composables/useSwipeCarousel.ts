/**
 * Live swipe carousel gesture (feature mobile-first-layout): once a touch is clearly horizontal, the period follows the
 * finger; on release it settles onto the neighbour (past a third of the width, or a flick > 0.5 px/ms toward it)
 * or springs back. This module is the gesture only (pure math + touch binding); `SwipeCarousel.vue` renders.
 * Passive listeners only, so vertical scrolling is never blocked (`touch-action: pan-y` on the area).
 */
import { listen } from '@/lib/timers';
import { inSystemEdge } from './useSwipe';
import { createVelocityTracker } from '@/motion/spring';

/** Movement (px) before the axis is decided. */
export const AXIS_SLOP = 10;
/** Release past this fraction of the width settles on the neighbour. */
export const SETTLE_FRACTION = 1 / 3;
/** A flick toward the neighbour faster than this (px/ms) settles on it whatever the distance. */
export const FLICK_PX_PER_MS = 0.5;
/** Velocity is only trusted when the last move is this recent (ms) at release; a finger that rested has none. */
export const VELOCITY_STALE_MS = 100;

/** 1 = next period (finger pulls left), -1 = previous (pulls right). */
export type SwipeDir = 1 | -1;

/** Direction lock: null until the finger moved `AXIS_SLOP`, then horizontal when |dx| > 1.5·|dy| (the instant swipe's ratio). */
export function lockAxis(dx: number, dy: number): 'h' | 'v' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_SLOP) return null;
  return Math.abs(dx) > 1.5 * Math.abs(dy) ? 'h' : 'v';
}

/** Which neighbour a horizontal offset reveals. */
export const dirOf = (dx: number): SwipeDir => (dx < 0 ? 1 : -1);

/** Offset the views follow: the finger's dx, never more than one width either way. */
export function followOffset(dx: number, width: number): number {
  return Math.max(-width, Math.min(width, dx));
}

/**
 * Outcome on release: the neighbour's direction to settle on it, 0 to spring back. `vx` in px/ms.
 * Settles past `SETTLE_FRACTION` or on a flick toward the neighbour; a flick back toward the start always springs back.
 */
export function releaseTarget(dx: number, vx: number, width: number): SwipeDir | 0 {
  if (dx === 0 || width <= 0) return 0;
  const dir = dirOf(dx);
  const far = Math.abs(dx) > width * SETTLE_FRACTION;
  // speed toward the neighbour (pulling left toward "next" means a negative vx); negative = back toward the start
  const toward = -vx * dir;
  // a flick back toward the start cancels, however far the swipe went
  if (toward < -FLICK_PX_PER_MS) return 0;
  return far || toward > FLICK_PX_PER_MS ? dir : 0;
}

/**
 * Initial velocity for the settle spring, normalised to the remaining distance (1/s) as `springEasing` expects.
 * Only motion toward the target counts; rounded and capped so the easing cache stays small.
 */
export function settleVelocity(from: number, to: number, vxPxPerMs: number): number {
  const dist = to - from;
  if (dist === 0) return 0;
  return Math.max(0, Math.min(30, Math.round((vxPxPerMs * 1000) / dist)));
}

export interface CarouselHooks {
  /** Checked at touch start and on every move (a drag may claim the gesture mid-way). */
  disabled: () => boolean;
  /** Width the offsets refer to (read once per gesture). */
  width: () => number;
  /** A horizontal swipe began toward `dir`, or crossed over to the other side. */
  start: (dir: SwipeDir) => void;
  /** New follow offset (px, already clamped). */
  move: (dx: number) => void;
  /** Finger lifted after a horizontal swipe: settle toward `target` (0 = back). `vx` in px/ms. */
  end: (target: SwipeDir | 0, vx: number) => void;
  /** The gesture was taken away (touchcancel, second finger, claimed by a drag): spring back. */
  cancel: () => void;
}

/** Binds the carousel gesture to `el`. Returns a disposer. */
export function bindSwipeCarousel(el: HTMLElement, h: CarouselHooks): () => void {
  let phase: 'idle' | 'pending' | 'h' = 'idle';
  let sx = 0, sy = 0, dx = 0, width = 0, lastT = 0;
  let dir: SwipeDir | 0 = 0;
  const vt = createVelocityTracker(VELOCITY_STALE_MS);

  const abort = () => {
    const was = phase;
    phase = 'idle';
    if (was === 'h') h.cancel();
  };
  const stops = [
    listen(el, 'touchstart', (e) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1 || h.disabled() || inSystemEdge(te.touches[0].clientX)) { abort(); return; }
      phase = 'pending';
      sx = te.touches[0].clientX;
      sy = te.touches[0].clientY;
      dx = 0;
      dir = 0;
      vt.reset();
      vt.add(sx, sy, te.timeStamp);
      lastT = te.timeStamp;
    }, { passive: true }),
    listen(el, 'touchmove', (e) => {
      if (phase === 'idle') return;
      const te = e as TouchEvent;
      const t = te.touches[0];
      if (!t) return;
      const mx = t.clientX - sx;
      if (phase === 'pending') {
        const axis = lockAxis(mx, t.clientY - sy);
        if (!axis) return;
        // vertical: leave it to the scroller for the rest of this touch
        if (axis === 'v') { phase = 'idle'; return; }
        phase = 'h';
        width = h.width();
      }
      if (h.disabled()) { abort(); return; }
      dx = mx;
      vt.add(t.clientX, t.clientY, te.timeStamp);
      lastT = te.timeStamp;
      // the neighbour follows the side the finger is on
      const d = dx === 0 ? dir : dirOf(dx);
      if (d && d !== dir) { dir = d; h.start(d); }
      h.move(followOffset(dx, width));
    }, { passive: true }),
    listen(el, 'touchend', (e) => {
      if (phase !== 'h') { phase = 'idle'; return; }
      phase = 'idle';
      const fresh = (e as TouchEvent).timeStamp - lastT <= VELOCITY_STALE_MS;
      const vx = fresh ? vt.velocity().vx / 1000 : 0;
      h.end(releaseTarget(dx, vx, width), vx);
    }, { passive: true }),
    listen(el, 'touchcancel', abort, { passive: true }),
    // a history step (the system back) takes the gesture away
    listen(window, 'popstate', abort),
  ];
  return () => stops.forEach((s) => s());
}
