/**
 * Runtime theme control. Default-seed colors are inlined in tokens.css (no flash, no JS needed).
 * A custom seed lazily loads the color library and injects a generated stylesheet that overrides them.
 */
export const DEFAULT_SEED = '#1a73e8';
export type ThemeMode = 'system' | 'light' | 'dark';

const STYLE_ID = 'm3-dynamic-theme';

export function applyThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

/** Applies a seed color. Resolves once the generated stylesheet is in place. */
export async function applySeed(seedHex: string, doc: Document = document): Promise<void> {
  const existing = doc.getElementById(STYLE_ID);
  if (seedHex.toLowerCase() === DEFAULT_SEED) {
    existing?.remove();
    return;
  }
  const { themeCss } = await import('./scheme');
  const style = existing ?? doc.head.appendChild(Object.assign(doc.createElement('style'), { id: STYLE_ID }));
  style.textContent = themeCss(seedHex);
}

export async function applyTheme(opts: { seed?: string; mode?: ThemeMode }): Promise<void> {
  applyThemeMode(opts.mode ?? 'system');
  await applySeed(opts.seed ?? DEFAULT_SEED);
}
