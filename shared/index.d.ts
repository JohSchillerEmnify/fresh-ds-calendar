/** Types of the shared theme document module (see index.js). */
export type ThemeMode = 'follow' | 'light' | 'dark';
export type ThemeBuiltinScene = 'none' | 'sunflowers' | 'mordor' | 'spring' | 'summer' | 'fall' | 'winter' | 'halloween';
export type ThemeFont = 'system' | 'serif' | 'rounded' | 'mono';
/** Role name (`primary`, `on-surface`, ...) to `#rrggbb`. */
export type ThemeRoles = Record<string, string>;

/** A `calendar-theme/1` document. */
export interface ThemeDoc {
  schema: 'calendar-theme/1';
  name: string;
  author?: string;
  description?: string;
  mode?: ThemeMode;
  colors?: { seed?: string; light?: ThemeRoles; dark?: ThemeRoles };
  glow?: 'off' | 'soft' | 'neon';
  entries?: 'solid' | 'tinted' | 'outline';
  corners?: 'square' | 'round' | 'pill';
  font?: ThemeFont;
  scene?: { builtin?: ThemeBuiltinScene; svg?: { light?: string; dark?: string } };
}

export const THEME_SCHEMA_ID: 'calendar-theme/1';
export const themeSchema: Record<string, unknown>;
export const MAX_THEMES: number;
export const MAX_THEME_BYTES: number;

export function validateTheme(input: unknown): { ok: true; doc: ThemeDoc } | { ok: false; errors: string[] };

/** The subset of DOMPurify the sanitiser needs. */
export interface Purifier {
  sanitize(dirty: string, cfg: any): unknown;
  addHook(name: any, fn: any): unknown;
  removed: unknown[];
}
export type SvgSanitizer = (svg: string) => { svg: string; removed: boolean };
export function createSvgSanitizer(purify: Purifier): SvgSanitizer;
export function sanitizeTheme(sanitize: SvgSanitizer, doc: ThemeDoc): { ok: true; doc: ThemeDoc; removed: boolean } | { ok: false; errors: string[] };
