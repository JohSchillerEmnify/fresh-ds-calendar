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
