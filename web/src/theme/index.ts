/**
 * Runtime theme control. Default-seed colors are inlined in tokens.css (no flash, no JS needed).
 * A custom seed lazily loads the color library and injects a generated stylesheet that overrides them.
 */
export const DEFAULT_SEED = '#1a73e8';
export type ThemeMode = 'system' | 'light' | 'dark';

const STYLE_ID = 'm3-dynamic-theme';

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

/** Applies a seed color. Resolves once the generated stylesheet is in place. */
export async function applySeed(seedHex: string, doc: Document = document): Promise<void> {
  const existing = doc.getElementById(STYLE_ID);
  if (seedHex.toLowerCase() === DEFAULT_SEED) {
    existing?.remove();
    try { localStorage.removeItem('cal.themeCss'); } catch { /* storage unavailable */ }
    return;
  }
  const { themeCss } = await import('./scheme');
  const style = existing ?? doc.head.appendChild(Object.assign(doc.createElement('style'), { id: STYLE_ID }));
  style.textContent = themeCss(seedHex);
  try { localStorage.setItem('cal.themeCss', style.textContent); } catch { /* storage unavailable */ }
}

export async function applyTheme(opts: { seed?: string; mode?: ThemeMode }): Promise<void> {
  applyThemeMode(opts.mode ?? 'system');
  await applySeed(opts.seed ?? DEFAULT_SEED);
}
