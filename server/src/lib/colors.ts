/** Google event palette and nearest-color lookup (CIE76 ΔE in CIELAB, D65). Pure; shared with web/. */

export const GOOGLE_COLORS: Readonly<Record<string, { hex: string; name: string }>> = {
  '1': { hex: '#7986cb', name: 'Lavender' },
  '2': { hex: '#33b679', name: 'Sage' },
  '3': { hex: '#8e24aa', name: 'Grape' },
  '4': { hex: '#e67c73', name: 'Flamingo' },
  '5': { hex: '#f6bf26', name: 'Banana' },
  '6': { hex: '#f4511e', name: 'Tangerine' },
  '7': { hex: '#039be5', name: 'Peacock' },
  '8': { hex: '#616161', name: 'Graphite' },
  '9': { hex: '#3f51b5', name: 'Blueberry' },
  '10': { hex: '#0b8043', name: 'Basil' },
  '11': { hex: '#d50000', name: 'Tomato' },
};

export const GOOGLE_COLOR_IDS = Object.keys(GOOGLE_COLORS);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(s: unknown): s is string {
  return typeof s === 'string' && HEX_RE.test(s);
}

export function normalizeHex(s: string): string {
  return s.toLowerCase();
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToLab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.0;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = hexToLab(a);
  const [l2, a2, b2] = hexToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const PALETTE_LAB = GOOGLE_COLOR_IDS.map((id) => [Number(id), hexToLab(GOOGLE_COLORS[id]!.hex)] as const).sort(
  (x, y) => x[0] - y[0],
);

/** Nearest Google colorId; ties → lower id. */
export function nearestGoogleColorId(hex: string): string {
  const [l, a, b] = hexToLab(hex.toLowerCase());
  let best = 1;
  let bestD = Infinity;
  for (const [id, [l2, a2, b2]] of PALETTE_LAB) {
    const d = Math.hypot(l - l2, a - a2, b - b2);
    if (d < bestD - 1e-9) {
      bestD = d;
      best = id;
    }
  }
  return String(best);
}
