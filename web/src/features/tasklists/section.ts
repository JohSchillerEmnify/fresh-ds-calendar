import { reactive } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * Section-level display mode of the task lists in a calendar view (week / day): 'full' = compact cards with open items,
 * 'titles' = one line per list, 'count' = a single "k tasks" chip per day. Persisted per view in localStorage only (not a server setting).
 */
export type SectionMode = 'full' | 'titles' | 'count';
export type SectionView = 'week' | 'day';
export const SECTION_MODES: SectionMode[] = ['titles', 'full', 'count'];
export const sectionKey: InjectionKey<() => SectionMode> = Symbol('tl-section-mode');
const KEY = (v: SectionView) => `tl-section-${v}`;

export const nextMode = (m: SectionMode): SectionMode => SECTION_MODES[(SECTION_MODES.indexOf(m) + 1) % SECTION_MODES.length];

function load(v: SectionView, phone: boolean): SectionMode {
  try {
    const s = localStorage.getItem(KEY(v));
    if (s === 'full' || s === 'titles' || s === 'count') return s;
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
