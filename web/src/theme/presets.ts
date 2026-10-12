/**
 * Theme presets (ARCHITECTURE "Themes"): a preset is a seed colour, an optional mode and four attributes. A person's
 * choice is a preset name plus overrides of single attributes. Pure data and functions, no DOM.
 */
import type { ThemeMode } from './index';

export type Glow = 'off' | 'soft' | 'neon';
export type Entries = 'solid' | 'tinted' | 'outline';
export type Corners = 'square' | 'round' | 'pill';
export type ThemeScene = 'none' | 'mordor' | 'spring' | 'summer' | 'fall' | 'winter';
/** The emotional support cat (ARCHITECTURE "Season scenes and the support cat"): on in every preset. */
export type CatSetting = 'on' | 'off';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type PresetName = 'Default' | 'Neon' | 'Spring' | 'Summer' | 'Fall' | 'Winter' | 'Mordor' | 'Automatic';

export interface ThemeAttrs { glow: Glow; entries: Entries; corners: Corners; scene: ThemeScene; cat: CatSetting }
/** `seed`/`mode` null = keep the person's own seed colour / mode setting. */
export interface Preset { name: PresetName; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs }
export interface ThemePref { preset: PresetName; overrides: Partial<ThemeAttrs> }
export interface ResolvedTheme { name: Exclude<PresetName, 'Automatic'>; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs }

export const PRESET_NAMES: PresetName[] = ['Default', 'Neon', 'Spring', 'Summer', 'Fall', 'Winter', 'Mordor', 'Automatic'];
export const DEFAULT_PREF: ThemePref = { preset: 'Default', overrides: {} };

const base: ThemeAttrs = { glow: 'off', entries: 'solid', corners: 'round', scene: 'none', cat: 'on' };

export const PRESETS: Record<Exclude<PresetName, 'Automatic'>, Preset> = {
  Default: { name: 'Default', seed: null, mode: null, attrs: base },
  Neon: { name: 'Neon', seed: '#9d4dff', mode: 'dark', attrs: { ...base, glow: 'neon', entries: 'outline', corners: 'pill' } },
  Spring: { name: 'Spring', seed: '#4f9d3a', mode: 'light', attrs: { ...base, corners: 'pill', scene: 'spring' } },
  Summer: { name: 'Summer', seed: '#e09a00', mode: 'light', attrs: { ...base, glow: 'soft', scene: 'summer' } },
  Fall: { name: 'Fall', seed: '#b8540c', mode: null, attrs: { ...base, entries: 'tinted', scene: 'fall' } },
  Winter: { name: 'Winter', seed: '#3d79b8', mode: 'dark', attrs: { ...base, glow: 'soft', corners: 'square', scene: 'winter' } },
  Mordor: { name: 'Mordor', seed: '#c43e00', mode: 'dark', attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'mordor' } },
};

/** Season of a local date (`YYYY-MM-DD`): spring from 1 March, summer from 1 June, fall from 1 September, winter from 1 December. */
export function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Fall' : 'Winter';
}

/** The scene that stands for "the season" on a date. */
export function seasonScene(date: string): ThemeScene {
  return seasonOf(date).toLowerCase() as ThemeScene;
}

/** Resolves a preset (Automatic follows the season of `today`) without overrides. */
export function presetFor(name: PresetName, today: string): Preset {
  return PRESETS[name === 'Automatic' ? seasonOf(today) : name];
}

/** The preset plus the person's overrides, ready to be applied. */
export function resolveTheme(pref: ThemePref, today: string): ResolvedTheme {
  const p = presetFor(pref.preset, today);
  return { name: p.name as ResolvedTheme['name'], seed: p.seed, mode: p.mode, attrs: { ...p.attrs, ...pref.overrides } };
}

/** Keeps only known values of a stored/cached preference. */
export function sanitizePref(raw: unknown): ThemePref {
  const r = (raw ?? {}) as { preset?: string; overrides?: Partial<ThemeAttrs> };
  const preset = PRESET_NAMES.includes(r.preset as PresetName) ? (r.preset as PresetName) : 'Default';
  return { preset, overrides: { ...(r.overrides ?? {}) } };
}
