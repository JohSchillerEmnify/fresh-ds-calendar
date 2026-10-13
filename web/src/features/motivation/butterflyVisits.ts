/**
 * When scene visitors come by (ARCHITECTURE "Season scenes and the support cat"). The butterfly (a bat at Halloween,
 * same rhythm and hook): one at a time, the first visit 20–60 s after the scene appears, then every 3–5 min; a visit
 * lasts ~10 s. Full flutters through the bar (sometimes resting briefly on a flower), Reduced only rests in place, Off
 * has none. The Halloween ghost uses the same scheduling with its own rhythm (every 8–12 min, ~8 s). Pure apart from
 * `forcedButterfly`, which reads the test hook `window.__butterflyNow` (test mode only, STEPS.md scene notes);
 * `useSceneVisits` runs a rhythm in a component.
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
/** A visitor's rhythm: wait before the first visit, wait between visits (ms, uniform in [min, max]) and visit length. */
export interface VisitRhythm {
  first: { min: number; max: number };
  next: { min: number; max: number };
  lengthMs: number;
}
export const BUTTERFLY_RHYTHM: VisitRhythm = { first: FIRST_VISIT_MS, next: NEXT_VISIT_MS, lengthMs: BUTTERFLY_VISIT_MS };
/** The little Halloween ghost: floats past every 8–12 min for about 8 s. */
export const GHOST_RHYTHM: VisitRhythm = { first: { min: 480_000, max: 720_000 }, next: { min: 480_000, max: 720_000 }, lengthMs: 8_000 };

/** Share of Full visits that rest briefly on a flower on the way through. */
export const REST_CHANCE = 0.4;

/** How a visit moves: fly straight through, fly through with a short rest, or (Reduced) only rest in place. */
export type ButterflyFlight = 'fly' | 'fly-rest' | 'rest';

/** Milliseconds until a visitor's next visit; `random` is uniform in [0, 1). A forced visit comes at once. */
export function visitWait(rhythm: VisitRhythm, first: boolean, forced: boolean, random: number): number {
  if (forced) return 0;
  const r = first ? rhythm.first : rhythm.next;
  return Math.round(r.min + random * (r.max - r.min));
}

/** Milliseconds until the next butterfly (or bat) visit. */
export function butterflyWait(first: boolean, forced: boolean, random: number): number {
  return visitWait(BUTTERFLY_RHYTHM, first, forced, random);
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
