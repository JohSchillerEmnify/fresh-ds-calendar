/** Google event palette, seed presets and color helpers (API.md "Colors"). */
export interface NamedColor {
  id: string;
  name: string;
  hex: string;
}

export const GOOGLE_COLORS: NamedColor[] = [
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '11', name: 'Tomato', hex: '#d50000' },
];

/** Display order of event color options (ARCHITECTURE.md `event-color`), after "Calendar color". */
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

function lab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Nearest Google colorId by CIE76 ΔE; ties → lower id. */
export function nearestGoogleColorId(hex: string): string {
  const [l, a, b] = lab(hex);
  let best = GOOGLE_COLORS[0];
  let bestD = Infinity;
  for (const c of GOOGLE_COLORS) {
    const [l2, a2, b2] = lab(c.hex);
    const d = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < bestD - 1e-9) {
      bestD = d;
      best = c;
    }
  }
  return best.id;
}

export function googleColor(id: string | null | undefined): NamedColor | undefined {
  return GOOGLE_COLORS.find((c) => c.id === id);
}
