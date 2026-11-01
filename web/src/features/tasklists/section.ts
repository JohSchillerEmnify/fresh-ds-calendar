import { reactive } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * Section-level display mode of the task lists in a calendar view (week / day): 'full' = compact cards with open items,
 * 'titles' = one line per list. Two levels only: the third "k tasks" count level is gone for good.
 * Persisted per view in localStorage only (not a server setting); a stored 'count' from before falls back to the default.
 */
export type SectionMode = 'full' | 'titles';
export type SectionView = 'week' | 'day';
export const SECTION_MODES: SectionMode[] = ['titles', 'full'];
export const sectionKey: InjectionKey<() => SectionMode> = Symbol('tl-section-mode');
const KEY = (v: SectionView) => `tl-section-${v}`;

export const nextMode = (m: SectionMode): SectionMode => SECTION_MODES[(SECTION_MODES.indexOf(m) + 1) % SECTION_MODES.length];

function load(v: SectionView, phone: boolean): SectionMode {
  try {
    const s = localStorage.getItem(KEY(v));
    if (s === 'full' || s === 'titles') return s;
  } catch { /* storage unavailable */ }
  return phone ? 'titles' : 'full';
}
const state = reactive<Partial<Record<SectionView, SectionMode>>>({});
export function sectionMode(v: SectionView, phone: boolean): SectionMode {
  return state[v] ??= load(v, phone);
}
export function cycleSection(v: SectionView, phone: boolean): SectionMode {
  const m = nextMode(sectionMode(v, phone));
  state[v] = m;
  try { localStorage.setItem(KEY(v), m); } catch { /* ignore */ }
  return m;
}
