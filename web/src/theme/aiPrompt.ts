/**
 * The "Create with AI" prompt (feature theme-import): short, and everything an AI needs to answer
 * with a valid `calendar-theme/2` file. The app calls no AI; the person copies this text into the one they like.
 */
import { THEME_SCHEMA_ID, themeSchema, type ThemeDoc } from '@calendar/shared';

/** A complete, valid example theme shown in the prompt. */
export const EXAMPLE_THEME: ThemeDoc = {
  schema: THEME_SCHEMA_ID, name: 'Ocean', description: 'Deep blue sea with waves.', mode: 'follow',
  colors: { seed: '#0b6e99' }, glow: 'soft', entries: 'tinted', corners: 'round', font: 'rounded',
  scene: { gradient: ['#8fd3f0', '#2b8fb8', '#0b6e99'], decor: 'waves', density: 'medium' },
};

/** The prompt text, ending with a slot for the person's wishes. */
export function themePrompt(): string {
  return `Design a theme for a calendar app. Answer with only the JSON in one code block. No explanation, no SVG, no pictures. Use only the fields of this JSON Schema:
${JSON.stringify(themeSchema)}

Rules:
- Only "schema" and "name" are required. Colours are "#rrggbb".
- "colors.seed" is enough: the app generates the whole scheme for light and dark from it. Set "colors.light"/"colors.dark" roles only for exact colours, then set both.
- Contrast: in light and in dark, text roles ("on-*") against their background must have a contrast ratio of at least 4.5:1.
- "scene.gradient" has 2 or 3 colours, top to bottom; "decor" is one of stars, sparkles, waves, hills, hearts, clouds, confetti, bubbles; "density" is low, medium or high. The app draws it and dims it in dark mode.

Example:
${JSON.stringify(EXAMPLE_THEME)}

My wishes for the theme (replace this line with what you want, e.g. mood, colours, season):
`;
}
