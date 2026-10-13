/**
 * Runtime theme control: the one path (`applyTheme`) that puts a resolved theme (a preset or an imported theme
 * document, see `presets.ts`) on `<html>`. Default-seed colors are inlined in tokens.css (no flash, no JS needed).
 * A custom seed, role colours or font lazily load the color library and inject a generated stylesheet that overrides them.
 */
import type { ThemeFont } from '@calendar/shared';
import type { ResolvedTheme } from './presets';

export const DEFAULT_SEED = '#1a73e8';
export type ThemeMode = 'system' | 'light' | 'dark';

const STYLE_ID = 'm3-dynamic-theme';
const ATTR_KEY = 'cal.themeAttrs';

/** Curated font stacks of a theme document's `font` (system = the app's own). */
const FONT_STACKS: Record<Exclude<ThemeFont, 'system'>, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "ui-rounded, 'SF Pro Rounded', Nunito, Quicksand, 'Hiragino Maru Gothic ProN', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
};

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}
/** `system` resolves to the current OS preference (the caller re-applies when it changes). */
export function resolveTheme(mode: ThemeMode, dark: boolean = prefersDark()): 'light' | 'dark' {
  return mode === 'system' ? (dark ? 'dark' : 'light') : mode;
}
/** Sets `<html data-theme="light|dark">` (always one of the two). */
export function applyThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', resolveTheme(mode));
  try { localStorage.setItem('cal.themeMode', mode); } catch { /* storage unavailable */ }
}

/** What a theme adds to the generated scheme: role colours and a font. */
export interface ThemeLook { roles?: ResolvedTheme['roles']; font?: ThemeFont }

/** Applies a seed color (and the look). Resolves once the generated stylesheet is in place. */
export async function applySeed(seedHex: string, doc: Document = document, look: ThemeLook = {}): Promise<void> {
  const existing = doc.getElementById(STYLE_ID);
  const font = look.font && look.font !== 'system' ? look.font : null;
  if (seedHex.toLowerCase() === DEFAULT_SEED && !look.roles && !font) {
    existing?.remove();
    try { localStorage.removeItem('cal.themeCss'); } catch { /* storage unavailable */ }
    return;
  }
  const { themeCss } = await import('./scheme');
  const style = existing ?? Object.assign(doc.createElement('style'), { id: STYLE_ID });
  style.textContent = themeCss(seedHex, look.roles) + (font ? `\n:root { --font: ${FONT_STACKS[font]}; }` : '');
  // Always (re)append: the pre-paint copy from index.html sits before the app stylesheet and would lose the cascade.
  doc.head.appendChild(style);
  try { localStorage.setItem('cal.themeCss', style.textContent); } catch { /* storage unavailable */ }
}

/** Mirrors the theme's attributes onto `<html>` (read by theme.css and the shell) and caches them for the next first paint. */
export function applyAttrs(t: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme-name', t.name);
  root.setAttribute('data-glow', t.attrs.glow);
  root.setAttribute('data-entries', t.attrs.entries);
  root.setAttribute('data-corners', t.attrs.corners);
  root.setAttribute('data-scene', t.attrs.scene);
  try { localStorage.setItem(ATTR_KEY, JSON.stringify({ name: t.name, ...t.attrs })); } catch { /* storage unavailable */ }
}

/**
 * The one apply path: attributes, light/dark, colours and font of a resolved theme. What the theme leaves open
 * (mode, seed) is the person's own setting (`own`).
 */
export async function applyTheme(t: ResolvedTheme, own: { mode: ThemeMode; seed: string }, root: HTMLElement = document.documentElement): Promise<void> {
  applyAttrs(t, root);
  applyThemeMode(t.mode ?? own.mode, root);
  await applySeed(t.seed ?? own.seed, root.ownerDocument, { roles: t.roles, font: t.font });
}
