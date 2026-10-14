/**
 * Pure maths of the Labs zoom month (ARCHITECTURE "Labs: Zoom month"): the zoom range, the pan that keeps the point under
 * a gesture in place, how big a cell is at a zoom, and how much of each level of detail a cell of that size shows. No DOM,
 * store or timer, so the rules are unit-tested with plain numbers.
 */

/** Columns of the month grid; one day filling the width is the largest zoom. */
export const COLS = 7;
/** Smallest zoom: the whole month fits the viewport. */
export const MIN_ZOOM = 1;
/** Largest zoom: one day is as wide as the viewport. */
export const MAX_ZOOM = COLS;
/** One press of the zoom buttons multiplies (or divides) the zoom by this. */
export const BUTTON_FACTOR = 1.25;
export const ZOOM_KEY = 'cal.zoomMonth';

export interface Pan { x: number; y: number }

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Zoom limited to `MIN_ZOOM`..`MAX_ZOOM` (a non-finite value falls back to the whole month). */
export function clampZoom(z: number): number {
  return Number.isFinite(z) ? clamp(z, MIN_ZOOM, MAX_ZOOM) : MIN_ZOOM;
}

/** One button step in `dir` (1 in, -1 out), clamped; both ends of the range are reached exactly. */
export function stepZoom(z: number, dir: 1 | -1): number {
  return clampZoom(dir === 1 ? z * BUTTON_FACTOR : z / BUTTON_FACTOR);
}

/** The pan (px of the world's top-left corner in the viewport) that keeps the world point under (ax, ay) there when the zoom goes from `z0` to `z1`. */
export function panAfterZoom(pan: Pan, z0: number, z1: number, ax: number, ay: number): Pan {
  const r = z0 > 0 ? z1 / z0 : 1;
  return { x: ax - (ax - pan.x) * r, y: ay - (ay - pan.y) * r };
}

/** The zoom of a pinch: the start zoom scaled by the finger distance ratio, clamped. */
export function pinchZoom(z0: number, d0: number, d1: number): number {
  return d0 > 0 ? clampZoom(z0 * (d1 / d0)) : z0;
}

/** The pan limited so the world (viewport size x zoom) always covers the viewport: no empty edge. */
export function clampPan(pan: Pan, vw: number, vh: number, z: number): Pan {
  return { x: clamp(pan.x, Math.min(0, vw - vw * z), 0), y: clamp(pan.y, Math.min(0, vh - vh * z), 0) };
}

/** Width and height of one cell at zoom `z` in a viewport of vw x vh with `rows` week rows. */
export function cellSize(vw: number, vh: number, z: number, rows: number): { w: number; h: number } {
  return { w: (vw * z) / COLS, h: rows > 0 ? (vh * z) / rows : 0 };
}

/** The pan that puts the middle of cell (col, row) in the middle of the viewport (clamped). */
export function centerOnCell(col: number, row: number, rows: number, vw: number, vh: number, z: number): Pan {
  const { w, h } = cellSize(vw, vh, z, rows);
  return clampPan({ x: vw / 2 - (col + 0.5) * w, y: vh / 2 - (row + 0.5) * h }, vw, vh, z);
}

/** Cell edge (px) the thresholds of {@link detailAt} are measured on: the geometric mean of its width and height. */
export const cellScale = (w: number, h: number): number => Math.sqrt(Math.max(0, w) * Math.max(0, h));

/** 0 below `a`, 1 above `b`, a smooth S-curve between: the continuous fade of one detail. */
export function smooth(x: number, a: number, b: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Cell edge (px) ranges in which each detail fades in (or, for the dots, out). */
export const DETAIL = {
  dotsOut: [85, 120],
  chipsIn: [80, 115],
  timesIn: [150, 200],
  listsIn: [170, 230],
  timelineIn: [300, 400],
} as const;

/** How much of each level of detail a cell shows (0..1 each, fading in and out continuously), plus the strongest level's name. */
export interface Detail {
  /** Density dots (fades out as the chips come in). */
  dots: number;
  /** Title chips of every entry. */
  chips: number;
  /** Start time before each timed entry. */
  times: number;
  /** Task lists grow from a chip to the card with its progress and open items. */
  lists: number;
  /** Mini day timeline with every task item (replaces the chips). */
  timeline: number;
  level: 'dots' | 'chips' | 'times' | 'lists' | 'timeline';
}

/** The detail of a cell of w x h px. Driven by the size only, never by a discrete mode. */
export function detailAt(w: number, h: number): Detail {
  const s = cellScale(w, h);
  const d = {
    dots: 1 - smooth(s, ...DETAIL.dotsOut),
    chips: smooth(s, ...DETAIL.chipsIn),
    times: smooth(s, ...DETAIL.timesIn),
    lists: smooth(s, ...DETAIL.listsIn),
    timeline: smooth(s, ...DETAIL.timelineIn),
  };
  const level = d.timeline >= 0.5 ? 'timeline' : d.lists >= 0.5 ? 'lists' : d.times >= 0.5 ? 'times' : d.chips >= 0.5 ? 'chips' : 'dots';
  return { ...d, level };
}

/** Height (px) of a task list entry: a chip while `lists` is 0, its full need at 1. */
export const listHeight = (chipH: number, need: number, lists: number): number => chipH + Math.max(0, need - chipH) * lists;

/** True when cell (col, row) lies within `margin` px of the viewport (the world is panned by `pan`); far cells only draw their number. */
export function cellNear(col: number, row: number, w: number, h: number, pan: Pan, vw: number, vh: number, margin: number): boolean {
  const x = pan.x + col * w, y = pan.y + row * h;
  return x + w > -margin && x < vw + margin && y + h > -margin && y < vh + margin;
}

/** The remembered zoom from its stored text, or null when it is missing or unusable (garbage, not a number). */
export function parseStoredZoom(raw: string | null): number | null {
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? clampZoom(n) : null;
}

/** The zoom remembered for this session (`sessionStorage`; blocked storage means none). */
export function readStoredZoom(): number | null {
  try { return parseStoredZoom(sessionStorage.getItem(ZOOM_KEY)); } catch { return null; }
}

/** Remembers the zoom for this session; blocked storage is ignored. */
export function writeStoredZoom(z: number): void {
  try { sessionStorage.setItem(ZOOM_KEY, String(Math.round(z * 1000) / 1000)); } catch { /* private mode: not remembered */ }
}
