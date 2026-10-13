/** Types of the shared theme document module (see index.js). */
export type ThemeMode = 'follow' | 'light' | 'dark';
export type ThemeBuiltinScene = 'none' | 'sunflowers' | 'mordor' | 'spring' | 'easter' | 'summer' | 'summerholidays' | 'fall' | 'halloween' | 'christmas' | 'newyearseve' | 'newyear' | 'winter';
export type ThemeFont = 'system' | 'serif' | 'rounded' | 'mono';
/** Role name (`primary`, `on-surface`, ...) to `#rrggbb`. */
export type ThemeRoles = Record<string, string>;

/** A `calendar-theme/1` document. */
export type ThemeDecor = 'stars' | 'sparkles' | 'waves' | 'hills' | 'hearts' | 'clouds' | 'confetti' | 'bubbles';
export type ThemeDensity = 'low' | 'medium' | 'high';
/** Size of text and rows (not the scene's decor `ThemeDensity`). */
export type ThemeUiDensity = 'compact' | 'comfortable' | 'airy';
export type ThemeCheckbox = 'round' | 'square' | 'rounded';
export type ThemeCheckFill = 'filled' | 'outline';
export type ThemeIcons = 'outlined' | 'rounded' | 'sharp';
export type ThemeCheck = 'tick' | 'bold' | 'cross' | 'dot';
/** The own top bar picture: SVG text, light and optional dark. */
export interface ThemePicture { light?: string; dark?: string }

/** A `calendar-theme/2` document (no SVG in it). */
export interface ThemeDoc {
  schema: 'calendar-theme/2';
  name: string;
  author?: string;
  description?: string;
  mode?: ThemeMode;
  colors?: { seed?: string; light?: ThemeRoles; dark?: ThemeRoles };
  glow?: 'off' | 'soft' | 'neon';
  entries?: 'solid' | 'tinted' | 'outline';
  corners?: 'square' | 'round' | 'pill';
  /** Fine-tuning (optional): ranges are in theme.schema.json. */
  glowStrength?: number;
  radius?: number;
  tint?: number;
  density?: ThemeUiDensity;
  checkbox?: ThemeCheckbox;
  checkFill?: ThemeCheckFill;
  check?: ThemeCheck;
  icons?: ThemeIcons;
  font?: ThemeFont;
  scene?: { builtin?: ThemeBuiltinScene; gradient?: string[]; decor?: ThemeDecor; density?: ThemeDensity };
}

export const THEME_SCHEMA_ID: 'calendar-theme/2';
export const themeSchema: Record<string, unknown>;
export const MAX_THEMES: number;
export const MAX_THEME_BYTES: number;
export const MAX_PICTURE_BYTES: number;

/** One validation problem: a code and params for translating it, and the English message (used by the AI repair prompt). */
export interface ValidationIssue { code: string; params: Record<string, string | number>; message: string }
export function validateThemeIssues(input: unknown): { ok: true; doc: ThemeDoc } | { ok: false; issues: ValidationIssue[] };
export function validatePictureIssues(input: unknown): { ok: true; picture: ThemePicture } | { ok: false; issues: ValidationIssue[] };
export function sanitizePictureIssues(sanitize: SvgSanitizer, picture: ThemePicture): { ok: true; picture: ThemePicture; removed: boolean } | { ok: false; issues: ValidationIssue[] };
export function validateTheme(input: unknown): { ok: true; doc: ThemeDoc } | { ok: false; errors: string[] };

/** The subset of DOMPurify the sanitiser needs. */
export interface Purifier {
  sanitize(dirty: string, cfg: any): unknown;
  addHook(name: any, fn: any): unknown;
  removed: unknown[];
}
export type SvgSanitizer = (svg: string) => { svg: string; removed: boolean };
export function createSvgSanitizer(purify: Purifier): SvgSanitizer;
export function validatePicture(input: unknown): { ok: true; picture: ThemePicture } | { ok: false; errors: string[] };
export function sanitizePicture(sanitize: SvgSanitizer, picture: ThemePicture): { ok: true; picture: ThemePicture; removed: boolean } | { ok: false; errors: string[] };
