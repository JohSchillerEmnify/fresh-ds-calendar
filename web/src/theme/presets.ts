/**
 * Theme presets (feature theme-menu): a preset is a seed colour, an optional mode and four attributes. A person's
 * choice is a preset name plus overrides of single attributes. Pure data and functions, no DOM.
 */
import type { ThemeDecor, ThemeDensity, ThemeDoc, ThemeFont, ThemePicture } from '@calendar/shared';
import { holidayOf, type Holiday } from './holidays';
import { FINE_KEYS, sanitizeFine, type ThemeFine } from './fine';
import type { ThemeMode } from './index';

export type Glow = 'off' | 'soft' | 'neon';
export type Entries = 'solid' | 'tinted' | 'outline';
export type Corners = 'square' | 'round' | 'pill';
/** `custom` = the theme's own SVG picture (only ever set by an imported theme, never an override). */
export type ThemeScene = 'none' | 'sunflowers' | 'mordor' | 'spring' | 'summer' | 'fall' | 'winter' | 'halloween'
  | 'easter' | 'summerholidays' | 'christmas' | 'newyearseve' | 'newyear' | 'custom';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type PresetName = 'Default' | 'Neon' | 'Spring' | 'Summer' | 'Fall' | 'Halloween' | 'Winter' | 'Mordor'
  | 'Easter' | 'Summer holidays' | 'Christmas' | 'New Year\'s Eve' | 'New Year';
/** A theme the calendar can stand for on a date: a season, Halloween or a holiday. */
export type CalendarPreset = Season | 'Halloween' | Holiday;
export interface ThemeAttrs { glow: Glow; entries: Entries; corners: Corners; scene: ThemeScene }
/** `seed`/`mode` null = keep the person's own seed colour / mode setting. */
export interface Preset { name: PresetName; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs }
/** An imported theme the person chose: `theme:<id>` (API.md "Imported themes"). */
export type CustomThemeKey = `theme:${string}`;
/** What the person's fine-tuning replaces of the chosen theme: the four attributes and the seed colour. */
export type ThemeOverrides = Partial<ThemeAttrs> & ThemeFine & { seed?: string };
/** Whether the calendar changes the theme by itself: not at all, only the header (scene), or colours and header. */
export type Seasonal = 'off' | 'header' | 'all';
export interface ThemePref { preset: PresetName | CustomThemeKey; overrides: ThemeOverrides; seasonal: Seasonal }
/** What the one apply path works from, whether it came from a preset or an imported theme document. */
export interface ResolvedTheme {
  name: string; seed: string | null; mode: ThemeMode | null; attrs: ThemeAttrs;
  /** Fine-tuning values (sliders, density, checkbox) of the theme; what is left out takes the step's or the app's default. */
  fine: ThemeFine;
  /** Role colours replacing single roles of the generated scheme. */
  roles?: { light?: Record<string, string>; dark?: Record<string, string> };
  font?: ThemeFont;
  /** The theme's own picture (SVG text, light and optional dark); it replaces the drawn scene. */
  sceneSvg?: ThemePicture;
  /** The scene the app draws from building blocks (attrs.scene is `custom` for it). */
  sceneDraw?: { gradient: string[]; decor?: ThemeDecor; density: ThemeDensity };
}
/** An imported or saved theme as the resolver needs it. */
export interface CustomTheme { doc: ThemeDoc; picture?: ThemePicture }

export const PRESET_NAMES: PresetName[] = [
  'Default', 'Neon', 'Spring', 'Easter', 'Summer', 'Summer holidays', 'Fall', 'Halloween', 'Christmas', 'New Year\'s Eve', 'New Year', 'Winter', 'Mordor',
];
/** A new person starts with the season's colours and header on base Default. */
export const DEFAULT_PREF: ThemePref = { preset: 'Default', overrides: {}, seasonal: 'all' };

const base: ThemeAttrs = { glow: 'off', entries: 'solid', corners: 'round', scene: 'none' };

