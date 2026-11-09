/** Google event palette and nearest-colour lookup (CIE76 ΔE in CIELAB, D65). Pure, no build step. */

export const GOOGLE_COLORS = {
  1: { hex: '#7986cb', name: 'Lavender' },
  2: { hex: '#33b679', name: 'Sage' },
  3: { hex: '#8e24aa', name: 'Grape' },
  4: { hex: '#e67c73', name: 'Flamingo' },
  5: { hex: '#f6bf26', name: 'Banana' },
  6: { hex: '#f4511e', name: 'Tangerine' },
  7: { hex: '#039be5', name: 'Peacock' },
  8: { hex: '#616161', name: 'Graphite' },
  9: { hex: '#3f51b5', name: 'Blueberry' },
  10: { hex: '#0b8043', name: 'Basil' },
  11: { hex: '#d50000', name: 'Tomato' },
};

export const GOOGLE_COLOR_IDS = Object.keys(GOOGLE_COLORS);

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.0;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a, b) {
  const [l1, a1, b1] = hexToLab(a);
  const [l2, a2, b2] = hexToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const PALETTE_LAB = GOOGLE_COLOR_IDS.map((id) => [Number(id), hexToLab(GOOGLE_COLORS[id].hex)]).sort((x, y) => x[0] - y[0]);

/** Nearest Google colorId; ties → lower id. */
export function nearestGoogleColorId(hex) {
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

function relativeLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Black or white text, whichever contrasts more with `bg`. */
export function onColor(bg) {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#ffffff') ? '#000000' : '#ffffff';
}

/** Google's calendar colour palette (`colors.get`, `calendar` map): what the app offers until the server has fetched the live one. */
export const GOOGLE_CALENDAR_COLORS = [
  { id: '1', background: '#ac725e', foreground: '#1d1d1d' },
  { id: '2', background: '#d06b64', foreground: '#1d1d1d' },
  { id: '3', background: '#f83a22', foreground: '#1d1d1d' },
  { id: '4', background: '#fa573c', foreground: '#1d1d1d' },
  { id: '5', background: '#ff7537', foreground: '#1d1d1d' },
  { id: '6', background: '#ffad46', foreground: '#1d1d1d' },
  { id: '7', background: '#42d692', foreground: '#1d1d1d' },
  { id: '8', background: '#16a765', foreground: '#1d1d1d' },
  { id: '9', background: '#7bd148', foreground: '#1d1d1d' },
  { id: '10', background: '#b3dc6c', foreground: '#1d1d1d' },
  { id: '11', background: '#fbe983', foreground: '#1d1d1d' },
  { id: '12', background: '#fad165', foreground: '#1d1d1d' },
  { id: '13', background: '#92e1c0', foreground: '#1d1d1d' },
  { id: '14', background: '#9fe1e7', foreground: '#1d1d1d' },
  { id: '15', background: '#9fc6e7', foreground: '#1d1d1d' },
  { id: '16', background: '#4986e7', foreground: '#1d1d1d' },
  { id: '17', background: '#9a9cff', foreground: '#1d1d1d' },
  { id: '18', background: '#b99aff', foreground: '#1d1d1d' },
  { id: '19', background: '#c2c2c2', foreground: '#1d1d1d' },
  { id: '20', background: '#cabdbf', foreground: '#1d1d1d' },
  { id: '21', background: '#cca6ac', foreground: '#1d1d1d' },
  { id: '22', background: '#f691b2', foreground: '#1d1d1d' },
  { id: '23', background: '#cd74e6', foreground: '#1d1d1d' },
  { id: '24', background: '#a47ae2', foreground: '#1d1d1d' },
];
