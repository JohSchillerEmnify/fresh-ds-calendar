/**
 * Pure maths of the Labs horizontal view (feature horizontal-time): the two zoom axes, pixels per hour and row
 * height from the viewport and the zoom, the layout of one day row (x from the time, lanes for overlaps, untimed bars on
 * top) and of all rows, and the session-remembered zoom. No DOM, store or timer, so the rules are unit-tested with numbers.
 */
import { packColumns, type Segment } from '@/lib/items';
import { BUTTON_FACTOR, clampPanTo, type Pan, type WheelAxes, type Zoom2, type ZoomModel } from '../zoom/zoom';

/** Time zoom: 1 fits the 24 hours in the viewport width, 24 makes one hour as wide as the viewport. */
export const MIN_ZX = 1;
export const MAX_ZX = 24;
/** Day zoom: 1 fits the seven days in the viewport height, 3 shows about two and a half days (a few days replace a day mode). */
export const MIN_ZY = 1;
export const MAX_ZY = 3;
/** The zoom a view starts with: about eight hours across, every row of the mode in view. */
export const DEFAULT_ZOOM: Zoom2 = { x: 3, y: 1 };
/** The left edge of the viewport at the start (hour of the day). */
export const START_HOUR = 6;
/** Rows (days of the week) that fit the viewport height at day zoom 1. */
const FIT_ROWS = 7;
/** A bare title chip (px): only decides lanes; a card is drawn at its real length, never wider (owner, 2026-10-21). */
const MIN_CARD_PX = 28;
/** Least height (px) of a lane of overlapping entries, and the height of an untimed bar. */
export const MIN_LANE_PX = 22;
export const BAR_PX = 22;
/** Space (px) above and below the cards of a row. */
const ROW_PAD = 2;
const HZ_KEY = 'cal.zoomHTime';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The zoom limited to its ranges (a non-finite axis falls back to the whole fit). */
export function clampHZoom(z: Zoom2): Zoom2 {
  return {
    x: Number.isFinite(z.x) ? clamp(z.x, MIN_ZX, MAX_ZX) : MIN_ZX,
    y: Number.isFinite(z.y) ? clamp(z.y, MIN_ZY, MAX_ZY) : MIN_ZY,
  };
}

/** One button step of one axis in `dir` (1 in, -1 out), clamped. */
export function stepAxis(z: Zoom2, axis: 'x' | 'y', dir: 1 | -1): Zoom2 {
  const f = dir === 1 ? BUTTON_FACTOR : 1 / BUTTON_FACTOR;
  return clampHZoom({ ...z, [axis]: z[axis] * f });
}

/** Which axes a wheel event zooms: Ctrl/Cmd the time, Shift+Ctrl/Cmd or Alt the day height, otherwise it pans. */
export function hWheelAxes(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): WheelAxes {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey || (mod && e.shiftKey)) return 'y';
  return mod ? 'x' : null;
}

/** Pixels per hour at time zoom `zx` in a viewport `vw` wide. */
export const pxPerHour = (vw: number, zx: number): number => (vw * zx) / 24;

/** Base height (px) of a day row at day zoom `zy` in a viewport `vh` high (a row may be taller when its lanes need room). */
export const baseRowHeight = (vh: number, zy: number): number => (vh * zy) / FIT_ROWS;

/** Distance in hours between two labels of the time axis so that they stay about 40 px apart at least. */
export function hourStep(pph: number): 1 | 2 | 3 | 6 {
  return pph >= 40 ? 1 : pph >= 20 ? 2 : pph >= 14 ? 3 : 6;
}

/** One drawn entry of a row; coordinates are px inside the row. */
interface HCard { seg: Segment; left: number; top: number; width: number; height: number; kind: 'bar' | 'timed' }

/** One day row with its height and its entries. */
export interface HRow { date: string; top: number; height: number; cards: HCard[]; lanes: number }

