/**
 * Browser side of the theme scene pictures (ADR 0016): the SVG is sanitised again
 * with DOMPurify (loaded lazily, like the color library) and only ever shown as an image through a `data:` URL.
 */
import type { SvgSanitizer } from '@calendar/shared';
import { shallowRef, watch, type ShallowRef } from 'vue';

let sanitizer: Promise<SvgSanitizer> | null = null;

/** The SVG sanitiser (rules shared with the server), built on first use; its code loads lazily with it. */
export function loadSvgSanitizer(): Promise<SvgSanitizer> {
  sanitizer ??= Promise.all([import('dompurify'), import('@calendar/shared')]).then(([purify, shared]) => shared.createSvgSanitizer(purify.default(window)));
  return sanitizer;
}

/** A sanitised SVG as a `data:` URL for an `<img>`. */
export async function svgDataUrl(svg: string): Promise<string> {
  const { svg: safe } = (await loadSvgSanitizer())(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safe)}`;
}

/** Image URLs of a theme's scene variants (light, dark; a missing dark falls back to light); null until ready. */
export function useSceneUrls(source: () => { light?: string; dark?: string } | undefined): ShallowRef<{ light: string; dark: string } | null> {
  const urls = shallowRef<{ light: string; dark: string } | null>(null);
  let run = 0;
  watch(source, async (svg) => {
    const mine = ++run;
    const light = svg?.light ?? svg?.dark;
    const dark = svg?.dark ?? svg?.light;
    if (!light || !dark) { urls.value = null; return; }
    const [l, d] = await Promise.all([svgDataUrl(light), dark === light ? null : svgDataUrl(dark)]);
    if (mine === run) urls.value = { light: l, dark: d ?? l };
  }, { immediate: true });
  return urls;
}
