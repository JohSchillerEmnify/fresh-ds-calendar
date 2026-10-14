/** Geometry of the 24-hour clock: midnight at the top, clockwise, one full turn per day. */
export const CENTER = 220;

/** Angle in degrees (0 = top) of a minute of the day. */
export const angleOf = (minutes: number): number => (minutes / 1440) * 360;

/** Point on a circle of radius `r` at a minute of the day. */
export function pointAt(minutes: number, r: number): { x: number; y: number } {
  const a = (angleOf(minutes) * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(a), y: CENTER - r * Math.cos(a) };
}

/** SVG path of the arc from one minute to another at radius `r` (a full day is capped just short of a closed circle). */
export function arcPath(from: number, to: number, r: number): string {
  const end = Math.min(to, from + 1439.9);
  const a = pointAt(from, r), b = pointAt(end, r);
  const large = end - from > 720 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Assigns each span to the first lane where it does not overlap an earlier one. */
export function assignLanes<T extends { startMin: number; endMin: number }>(spans: T[]): Array<T & { lane: number }> {
  const laneEnds: number[] = [];
  return [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin).map((s) => {
    let lane = laneEnds.findIndex((e) => e <= s.startMin);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = s.endMin;
    return { ...s, lane };
  });
}

/** Side of the square the dial is drawn in (viewBox units): the outer ring with a hair of margin. */
export const VIEW = 420;

/**
 * Label size for a dial drawn `px` screen pixels wide: on screen labels stay between 11 and 16 px however large the
 * dial is, so a bigger dial fits longer labels.
 */
export function labelSizing(px: number): { font: number; maxChars: number } {
  const scale = px > 0 ? px / VIEW : 1;
  const font = Math.min(16, Math.max(11, 12 * scale)) / scale;
  return { font, maxChars: Math.round(Math.min(30, Math.max(14, (18 * 12) / font))) };
}

/** Cuts text longer than `max` characters with an ellipsis. */
export const clip = (text: string, max: number): string => (text.length > max ? text.slice(0, max - 1) + '…' : text);

/**
 * Opacity of each of the first `count` rows that fit into `capacity`: all opaque when everything fits, otherwise the
 * last (up to two) visible rows fade out to hint at more.
 */
export function fadingRows(count: number, capacity: number): number[] {
  const n = Math.max(0, Math.min(count, capacity));
  const fade = count > n ? Math.min(2, n) : 0;
  return Array.from({ length: n }, (_, i) => (i < n - fade ? 1 : (n - i) / (fade + 1)));
}

/** Minute of the day (0 ≤ m < 1440, unsnapped) under a point of the dial, in viewBox coordinates. */
export function minuteAt(x: number, y: number): number {
  const deg = (Math.atan2(x - CENTER, CENTER - y) * 180) / Math.PI;
  return (((deg + 360) % 360) / 360) * 1440;
}

/** Distance of a viewBox point from the centre of the dial. */
export const radiusAt = (x: number, y: number): number => Math.hypot(x - CENTER, y - CENTER);

/** Shortest signed way round the dial from minute `a` to minute `b` (−720 < d ≤ 720), so turning past midnight is small. */
export function wrapDelta(a: number, b: number): number {
  let d = (b - a) % 1440;
  if (d > 720) d -= 1440;
  if (d <= -720) d += 1440;
  return d;
}

/** SVG path of the pie sector from the centre between two minutes at radius `r` (the focus wedge). */
export function sectorPath(from: number, to: number, r: number): string {
  if (to <= from) return '';
  const end = Math.min(to, from + 1439.9);
  const a = pointAt(from, r), b = pointAt(end, r);
  const large = end - from > 720 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

/** A label to place: the minute its arc is centred on and its text. */
export interface LabelInput { key: string; mid: number; text: string }
/** A placed label: its anchor point and text anchor, or `shown: false` when it fits nowhere (the arc keeps its tap target). */
export interface PlacedLabel { key: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; shown: boolean }
interface Rect { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Places arc labels inside the dial without overlaps: each label sits on its arc's angle, starting at `rOuter` and moving
 * inwards row by row (and a little round, ±10°) until its box is free of earlier labels and of the `keepOut` boxes (the time in the middle), but not
 * further in than `rInner`. Labels near the top or bottom are centred on their angle, the others point inwards from the
 * rim (right half: text ends at the point, left half: starts there). Text width is estimated at 0.56 em per character.
 */
export function placeLabels(labels: LabelInput[], font: number, rOuter: number, rInner: number, keepOut: Rect[] = []): PlacedLabel[] {
  const taken: Rect[] = [...keepOut];
  const h = font * 1.2, stepR = font * 1.15;
  /** Angular nudges tried at each radius, in minutes of the dial (about 5° each), nearest first. */
  const nudges = [0, 20, -20, 40, -40];
  return labels.map((l) => {
    const w = l.text.length * font * 0.56;
    for (let r = rOuter; r >= rInner; r -= stepR) {
      for (const n of nudges) {
        const m = l.mid + n;
        const sin = Math.sin((angleOf(m) * Math.PI) / 180);
        const anchor: PlacedLabel['anchor'] = Math.abs(sin) < 0.4 ? 'middle' : sin > 0 ? 'end' : 'start';
        const p = pointAt(m, r);
        const x0 = anchor === 'end' ? p.x - w : anchor === 'start' ? p.x : p.x - w / 2;
        const box = { x0: x0 - 2, y0: p.y - h / 2, x1: x0 + w + 2, y1: p.y + h / 2 };
        // the whole box must stay on the plate
        const far = Math.max(...[[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].map(([x, y]) => Math.hypot(x - CENTER, y - CENTER)));
        if (far > rOuter + font * 0.6 || taken.some((t) => overlaps(t, box))) continue;
        taken.push(box);
        return { key: l.key, x: p.x, y: p.y, anchor, shown: true };
      }
    }
    const p = pointAt(l.mid, rOuter);
    return { key: l.key, x: p.x, y: p.y, anchor: 'middle', shown: false };
  });
}
