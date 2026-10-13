/**
 * Fine-tuning values of a theme (ARCHITECTURE "Fine-tuning sliders, density and icon choices"): the numbers behind the
 * glow, corner and tint sliders, density and the checkbox choices. Pure data and functions, no DOM: step <-> value
 * mapping, the CSS custom properties a value stands for, and sanitising of stored or imported values.
 */
import type { ThemeCheck, ThemeCheckbox, ThemeCheckFill, ThemeIcons, ThemeUiDensity } from '@calendar/shared';

export type Density = ThemeUiDensity;
export type CheckboxShape = ThemeCheckbox;
export type CheckFill = ThemeCheckFill;
export type CheckGlyph = ThemeCheck;
export type IconSetName = ThemeIcons;

/** The fine-tuning part of a theme; every field is optional (a missing one means the theme's step / default). */
export interface ThemeFine {
  glowStrength?: number; radius?: number; tint?: number; density?: Density; checkbox?: CheckboxShape; checkFill?: CheckFill; check?: CheckGlyph; icons?: IconSetName;
}

/** Inclusive integer ranges of the sliders. */
export const RANGES = { glowStrength: [0, 150], radius: [0, 28], tint: [5, 60] } as const;
export const DEFAULT_TINT = 24;
/** Slider value of each step choice. */
export const GLOW_STEPS = { off: 0, soft: 40, neon: 100 } as const;
export const RADIUS_STEPS = { square: 2, round: 6, pill: 28 } as const;
/** Font size factor of each density. */
export const DENSITY_SCALE: Record<Density, number> = { compact: 0.9, comfortable: 1, airy: 1.12 };

export const DENSITIES: Density[] = ['compact', 'comfortable', 'airy'];
export const CHECKBOXES: CheckboxShape[] = ['round', 'square', 'rounded'];
export const CHECK_FILLS: CheckFill[] = ['filled', 'outline'];
export const CHECK_GLYPHS: CheckGlyph[] = ['tick', 'bold', 'cross', 'dot'];
export const ICON_SETS: IconSetName[] = ['outlined', 'rounded', 'sharp'];

/** The step whose value is exactly `value`, or null between steps. */
export function stepOf<K extends string>(steps: Record<K, number>, value: number): K | null {
  return (Object.keys(steps) as K[]).find((k) => steps[k] === value) ?? null;
}

/** `value` as an integer inside `[min, max]`, or undefined when it is not a whole number in range. */
function intIn(value: unknown, [min, max]: readonly [number, number]): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** Linear interpolation of `x` over sorted anchor rows `[x, ...ys]`; clamps outside the anchors. */
function lerp(anchors: number[][], x: number): number[] {
  const hi = anchors.findIndex((a) => a[0] >= x);
  if (hi < 0) return anchors[anchors.length - 1].slice(1);
  if (hi === 0) return anchors[0].slice(1);
  const [x0, ...a] = anchors[hi - 1];
  const [x1, ...b] = anchors[hi];
  const t = (x - x0) / (x1 - x0);
  return a.map((v, i) => Math.round((v + (b[i] - v) * t) * 10) / 10);
}

/** Glow rows: strength, blur radius px, spread px, shadow alpha %. Soft and neon are today's two steps. */
const GLOW_ANCHORS = [[0, 0, 0, 0], [40, 9, 0, 55], [100, 14, 2, 95], [150, 20, 4, 100]];
/** Block radius rows: slider px, block radius px (chips take the slider value itself). */
const BLOCK_ANCHORS = [[0, 0], [2, 2], [6, 8], [28, 16]];

/** The glow custom properties of a strength (the neon pulse starts at the neon step). */
export function glowVars(strength: number): Record<string, string> {
  const [r, s, a] = lerp(GLOW_ANCHORS, strength);
  return { '--glow-r': `${r}px`, '--glow-s': `${s}px`, '--glow-a': `${a}%`, '--glow-anim': strength >= GLOW_STEPS.neon ? 'neon-pulse' : 'initial' };
}

/** The corner custom properties of a radius in px; the top of the range is the pill. */
export function radiusVars(px: number): Record<string, string> {
  return { '--r-chip': px >= RANGES.radius[1] ? '999px' : `${px}px`, '--r-block': `${lerp(BLOCK_ANCHORS, px)[0]}px` };
}

/** The custom properties of a fine-tuning (`tint` counts only while the entries are tinted). */
export function fineVars(fine: ThemeFine, entries: string): Record<string, string> {
  return {
    ...(fine.glowStrength !== undefined ? glowVars(fine.glowStrength) : {}),
    ...(fine.radius !== undefined ? radiusVars(fine.radius) : {}),
    ...(fine.tint !== undefined && entries === 'tinted' ? { '--e-fill': `${fine.tint}%` } : {}),
    ...(fine.density ? { '--dz': String(DENSITY_SCALE[fine.density]) } : {}),
  };
}

/** Keeps only valid fine-tuning values of unknown input (a stored preference or an imported document). */
export function sanitizeFine(raw: unknown): ThemeFine {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[]) => (list.includes(v as T) ? (v as T) : undefined);
  const out: ThemeFine = {
    glowStrength: intIn(r.glowStrength, RANGES.glowStrength), radius: intIn(r.radius, RANGES.radius), tint: intIn(r.tint, RANGES.tint),
    density: pick(r.density, DENSITIES), checkbox: pick(r.checkbox, CHECKBOXES), checkFill: pick(r.checkFill, CHECK_FILLS), check: pick(r.check, CHECK_GLYPHS), icons: pick(r.icons, ICON_SETS),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as ThemeFine;
}

/** The names of all fine-tuning fields (what `sanitizePref` lets through for overrides). */
export const FINE_KEYS = ['glowStrength', 'radius', 'tint', 'density', 'checkbox', 'checkFill', 'check', 'icons'] as const satisfies readonly (keyof ThemeFine)[];

/** Text shown next to a slider: `4 px`, `30 %`, glow strength without a unit. */
export function sliderText(kind: 'glowStrength' | 'radius' | 'tint', value: number): string {
  return kind === 'radius' ? `${value} px` : kind === 'tint' ? `${value} %` : String(value);
}
