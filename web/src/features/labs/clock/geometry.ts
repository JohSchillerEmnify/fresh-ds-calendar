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
