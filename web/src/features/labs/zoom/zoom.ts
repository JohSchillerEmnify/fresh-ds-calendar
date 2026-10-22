/**
 * Pure maths of the Labs zoom month (feature zoom-month): the zoom range, the pan that keeps the point under
 * a gesture in place, how big a cell is at a zoom, and how much of each level of detail a cell of that size shows. No DOM,
 * store or timer, so the rules are unit-tested with plain numbers.
 */
import type { Segment } from '@/lib/items';

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

/** A zoom per axis: the month zooms both alike, the horizontal view zooms time (x) and the day height (y) on their own. */
export interface Zoom2 { x: number; y: number }

/** Which axes a wheel event with these modifiers zooms; null means the wheel pans. */
export type WheelAxes = 'xy' | 'x' | 'y' | null;

/** What the gesture controller needs to know about a view: its zoom limits, its world size and which axes the wheel zooms. */
export interface ZoomModel {
  /** The zoom limited to its range. */
  clamp(z: Zoom2): Zoom2;
  /** Size (px) of the whole world at zoom `z` in a viewport of vw x vh. */
  world(z: Zoom2, vw: number, vh: number): { w: number; h: number };
  /** The axes a wheel event zooms (null: it pans). */
  wheel(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): WheelAxes;
}

/** The zoom month: one zoom for both axes, the world is the viewport times the zoom, Ctrl/Cmd+wheel zooms. */
export const MONTH_MODEL: ZoomModel = {
  clamp: (z) => { const c = clampZoom(z.x); return { x: c, y: c }; },
  world: (z, vw, vh) => ({ w: vw * z.x, h: vh * z.x }),
  wheel: (e) => (e.ctrlKey || e.metaKey ? 'xy' : null),
};

/** The pan that keeps the world point under (ax, ay) there when the zoom goes from `z0` to `z1`, per axis. */
export function panAfterZoom2(pan: Pan, z0: Zoom2, z1: Zoom2, ax: number, ay: number): Pan {
  return {
    x: ax - (ax - pan.x) * (z0.x > 0 ? z1.x / z0.x : 1),
    y: ay - (ay - pan.y) * (z0.y > 0 ? z1.y / z0.y : 1),
  };
}

/** The pan limited so a world of the given size always covers the viewport (a smaller world sits at the top left). */
export function clampPanTo(pan: Pan, vw: number, vh: number, world: { w: number; h: number }): Pan {
  return { x: clamp(pan.x, Math.min(0, vw - world.w), 0), y: clamp(pan.y, Math.min(0, vh - world.h), 0) };
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

/**
 * Cell (CSS px) at which the owner said the real-time grid should already be fully shown: about 3.5 day columns across a
 * phone (~400 px / 3.5 = 115 wide) in a month of five or six rows (~245 tall). The switch to the timeline is the same for
 * every cell, so it is measured on the cell size alone (no per-day decision) and finished by this size.
 */
export const TIMELINE_REF = cellScale(115, 245);

/**
 * Cell edge (px) ranges in which each detail fades in (or, for the dots, out). The cell of a desktop's whole month is about
 * 150 px, still chips without times; times and task list items come in just above that, in the chip layer the timeline
 * replaces, and the timeline crossfades over the last 9 % below `TIMELINE_REF` (about 15 px of cell edge: a short window, so
 * a cell is never half chips, half grid for long).
 */
export const DETAIL = {
  dotsOut: [85, 120],
  chipsIn: [80, 115],
  timesIn: [153, 157],
  listsIn: [154, 158],
  timelineIn: [TIMELINE_REF * 0.91, TIMELINE_REF],
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

/** Shortest duration (min) a timed item counts as in the real-time layout: the cascade gap `packColumns` uses, so a point-like item still needs a readable block. */
export const SHORTEST_MIN = 15;

/**
 * The minutes of the day (whole hours) the timed items span, or null when there are none; an item counts at least
 * `SHORTEST_MIN`. The span is at least `minHours` long (moved up against midnight when it would run past it).
 */
export function timeSpan(segs: Segment[], minHours = 1): { start: number; end: number } | null {
  const timed = segs.filter((s) => !s.allDay && s.startTime !== null);
  if (!timed.length) return null;
  let start = Math.floor(Math.min(...timed.map((s) => s.startMin)) / 60) * 60;
  let end = Math.ceil(Math.max(...timed.map((s) => Math.max(s.endMin, s.startMin + SHORTEST_MIN))) / 60) * 60;
  end = Math.max(end, start + minHours * 60);
  if (end > 24 * 60) { end = 24 * 60; start = Math.min(start, Math.max(0, end - minHours * 60)); }
  return { start, end };
}

/** Fewest hours the shared span of a week row covers, so a row of short items still gets a readable grid. */
export const ROW_MIN_HOURS = 4;

/** The one hour span all cells of a week row share: the span of every timed item of the row (null when the row has none). */
export function rowSpan(daySegs: Segment[][]): { start: number; end: number } | null {
  return timeSpan(daySegs.flat(), ROW_MIN_HOURS);
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
