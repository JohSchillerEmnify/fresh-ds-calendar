/**
 * The emotional support cat's roll (ARCHITECTURE "Season scenes and the support cat"): about one in ten finished task
 * lists, never at animation level Off or when switched off in the theme menu. Pure apart from `takeForcedCat`, which
 * reads the test hook `window.__catNext` (test mode only, STEPS.md "Scenes and the support cat").
 */
import type { MotionLevel } from '@/motion';
import type { CatSetting } from '@/theme/presets';

declare global {
  interface Window {
    /** Test hook: forces the next roll (honoured in test mode only, consumed by the roll). */
    __catNext?: boolean;
  }
}

export const CAT_CHANCE = 0.1;
/** Full sequence (walk in, paw, look, grin, fade out) and the shorter, calmer one for Reduced. */
export const CAT_DURATION_MS = { full: 3000, reduced: 2000 } as const;

export interface CatRoll {
  level: MotionLevel;
  setting: CatSetting;
  /** The test hook asked for the cat. */
  forced: boolean;
  /** A uniform random number in [0, 1). */
  random: number;
}

/** Whether the cat comes by for this finished list. */
export function catComes(r: CatRoll): boolean {
  if (r.level === 'off' || r.setting === 'off') return false;
  return r.forced || r.random < CAT_CHANCE;
}

/** Reads and clears the test hook; always false outside test mode. */
export function takeForcedCat(testMode: boolean, w: { __catNext?: boolean } | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!testMode || !w?.__catNext) return false;
  w.__catNext = false;
  return true;
}

/** Duration of a visit at a motion level (0 = no visit). */
export function catDuration(level: MotionLevel): number {
  return level === 'off' ? 0 : CAT_DURATION_MS[level];
}
