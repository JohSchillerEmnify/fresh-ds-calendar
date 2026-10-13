/**
 * Theme presets (ARCHITECTURE "Themes"): a preset is a seed colour, an optional mode and four attributes. A person's
 * choice is a preset name plus overrides of single attributes. Pure data and functions, no DOM.
 */
import type { ThemeDoc, ThemeFont } from '@calendar/shared';
import type { ThemeMode } from './index';

export type Glow = 'off' | 'soft' | 'neon';
export type Entries = 'solid' | 'tinted' | 'outline';
export type Corners = 'square' | 'round' | 'pill';
/** `custom` = the theme's own SVG picture (only ever set by an imported theme, never an override). */
export type ThemeScene = 'none' | 'sunflowers' | 'mordor' | 'spring' | 'summer' | 'fall' | 'winter' | 'halloween' | 'custom';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type PresetName = 'Default' | 'Neon' | 'Spring' | 'Summer' | 'Fall' | 'Halloween' | 'Winter' | 'Mordor' | 'Automatic';

export interface ThemeAttrs { glow: Glow; entries: Entries; corners: Corners; scene: ThemeScene }
/** `seed`/`mode` null = keep the person's own seed colour / mode setting. */
export interface Preset { name: PresetName; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs }
/** An imported theme the person chose: `theme:<id>` (API.md "Imported themes"). */
export type CustomThemeKey = `theme:${string}`;
export interface ThemePref { preset: PresetName | CustomThemeKey; overrides: Partial<ThemeAttrs> }
/** What the one apply path works from, whether it came from a preset or an imported theme document. */
export interface ResolvedTheme {
  name: string; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs;
  /** Role colours replacing single roles of the generated scheme. */
  roles?: { light?: Record<string, string>; dark?: Record<string, string> };
  font?: ThemeFont;
  /** The theme's own scene pictures (SVG text, light and dark variants). */
  sceneSvg?: { light?: string; dark?: string };
}

export const PRESET_NAMES: PresetName[] = ['Default', 'Neon', 'Spring', 'Summer', 'Fall', 'Halloween', 'Winter', 'Mordor', 'Automatic'];
export const DEFAULT_PREF: ThemePref = { preset: 'Default', overrides: {} };

const base: ThemeAttrs = { glow: 'off', entries: 'solid', corners: 'round', scene: 'sunflowers' };

export const PRESETS: Record<Exclude<PresetName, 'Automatic'>, Preset> = {
  Default: { name: 'Default', seed: null, mode: null, attrs: base },
  Neon: { name: 'Neon', seed: '#9d4dff', mode: 'dark', attrs: { ...base, glow: 'neon', entries: 'outline', corners: 'pill' } },
  Spring: { name: 'Spring', seed: '#4f9d3a', mode: null, attrs: { ...base, corners: 'pill', scene: 'spring' } },
  Summer: { name: 'Summer', seed: '#e09a00', mode: null, attrs: { ...base, glow: 'soft', scene: 'summer' } },
  Fall: { name: 'Fall', seed: '#b8540c', mode: null, attrs: { ...base, entries: 'tinted', scene: 'fall' } },
  /** Pumpkin orange; keeps the person's mode: light = dusk, dark = night (owner 2026-10-13). */
  Halloween: { name: 'Halloween', seed: '#e8650c', mode: null, attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'halloween' } },
  Winter: { name: 'Winter', seed: '#3d79b8', mode: null, attrs: { ...base, glow: 'soft', corners: 'square', scene: 'winter' } },
  Mordor: { name: 'Mordor', seed: '#c43e00', mode: 'dark', attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'mordor' } },
};

/** Season of a local date (`YYYY-MM-DD`): spring from 1 March, summer from 1 June, fall from 1 September, winter from 1 December. */
export function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Fall' : 'Winter';
}

/** The preset Automatic stands for on a date: Halloween for all of October, otherwise the season. */
export function automaticPreset(date: string): Season | 'Halloween' {
  return date.slice(5, 7) === '10' ? 'Halloween' : seasonOf(date);
}

/** The scene that stands for "the season" on a date (Automatic's scene, so Halloween in October). */
export function seasonScene(date: string): ThemeScene {
  return PRESETS[automaticPreset(date)].attrs.scene;
}

/** A preset written as a `calendar-theme/1` document, so presets and imported themes share one apply path. */
export function presetDoc(p: Preset): ThemeDoc {
  return {
    schema: 'calendar-theme/1', name: p.name, mode: p.mode === 'light' || p.mode === 'dark' ? p.mode : 'follow', ...(p.seed ? { colors: { seed: p.seed } } : {}),
    glow: p.attrs.glow, entries: p.attrs.entries, corners: p.attrs.corners, scene: { builtin: p.attrs.scene as never },
  };
}

/** The values to apply for a theme document; what the document leaves out takes the app's defaults. */
export function docToResolved(doc: ThemeDoc): ResolvedTheme {
  const svg = doc.scene?.svg;
  return {
    name: doc.name,
    seed: doc.colors?.seed ?? null,
    mode: doc.mode === 'light' || doc.mode === 'dark' ? doc.mode : null,
    attrs: {
      glow: doc.glow ?? 'off', entries: doc.entries ?? 'solid', corners: doc.corners ?? 'round',
      scene: svg ? 'custom' : doc.scene?.builtin ?? 'none',
    },
    ...(doc.colors?.light || doc.colors?.dark ? { roles: { light: doc.colors.light, dark: doc.colors.dark } } : {}),
    ...(doc.font && doc.font !== 'system' ? { font: doc.font } : {}),
    ...(svg ? { sceneSvg: svg } : {}),
  };
}

/** Resolves a preset (Automatic follows `automaticPreset` of `today`) without overrides. */
export function presetFor(name: PresetName, today: string): Preset {
  return PRESETS[name === 'Automatic' ? automaticPreset(today) : name];
}

/**
 * The chosen theme (a preset or one of the person's imported themes, `custom` by id) plus the person's overrides,
 * ready to be applied. An imported theme that is gone falls back to Default.
 */
export function resolveTheme(pref: ThemePref, today: string, custom: Record<string, ThemeDoc> = {}): ResolvedTheme {
  const id = pref.preset.startsWith('theme:') ? pref.preset.slice(6) : null;
  const doc = id === null ? presetDoc(presetFor(pref.preset as PresetName, today)) : custom[id];
  const base = docToResolved(doc ?? presetDoc(PRESETS.Default));
  return { ...base, attrs: { ...base.attrs, ...pref.overrides } };
}

const ATTR_KEYS = Object.keys(base) as (keyof ThemeAttrs)[];

/** Keeps only known values of a stored/cached preference (drops retired attributes such as the old `cat` switch). */
export function sanitizePref(raw: unknown): ThemePref {
  const r = (raw ?? {}) as { preset?: string; overrides?: Record<string, unknown> };
  const preset = PRESET_NAMES.includes(r.preset as PresetName) || /^theme:[A-Za-z0-9_-]{1,32}$/.test(r.preset ?? '') ? (r.preset as ThemePref['preset']) : 'Default';
  const overrides = Object.fromEntries(Object.entries(r.overrides ?? {}).filter(([k]) => ATTR_KEYS.includes(k as keyof ThemeAttrs)));
  return { preset, overrides: overrides as Partial<ThemeAttrs> };
}
