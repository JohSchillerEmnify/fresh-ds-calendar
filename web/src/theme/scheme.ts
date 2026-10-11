/**
 * M3 color roles from a seed color (Material Color Utilities, 2025 spec = M3 Expressive).
 * This module pulls in the color library (~20 KB gz), so the app loads it lazily via `import()`
 * only when the user picks a non-default seed. Defaults are pre-generated into tokens.css.
 */
import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

/** CSS custom property name for an MCU role name, e.g. `on_primary_container` -> `--md-sys-color-on-primary-container`. */
export function roleVar(name: string): string {
  return `--md-sys-color-${name.replace(/_/g, '-')}`;
}

const SKIP = /palette_key_color$|_dim$/;

export function schemeVars(seedHex: string, dark: boolean, contrast = 0): Record<string, string> {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seedHex)), dark, contrast, '2025');
  const out: Record<string, string> = {};
  for (const color of new MaterialDynamicColors().allColors) {
    if (!color || SKIP.test(color.name)) continue;
    out[roleVar(color.name)] = hexFromArgb(color.getArgb(scheme));
  }
  return out;
}

function block(selector: string, vars: Record<string, string>, colorScheme: 'light' | 'dark'): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n  color-scheme: ${colorScheme};\n${body}\n}`;
}

/**
 * Full theme stylesheet for a seed: light on :root, dark via OS preference (unless forced light)
 * or forced with `<html data-theme="dark">`.
 */
export function themeCss(seedHex: string): string {
  const light = schemeVars(seedHex, false);
  const dark = schemeVars(seedHex, true);
  return [
    block(':root', light, 'light'),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', dark, 'dark')}\n}`,
    block(':root[data-theme="dark"]', dark, 'dark'),
  ].join('\n');
}
