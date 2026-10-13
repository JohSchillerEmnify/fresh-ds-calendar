/**
 * Server-side SVG sanitiser for theme scenes: DOMPurify bound to a jsdom window, with the rules of
 * `@calendar/shared` (ARCHITECTURE "Theme engine and AI themes"). Both libraries load on the first use only,
 * so a server nobody imports a theme into never pays their memory.
 */
import { createSvgSanitizer, type SvgSanitizer } from '@calendar/shared';

let sanitizer: Promise<SvgSanitizer> | null = null;

/** The SVG sanitiser (reports in `removed` whether anything unsafe was taken out), built on first call. */
export function loadSvgSanitizer(): Promise<SvgSanitizer> {
  sanitizer ??= Promise.all([import('dompurify'), import('jsdom')])
    .then(([purify, { JSDOM }]) => createSvgSanitizer(purify.default(new JSDOM('').window)));
  return sanitizer;
}
