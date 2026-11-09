/** Read-only drag watch: passive followers (the drag helper cat) see every frame of the active drag. */

/** One frame of the active drag as drawn, for passive followers (the drag helper cat). */
export interface DragFrame {
  /** `start` on pick-up, `move` on every drag frame, `end` once on drop or cancel. */
  phase: 'start' | 'move' | 'end';
  /** Viewport rect of the lifted card as drawn now (pick-up rect plus the follow offset; scale and tilt ignored). */
  rect: { left: number; top: number; width: number; height: number };
  /** Displacement of the drawn card from where it was picked up (px, viewport). */
  dx: number;
  dy: number;
  /** Pointer velocity (px/s) over the last moves; it keeps its last value while the pointer rests. */
  vx: number;
  vy: number;
  /** How long the pointer has rested (moved ≤ 3 px), in ms of frame time. */
  stillMs: number;
}
export type DragWatcher = (f: DragFrame) => void;
const watchers = new Set<DragWatcher>();
/** Pointer movement (px) that still counts as resting for `stillMs`. */
export const STILL_SLOP = 3;

/**
 * Follow every drag passively: called synchronously from the drag's own rAF loop (no second loop, no pointer events).
 * Returns the unsubscribe function. Watchers must be cheap and must never throw into the drag.
 */
export function watchDrags(fn: DragWatcher): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}
export function emitDrag(f: DragFrame) {
  for (const w of watchers) {
    try { w(f); } catch { /* a follower never breaks the drag */ }
  }
}

/** True while at least one follower is subscribed. */
export function hasWatchers(): boolean {
  return watchers.size > 0;
}