export const PRESETS: Record<PresetName, Preset> = {
  Default: { name: 'Default', seed: null, mode: null, attrs: base },
  Neon: { name: 'Neon', seed: '#9d4dff', mode: 'dark', attrs: { ...base, glow: 'neon', entries: 'outline', corners: 'pill' } },
  Spring: { name: 'Spring', seed: '#4f9d3a', mode: null, attrs: { ...base, corners: 'pill', scene: 'spring' } },
  Summer: { name: 'Summer', seed: '#e09a00', mode: null, attrs: { ...base, glow: 'soft', scene: 'summer' } },
  Fall: { name: 'Fall', seed: '#b8540c', mode: null, attrs: { ...base, entries: 'tinted', scene: 'fall' } },
  /** Pumpkin orange; keeps the person's mode: light = dusk, dark = night (owner 2026-10-13). */
  Halloween: { name: 'Halloween', seed: '#e8650c', mode: null, attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'halloween' } },
  /** Holiday presets keep the person's mode like the season ones (feature theme-scenes). */
  Easter: { name: 'Easter', seed: '#8e6bbf', mode: null, attrs: { ...base, entries: 'tinted', corners: 'pill', scene: 'easter' } },
  'Summer holidays': { name: 'Summer holidays', seed: '#0097a7', mode: null, attrs: { ...base, glow: 'soft', scene: 'summerholidays' } },
  Christmas: { name: 'Christmas', seed: '#c62828', mode: null, attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'christmas' } },
  'New Year\'s Eve': { name: 'New Year\'s Eve', seed: '#d4af37', mode: 'dark', attrs: { ...base, glow: 'neon', entries: 'tinted', scene: 'newyearseve' } },
  'New Year': { name: 'New Year', seed: '#00897b', mode: null, attrs: { ...base, glow: 'soft', corners: 'pill', scene: 'newyear' } },
  Winter: { name: 'Winter', seed: '#3d79b8', mode: null, attrs: { ...base, glow: 'soft', corners: 'square', scene: 'winter' } },
  Mordor: { name: 'Mordor', seed: '#c43e00', mode: 'dark', attrs: { ...base, glow: 'soft', entries: 'tinted', scene: 'mordor' } },
};

/** Season of a local date (`YYYY-MM-DD`): spring from 1 March, summer from 1 June, fall from 1 September, winter from 1 December. */
export function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Fall' : 'Winter';
}

/**
 * The calendar's theme for a date, by its priority: New Year's Eve, New Year, Christmas, Easter,
 * Halloween (all of October), then the season. Summer holidays is never picked.
 */
export function automaticPreset(date: string): CalendarPreset {
  return holidayOf(date) ?? (date.slice(5, 7) === '10' ? 'Halloween' : seasonOf(date));
}

/** The scene that stands for "the season" on a date (the calendar's scene, so Halloween in October). */
export function seasonScene(date: string): ThemeScene {
  return PRESETS[automaticPreset(date)].attrs.scene;
}

/** A preset written as a `calendar-theme/1` document, so presets and imported themes share one apply path. */
export function presetDoc(p: Preset): ThemeDoc {
  return {
    schema: 'calendar-theme/2', name: p.name, mode: p.mode === 'light' || p.mode === 'dark' ? p.mode : 'follow', ...(p.seed ? { colors: { seed: p.seed } } : {}),
    glow: p.attrs.glow, entries: p.attrs.entries, corners: p.attrs.corners, scene: { builtin: p.attrs.scene as never },
  };
}

/** The values to apply for a theme document (and its own picture); what it leaves out takes the app's defaults. */
export function docToResolved(doc: ThemeDoc, picture?: ThemePicture): ResolvedTheme {
  const draw = doc.scene?.gradient;
  const own = !!(picture?.light || picture?.dark);
  return {
    name: doc.name,
    seed: doc.colors?.seed ?? null,
    mode: doc.mode === 'light' || doc.mode === 'dark' ? doc.mode : null,
    attrs: {
      glow: doc.glow ?? 'off', entries: doc.entries ?? 'solid', corners: doc.corners ?? 'round',
      scene: own || draw ? 'custom' : doc.scene?.builtin ?? 'none',
    },
    fine: sanitizeFine(doc),
    ...(doc.colors?.light || doc.colors?.dark ? { roles: { light: doc.colors.light, dark: doc.colors.dark } } : {}),
    ...(doc.font && doc.font !== 'system' ? { font: doc.font } : {}),
    ...(own ? { sceneSvg: picture } : {}),
    ...(draw ? { sceneDraw: { gradient: draw, decor: doc.scene?.decor, density: doc.scene?.density ?? 'medium' } } : {}),
  };
}

