/**
 * The "Create with AI" prompt (ARCHITECTURE "Theme engine and AI themes"): everything an AI needs to answer with a
 * valid `calendar-theme/1` file. The app calls no AI; the person copies this text into the one they like.
 */
import { THEME_SCHEMA_ID, themeSchema, type ThemeDoc } from '@calendar/shared';

const wave = (sky: [string, string], back: string, front: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="1200" height="120" fill="url(#sky)"/><path d="M0 80 Q150 50 300 80 T600 80 T900 80 T1200 80 V120 H0Z" fill="${back}"/><path d="M0 98 Q200 74 400 98 T800 98 T1200 98 V120 H0Z" fill="${front}"/></svg>`;

/** A complete, valid example theme shown in the prompt. */
export const EXAMPLE_THEME: ThemeDoc = {
  schema: THEME_SCHEMA_ID, name: 'Ocean', author: 'Example', description: 'Deep blue with waves in the top bar.',
  mode: 'follow', colors: { seed: '#0b6e99' }, glow: 'soft', entries: 'tinted', corners: 'round', font: 'rounded',
  scene: { svg: { light: wave(['#cfeefc', '#8fd3f0'], '#2b8fb8', '#0b6e99'), dark: wave(['#06222e', '#0b3a4f'], '#0f5878', '#0a3d56') } },
};

/** The prompt text, ending with a slot for the person's wishes. */
export function themePrompt(): string {
  return `You design a visual theme for a calendar web app (month, week and day views with events and task lists, a top bar and a settings menu). Answer with ONE JSON document of format "${THEME_SCHEMA_ID}" and nothing else: no explanation, no Markdown fence.

JSON Schema of the document:
${JSON.stringify(themeSchema)}

Rules:
- Only "schema" and "name" are required. Leave out what you do not want to change. Never add fields the schema does not list.
- The easiest good theme is a "seed" colour (the app generates a complete Material 3 scheme in light and dark from it). Only set "colors.light" / "colors.dark" roles when the wishes need exact colours, and then set both.
- Contrast: in light and in dark, every "on-*" role against its background role (for example on-primary on primary, on-surface on surface) must have a contrast ratio of at least 4.5:1, and on-surface on surface at least 7:1. Text must stay readable.
- Scene picture (optional, "scene.svg"): one complete <svg> per variant, wide and low (viewBox 0 0 1200 120, preserveAspectRatio "xMidYMid slice"), under 20 KB, calm shapes with soft contrast because the title and buttons sit on top of it. It is shown only as an image with its own colours, so give a "light" and a "dark" variant (without "dark", "light" is used for both).
- The SVG must not contain script, style, use, image, foreignObject or animation elements, event attributes (onload, onclick, ...), external links or fonts. References only to elements inside the same SVG (href="#id", url(#id)). Colours as hex values.
- "name" is short (at most 40 characters).

Complete example:
${JSON.stringify(EXAMPLE_THEME)}

My wishes for the theme (replace this line with what you want, e.g. mood, colours, season, a picture for the top bar):
`;
}
