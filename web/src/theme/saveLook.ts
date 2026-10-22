/**
 * "Save as my theme" (feature theme-save-own): the look in use (the chosen theme, the person's
 * fine-tuning and the scene) written as a `calendar-theme/2` document, plus the own picture if the scene is one.
 */
import type { ThemeDoc, ThemePicture } from '@calendar/shared';
import type { ThemeMode } from './index';
import type { ResolvedTheme } from './presets';

export const DEFAULT_THEME_NAME = 'My theme';

/** The document (and own picture) for the resolved look; `own` supplies what the theme leaves to the person's settings. */
export function lookToDoc(t: ResolvedTheme, own: { mode: ThemeMode; seed: string }, name: string): { doc: ThemeDoc; picture?: ThemePicture } {
  const mode = t.mode ?? own.mode;
  const roles = { ...(t.roles?.light ? { light: t.roles.light } : {}), ...(t.roles?.dark ? { dark: t.roles.dark } : {}) };
  const custom = t.attrs.scene === 'custom';
  const scene = custom
    ? t.sceneDraw ? { gradient: t.sceneDraw.gradient, ...(t.sceneDraw.decor ? { decor: t.sceneDraw.decor } : {}), density: t.sceneDraw.density } : undefined
    : { builtin: t.attrs.scene as 'none' };
  const doc: ThemeDoc = {
    schema: 'calendar-theme/2', name, mode: mode === 'system' ? 'follow' : mode,
    colors: { seed: (t.seed ?? own.seed).toLowerCase(), ...roles },
    glow: t.attrs.glow, entries: t.attrs.entries, corners: t.attrs.corners,
    ...t.fine,
    ...(t.font ? { font: t.font } : {}),
    ...(scene ? { scene } : {}),
  };
  return { doc, ...(custom && t.sceneSvg ? { picture: t.sceneSvg } : {}) };
}

/** `name`, numbered ("My theme 2") when a theme of that name exists already, so saving never fails on a duplicate. */
export function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  let i = 2;
  while (taken.includes(`${name} ${i}`)) i++;
  return `${name} ${i}`;
}
