/**
 * The drag helper cat's decisions (ARCHITECTURE "Drag helper"), pure so they are unit-tested: the roll's chance and
 * which pose the cat takes for the drag's current displacement and rest time. `DragCat` reads the drag state from
 * `watchDrags` (motion/drag.ts) and only draws.
 */
import type { MotionLevel } from '@/motion';

/** "Sometimes" ≈ every 5th drag. */
export const DRAG_CAT_CHANCE = 0.2;
/** Pointer rest after which the cat stops helping and waits with a paw on the card. */
export const DRAG_CAT_WAIT_MS = 500;
/** The hop away after drop or cancel (spec: ≤ 1.5 s), and the calmer fade at Reduced. */
export const DRAG_CAT_HOP_MS = { full: 700, reduced: 400 } as const;

/**
 * `push-down` above the card (moving later/down), `pull-up` below it (earlier/up), `push-side` beside it (to another
 * day), `wait` beside it with a paw on the card and a questioning look (pointer resting).
 */
export type DragCatPose = 'push-down' | 'pull-up' | 'push-side' | 'wait';

export interface DragCatInput {
  /** Displacement of the drawn card from its pick-up place (px). */
  dx: number;
  dy: number;
  /** Vertical pointer velocity (px/s): the direction the person is moving the card right now. */
  vy: number;
  /** Width of the card: moving sideways by half of it means another day (column or cell). */
  width: number;
  stillMs: number;
  level: MotionLevel;
}

/** Vertical speed (px/s) below which the cat keeps its previous pose instead of flipping between up and down. */
const DEAD_ZONE = 40;

/**
 * The pose for this frame. Resting wins; another day (sideways by half a card or more) next; then later/earlier by the
 * direction the pointer is moving now (so dragging back up pulls even while still below the start); slower than the
 * dead zone the previous pose stays (after waiting: by the displacement). Reduced: always beside the card (no pushing).
 */
export function dragCatPose(i: DragCatInput, prev: DragCatPose): DragCatPose {
  if (i.stillMs > DRAG_CAT_WAIT_MS) return 'wait';
  if (i.level !== 'full') return 'push-side';
  if (Math.abs(i.dx) >= Math.max(12, i.width / 2)) return 'push-side';
  if (i.vy > DEAD_ZONE) return 'push-down';
  if (i.vy < -DEAD_ZONE) return 'pull-up';
  if (prev !== 'wait' && prev !== 'push-side') return prev;
  return i.dy < 0 ? 'pull-up' : 'push-down';
}

/**
 * Which side of the card the cat stands on when beside it: behind the movement (pushing sideways), else its default
 * side, away from the dragging thumb: the left, or the right in left-handed mode (owner, 2026-10-13: the thumb hid it).
 */
export function dragCatSide(dx: number, pose: DragCatPose, leftHanded = false): 'left' | 'right' {
  if (pose === 'push-side' && dx !== 0) return dx > 0 ? 'left' : 'right';
  return leftHanded ? 'right' : 'left';
}