/**
 * The chosen theme (a preset or one of the person's imported themes, `custom` by id) plus the seasons & holidays
 * setting and the person's overrides, ready to be applied. An imported theme that is gone falls back to Default.
 * `all`: the calendar's theme for `today` replaces the colours and style (seed, mode rule, glow, entries, corners, role
 * colours) and its scene is the header; `header`: only the scene follows the calendar; `off`: the chosen theme as is.
 * Fine-tuning overrides sit on top, an explicit scene override wins over the calendar's scene.
 */
export function resolveTheme(pref: ThemePref, today: string, custom: Record<string, CustomTheme> = {}): ResolvedTheme {
  const id = pref.preset.startsWith('theme:') ? pref.preset.slice(6) : null;
  const own = id === null ? { doc: presetDoc(PRESETS[pref.preset as PresetName]) } : custom[id];
  let base = own ? docToResolved(own.doc, own.picture) : docToResolved(presetDoc(PRESETS.Default));
  if (pref.seasonal === 'all') {
    const { roles: _roles, ...rest } = base;
    const cal = PRESETS[automaticPreset(today)];
    // the calendar's style replaces the theme's, so the theme's own glow and corner numbers go with it
    const { glowStrength: _g, radius: _r, ...fineKept } = base.fine;
    base = { ...rest, fine: fineKept, name: cal.name, seed: cal.seed, mode: cal.mode, attrs: { ...base.attrs, glow: cal.attrs.glow, entries: cal.attrs.entries, corners: cal.attrs.corners } };
  }
  const { seed, ...rest } = pref.overrides;
  const fine = sanitizeFine(rest);
  const attrs = Object.fromEntries(Object.entries(rest).filter(([k]) => !(FINE_KEYS as readonly string[]).includes(k))) as Partial<ThemeAttrs>;
  const scene = attrs.scene ?? (pref.seasonal === 'off' ? base.attrs.scene : seasonScene(today));
  // a step picked as override (glow, corners) wins over the theme's own number, which the step's own value then stands for
  const inherited = { ...base.fine };
  if (rest.glow && fine.glowStrength === undefined) delete inherited.glowStrength;
  if (rest.corners && fine.radius === undefined) delete inherited.radius;
  return { ...base, ...(seed ? { seed } : {}), fine: { ...inherited, ...fine }, attrs: { ...base.attrs, ...attrs, scene } };
}

const ATTR_KEYS = Object.keys(base) as (keyof ThemeAttrs)[];

const SEASONAL: Seasonal[] = ['off', 'header', 'all'];

/** Keeps only known values of a stored/cached preference (drops retired attributes such as the old `cat` switch). */
export function sanitizePref(raw: unknown): ThemePref {
  if (raw == null) return { ...DEFAULT_PREF, overrides: {} };
  const r = (raw ?? {}) as { preset?: string; overrides?: Record<string, unknown>; seasonal?: string };
  const stored = r.preset === 'Automatic' ? 'Default' : r.preset;
  const preset = PRESET_NAMES.includes(stored as PresetName) || /^theme:[A-Za-z0-9_-]{1,32}$/.test(stored ?? '') ? (stored as ThemePref['preset']) : 'Default';
  const o = r.overrides ?? {};
  const attrs = Object.entries(o).filter(([k, v]) => (k === 'seed' ? typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) : ATTR_KEYS.includes(k as keyof ThemeAttrs) && v !== 'season'));
  // a cached preference from before the setting existed: Automatic => all, the old `season` scene => header, else off
  const legacy: Seasonal = r.preset === 'Automatic' ? 'all' : o.scene === 'season' ? 'header' : 'off';
  const seasonal = SEASONAL.includes(r.seasonal as Seasonal) ? (r.seasonal as Seasonal) : legacy;
  return { preset, overrides: { ...Object.fromEntries(attrs), ...sanitizeFine(o) } as ThemeOverrides, seasonal };
}
