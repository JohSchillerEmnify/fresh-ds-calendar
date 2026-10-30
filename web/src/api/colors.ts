/** Google event palette, seed presets and color helpers (API.md "Colors"). */
import { GOOGLE_COLORS as PALETTE, nearestGoogleColorId } from '@calendar/shared/colors';

export interface NamedColor {
  id: string;
  name: string;
  hex: string;
}

export const GOOGLE_COLORS: NamedColor[] = Object.entries(PALETTE).map(([id, c]) => ({ id, ...c }));

/** Display order of event color options (feature event-colors), after "Calendar color". */
export const EVENT_COLOR_ORDER = ['11', '4', '6', '5', '2', '10', '7', '9', '1', '3', '8'];
export const EVENT_COLOR_OPTIONS: NamedColor[] = EVENT_COLOR_ORDER.map((id) => GOOGLE_COLORS.find((c) => c.id === id)!);

export const SEED_PRESETS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#1a73e8' },
  { name: 'Purple', hex: '#6750a4' },
  { name: 'Teal', hex: '#006a6a' },
  { name: 'Green', hex: '#386a20' },
  { name: 'Orange', hex: '#e8710a' },
  { name: 'Red', hex: '#b3261e' },
  { name: 'Pink', hex: '#c2185b' },
  { name: 'Slate', hex: '#4f6170' },
];

/** Owner addition: the "Mordor" theme preset (seed + dark mode + Mordor scene). */
export const MORDOR_SEED = '#c43e00';

const HEX = /^#[0-9a-fA-F]{6}$/;
export function isHexColor(s: string): boolean {
  return HEX.test(s.trim());
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Black or white text, whichever contrasts more with `bg`. */
export function onColor(bg: string): '#000000' | '#ffffff' {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#ffffff') ? '#000000' : '#ffffff';
}

export { nearestGoogleColorId };

export function googleColor(id: string | null | undefined): NamedColor | undefined {
  return GOOGLE_COLORS.find((c) => c.id === id);
}