/**
 * The layout of one day row. Untimed entries (all-day, no start) are full-width bars on top; timed ones are as wide as they
 * last (x from the start minute) and overlapping ones share lanes, vertical sub-rows of the room under the bars (`packColumns`
 * without cascading, so a cluster never overlaps itself). The row is as tall as `baseH`, or taller when its bars and lanes
 * need more than that.
 */
export function layoutRow(date: string, segs: Segment[], pph: number, baseH: number, minLength = 0): Omit<HRow, 'top'> {
  const bars = segs.filter((s) => s.allDay || s.startTime === null);
  const placed = packColumns(segs, (MIN_CARD_PX / pph) * 60, false, 0, minLength);
  const lanes = placed.reduce((m, p) => Math.max(m, p.cols), 0);
  const height = Math.max(baseH, 2 * ROW_PAD + bars.length * BAR_PX + lanes * MIN_LANE_PX);
  const width = 24 * pph;
  const cards: HCard[] = bars.map((seg, i) => ({ seg, left: 0, top: ROW_PAD + i * BAR_PX, width, height: BAR_PX - 1, kind: 'bar' }));
  const room = height - 2 * ROW_PAD - bars.length * BAR_PX;
  for (const p of placed) {
    const laneH = room / p.cols;
    const w = (p.height / 60) * pph; // the real duration, at least the minimum event length
    cards.push({
      seg: p.seg,
      left: Math.min((p.top / 60) * pph, Math.max(0, width - w)),
      top: ROW_PAD + bars.length * BAR_PX + p.col * laneH,
      width: w,
      height: p.span * laneH - 1,
      kind: 'timed',
    });
  }
  return { date, height, cards, lanes };
}

/** The layout of all rows stacked top to bottom, and the size of the world they make. */
export function layoutRows(days: { date: string; segs: Segment[] }[], vw: number, vh: number, z: Zoom2, minLength = 0): { rows: HRow[]; width: number; height: number } {
  const pph = pxPerHour(vw, z.x);
  const base = baseRowHeight(vh, z.y);
  let top = 0;
  const rows = days.map((d) => {
    const r = layoutRow(d.date, d.segs, pph, base, minLength);
    const row = { ...r, top };
    top += r.height;
    return row;
  });
  return { rows, width: 24 * pph, height: top };
}

/** The gesture model of the horizontal view: independent zoom ranges, a world as wide as 24 hours and as tall as its rows. */
export function horizontalModel(worldHeight: (z: Zoom2, vw: number, vh: number) => number): ZoomModel {
  return {
    clamp: clampHZoom,
    world: (z, vw, vh) => ({ w: vw * z.x, h: worldHeight(z, vw, vh) }),
    wheel: hWheelAxes,
  };
}

/** The pan that puts hour `hour` at the left edge of the viewport (clamped to the world). */
export function panToHour(hour: number, vw: number, vh: number, z: Zoom2, worldH: number): Pan {
  return clampPanTo({ x: -hour * pxPerHour(vw, z.x), y: 0 }, vw, vh, { w: vw * z.x, h: worldH });
}

/** The remembered zoom from its stored text, or null when it is missing or unusable. */
export function parseStoredHZoom(raw: string | null): Zoom2 | null {
  try {
    const v = raw === null ? null : (JSON.parse(raw) as { x?: unknown; y?: unknown });
    return v && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y) ? clampHZoom({ x: v.x, y: v.y }) : null;
  } catch {
    return null;
  }
}

/** The zoom remembered for this session (`sessionStorage`; blocked storage means none). */
export function readStoredHZoom(): Zoom2 | null {
  try { return parseStoredHZoom(sessionStorage.getItem(HZ_KEY)); } catch { return null; }
}

/** Remembers the zoom for this session; blocked storage is ignored. */
export function writeStoredHZoom(z: Zoom2): void {
  try { sessionStorage.setItem(HZ_KEY, JSON.stringify({ x: Math.round(z.x * 1000) / 1000, y: Math.round(z.y * 1000) / 1000 })); } catch { /* private mode: not remembered */ }
}
