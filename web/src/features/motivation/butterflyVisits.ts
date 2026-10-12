/**
 * When the scene butterfly comes by (ARCHITECTURE "Season scenes and the support cat"): one butterfly at a time, the
 * first visit 20–60 s after the scene appears, then every 3–5 min; a visit lasts ~10 s. Full flutters through the bar
 * (sometimes resting briefly on a flower), Reduced only rests in place, Off has no butterflies. Pure apart from
 * `forcedButterfly`, which reads the test hook `window.__butterflyNow` (test mode only, STEPS.md scene notes).
 */
import type { MotionLevel } from '@/motion';

declare global {
  interface Window {
    /** Test hook: start a butterfly visit at once (honoured in test mode only; kept, so visits follow back to back). */
    __butterflyNow?: boolean;
  }
}

export const BUTTERFLY_VISIT_MS = 10_000;
export const FIRST_VISIT_MS = { min: 20_000, max: 60_000 } as const;
export const NEXT_VISIT_MS = { min: 180_000, max: 300_000 } as const;
/** Share of Full visits that rest briefly on a flower on the way through. */
export const REST_CHANCE = 0.4;

/** How a visit moves: fly straight through, fly through with a short rest, or (Reduced) only rest in place. */
export type ButterflyFlight = 'fly' | 'fly-rest' | 'rest';

/** Milliseconds until the next visit; `random` is uniform in [0, 1). A forced visit comes at once. */
export function butterflyWait(first: boolean, forced: boolean, random: number): number {
  if (forced) return 0;
  const r = first ? FIRST_VISIT_MS : NEXT_VISIT_MS;
  return Math.round(r.min + random * (r.max - r.min));
}

/** How the visit moves at a motion level, or null when there is no butterfly (Off). */
export function butterflyFlight(level: MotionLevel, random: number): ButterflyFlight | null {
  if (level === 'off') return null;
  if (level === 'reduced') return 'rest';
  return random < REST_CHANCE ? 'fly-rest' : 'fly';
}

/** Whether the test hook asks for a visit now; always false outside test mode. */
export function forcedButterfly(testMode: boolean, w: { __butterflyNow?: boolean } | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  return testMode && w?.__butterflyNow === true;
}
