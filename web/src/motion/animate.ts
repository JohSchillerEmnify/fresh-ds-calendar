/**
 * WAAPI helpers that honour the motion level. Only `transform` / `opacity` (compositor).
 *  - full:    the given keyframes with the given (spring) timing
 *  - reduced: a short opacity fade (<= 150 ms) instead, no movement or bounce
 *  - off:     nothing (returns null)
 */
import { getMotionLevel } from './level';
import { springEasing, type SpringParams } from './spring';

export type Frames = Keyframe[];

export function canAnimate(el: Element | null | undefined): el is Element {
  return !!el && typeof (el as Element).animate === 'function';
}

export interface AnimateOptions extends KeyframeAnimationOptions {
  /** Spring used for timing (overrides easing + duration). */
  spring?: SpringParams;
  /** Initial normalised velocity for the spring. */
  velocity?: number;
  /** What to do when the level is Reduced. Default 'fade'. */
  reduced?: 'fade' | 'skip' | 'same';
}

export function animate(el: Element | null | undefined, frames: Frames, opts: AnimateOptions = {}): Animation | null {
  if (!canAnimate(el)) return null;
  const level = getMotionLevel();
  if (level === 'off') return null;
  const { spring, velocity, reduced = 'fade', ...rest } = opts;
  if (level === 'reduced' && reduced !== 'same') {
    if (reduced === 'skip') return null;
    return el.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  }
  let timing: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)', ...rest };
  if (spring) {
    const s = springEasing(spring, velocity);
    timing = { ...rest, duration: s.duration, easing: s.easing };
  }
  return el.animate(frames, timing);
}

/** Resolves when the animation finishes or is cancelled (never rejects). */
export function finished(a: Animation | null | undefined): Promise<void> {
  if (!a) return Promise.resolve();
  return (a.finished as Promise<unknown>).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Spring "pop" on scale: 1 -> peak -> 1 with a spring. Used by checkbox, card bounce, FAB.
 */
export function pop(el: Element | null | undefined, from = 0.8, spring: SpringParams = { stiffness: 600, damping: 0.42 }) {
  return animate(el, [{ transform: `scale(${from})` }, { transform: 'scale(1)' }], { spring });
}

