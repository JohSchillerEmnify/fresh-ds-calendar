/**
 * Server-side SVG sanitiser for theme scenes: DOMPurify bound to a jsdom window, with the rules of
 * `@calendar/shared` (ARCHITECTURE "Theme engine and AI themes"). Built on first use, since jsdom is slow to start.
 */
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createSvgSanitizer, type SvgSanitizer } from '@calendar/shared';

let sanitizer: SvgSanitizer | null = null;

/** Sanitises one SVG text; `removed` tells whether anything unsafe was taken out. */
export const sanitizeSvg: SvgSanitizer = (svg) => {
  sanitizer ??= createSvgSanitizer(createDOMPurify(new JSDOM('').window));
  return sanitizer(svg);
};
