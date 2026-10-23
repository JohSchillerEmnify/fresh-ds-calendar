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

/**
 * Assigns each span to the first lane where it does not overlap an earlier one. `clearance(prev, next)` is the gap in
 * minutes the drawn arcs need between two spans on a lane (their round caps reach past the span), default none.
 */
export function assignLanes<T extends { startMin: number; endMin: number }>(
  spans: T[], clearance: (prev: T, next: T) => number = () => 0,
): Array<T & { lane: number }> {
  const last: T[] = [];
  return [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin).map((s) => {
    let lane = last.findIndex((p) => p.endMin + clearance(p, s) <= s.startMin);
    if (lane < 0) lane = last.length;
    last[lane] = s;
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

/** Minutes of the dial that an arc length of `units` (viewBox units) spans at radius `r`. */
const unitsToMin = (units: number, r: number): number => (units / (2 * Math.PI * r)) * 1440;

/**
 * Ring sizes: centre radius of the outermost ring, the smallest allowed centre radius, ring pitch, gap, and the
 * narrowest band still drawn.
 */
export interface RingSpec { outer: number; inner: number; step: number; gap: number; minWidth: number }

/**
 * Radius of each ring (lane 0 outermost) and the band width for `lanes` rings: `step` apart with `gap` between bands,
 * squeezed when they would reach further in than `inner`, so the middle stays free however many entries overlap; but
 * never narrower than `minWidth`: `shown` is how many rings are drawn, entries on further rings are only listed.
 */
export function ringLayout(lanes: number, spec: RingSpec): { r: (lane: number) => number; width: number; shown: number } {
  const fit = Math.floor((spec.outer - spec.inner) / (spec.minWidth + spec.gap)) + 1;
  const shown = Math.max(1, Math.min(lanes, fit));
  const step = shown > 1 ? Math.min(spec.step, (spec.outer - spec.inner) / (shown - 1)) : spec.step;
  return { r: (lane) => spec.outer - lane * step, width: step - spec.gap, shown };
}

/**
 * The drawn span of an arc from `from` to `to` (minutes) on a ring of radius `r`: both ends pulled in by half of `gap`
 * units, so two arcs that meet on one ring keep a visible gap; a very short arc keeps at least a third of its length.
 */
export function gapTrimmed(from: number, to: number, r: number, gap: number): { from: number; to: number } {
  const cut = Math.min(unitsToMin(gap / 2, r), (to - from) / 3);
  return { from: from + cut, to: to - cut };
}

interface Rect { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** An arc as the label placer sees it: drawn span in minutes, ring radius and band width. */
export interface ArcBand { key: string; from: number; to: number; r: number; w: number }
/** A name to place for one arc. */
export interface NameInput extends ArcBand { text: string }
/**
 * A placed name: the text's anchor point (vertically centred), its text anchor, its box, and the point on the arc's
 * inner edge the leader line starts from; `shown: false` when it found no room (it is listed next to the dial).
 */
export interface PlacedName {
  key: string; shown: boolean; text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: Rect; fx: number; fy: number;
}

/** Whether a viewBox point lies on an arc band (with `pad` units of clearance round it). */
function onBand(x: number, y: number, a: ArcBand, pad: number): boolean {
  const r = radiusAt(x, y);
  if (Math.abs(r - a.r) > a.w / 2 + pad) return false;
  const m = minuteAt(x, y), slack = unitsToMin(pad, Math.max(r, 1));
  const d = (((m - a.from + slack) % 1440) + 1440) % 1440;
  return d <= a.to - a.from + 2 * slack;
}

/** Points along the outline of a box (every ~5 units) and its centre: what must stay off the arcs. */
function outline(b: Rect): Array<[number, number]> {
  const pts: Array<[number, number]> = [[(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]];
  const nx = Math.max(1, Math.ceil((b.x1 - b.x0) / 5)), ny = Math.max(1, Math.ceil((b.y1 - b.y0) / 5));
  for (let i = 0; i <= nx; i++) { const x = b.x0 + ((b.x1 - b.x0) * i) / nx; pts.push([x, b.y0], [x, b.y1]); }
  for (let j = 1; j < ny; j++) { const y = b.y0 + ((b.y1 - b.y0) * j) / ny; pts.push([b.x0, y], [b.x1, y]); }
  return pts;
}

/** Radius of the inner edge of the innermost arc drawn at minute `m` (the edge of the free plate there). */
function innerEdgeAt(m: number, arcs: ArcBand[], fallback: number): number {
  let edge = fallback;
  for (const a of arcs) {
    const d = (((m - a.from) % 1440) + 1440) % 1440;
    if (d <= a.to - a.from) edge = Math.min(edge, a.r - a.w / 2);
  }
  return edge;
}

/** The minute of an arc's span nearest to minute `m` (`m` itself when inside), wrap-aware for spans of any length. */
function nearestInSpan(m: number, from: number, to: number): number {
  const off = (((m - from) % 1440) + 1440) % 1440, span = to - from;
  if (off <= span) return m;
  return 1440 - off < off - span ? from : to;
}

/**
 * Whether a box can touch an arc by angle: compares the minutes of the box's corners with the arc's span (with `slack`
 * minutes); a box round the centre reaches every angle.
 */
function angleReach(b: Rect, near: number, a: ArcBand, slack: number): boolean {
  if (near < 1) return true;
  const ms = [minuteAt(b.x0, b.y0), minuteAt(b.x1, b.y0), minuteAt(b.x0, b.y1), minuteAt(b.x1, b.y1)];
  // the box's angular range is under a half turn: measure it from its first corner, the short way
  const ds = ms.map((m) => wrapDelta(ms[0], m));
  const lo = ms[0] + Math.min(...ds), hi = ms[0] + Math.max(...ds);
  const off = (((lo - slack - a.from) % 1440) + 1440) % 1440;
  return off <= a.to - a.from || off >= 1440 - (hi - lo + 2 * slack);
}

/** Nearest and farthest distance of a box from the dial's centre. */
function radialRange(b: Rect): [number, number] {
  const nx = Math.min(Math.max(CENTER, b.x0), b.x1), ny = Math.min(Math.max(CENTER, b.y0), b.y1);
  const far = Math.max(radiusAt(b.x0, b.y0), radiusAt(b.x1, b.y0), radiusAt(b.x0, b.y1), radiusAt(b.x1, b.y1));
  return [radiusAt(nx, ny), far];
}

/**
 * Places each arc's name on the plate beside its own arc, without overlaps (owner, 2026-10-23: names drawn badly). A
 * name is tried on minutes inside its arc's span (middle first), then a little beyond it, each time starting just inside
 * the innermost arc at that minute and moving inwards a few rows; its box must stay on the plate (`plate` radius), off
 * every arc band, off the `keepOut` boxes (the middle) and off names placed before. Text points inwards from the rim
 * (right half: it ends at the point, left half: it starts there, top and bottom: centred). A long name that fits
 * nowhere is tried again cut shorter (down to 6 characters with the ellipsis); one that still fits nowhere gets
 * `shown: false`. Text width is estimated at 0.56 em per character.
 */
export function placeLabelsNear(names: NameInput[], arcs: ArcBand[], opts: { font: number; plate: number; keepOut?: Rect[]; rows?: number }): PlacedName[] {
  const { font, plate, rows = 4 } = opts;
  const taken: Rect[] = [...(opts.keepOut ?? [])];
  const h = font * 1.25, pad = 2;
  return names.map((n) => {
    const cuts = [n.text.length, Math.round(n.text.length * 0.7), Math.round(n.text.length * 0.5)].filter((c, i, all) => c >= 6 && all.indexOf(c) === i);
    for (const cut of cuts.length ? cuts : [n.text.length]) {
      const placed = placeOne(n, clip(n.text, cut));
      if (placed) return placed;
    }
    const p = pointAt(n.from + (n.to - n.from) / 2, n.r);
    return { key: n.key, shown: false, text: n.text, x: p.x, y: p.y, anchor: 'middle', box: { x0: p.x, y0: p.y, x1: p.x, y1: p.y }, fx: p.x, fy: p.y };
  });

  /** Minutes to try for an arc: its middle, then outwards over its span (at most 6 steps each way), then up to an hour beyond. */
  function minutesFor(n: NameInput): number[] {
    const span = n.to - n.from, mid = n.from + span / 2;
    const offs = [0], step = Math.max(10, span / 12);
    for (let k = step; k < span / 2; k += step) offs.push(k, -k);
    for (let k = span / 2 + 5; k < span / 2 + 90; k += 10) offs.push(k, -k);
    return offs.map((o) => (mid + o + 1440) % 1440);
  }

  /** Whether a box is free: on the plate, off earlier names and the middle, off every arc band. */
  function isFree(box: Rect): boolean {
    // cheap tests first: the plate (a box is farthest out at a corner), other names, then only the rings it reaches
    const [near, far] = radialRange(box);
    if (far > plate || taken.some((t) => overlaps(t, box))) return false;
    const reach = arcs.filter((a) => a.r + a.w / 2 + pad >= near && a.r - a.w / 2 - pad <= far && angleReach(box, near, a, 2));
    if (!reach.length) return true;
    const pts = outline(box);
    return !reach.some((a) => pts.some(([x, y]) => onBand(x, y, a, pad)));
  }

  /**
   * The box of a name `w` wide placed at minute `m`, `row` rows in from the innermost arc there: text points inwards
   * from the rim, so the box hangs below the point at the top, above it at the bottom, and inwards on the sides.
   */
  function candidate(m: number, row: number, w: number) {
    const sin = Math.sin((angleOf(m) * Math.PI) / 180), cos = Math.cos((angleOf(m) * Math.PI) / 180);
    const anchor: PlacedName['anchor'] = Math.abs(sin) < 0.35 ? 'middle' : sin > 0 ? 'end' : 'start';
    const p = pointAt(m, innerEdgeAt(m, arcs, plate) - pad - row * h * 0.9);
    const yc = anchor === 'middle' ? p.y + (cos > 0 ? h / 2 : -h / 2) : p.y;
    const x0 = anchor === 'end' ? p.x - w : anchor === 'start' ? p.x : p.x - w / 2;
    // a little room on both sides, so two names on one line never read as one
    return { x: p.x, y: yc, anchor, box: { x0: x0 - font * 0.3, y0: yc - h / 2, x1: x0 + w + font * 0.3, y1: yc + h / 2 } };
  }

  /** The first free place for `n`'s name written as `text`, or null. */
  function placeOne(n: NameInput, text: string): PlacedName | null {
    const w = text.length * font * 0.56;
    for (const m of minutesFor(n)) {
      for (let row = 0; row < rows; row++) {
        const c = candidate(m, row, w);
        if (!isFree(c.box)) continue;
        taken.push(c.box);
        // the leader starts on the arc itself, at the nearest minute of its span
        const f = pointAt(nearestInSpan(m, n.from, n.to), n.r - n.w / 2);
        return { key: n.key, shown: true, text, ...c, fx: f.x, fy: f.y };
      }
    }
    return null;
  }
}

/**
 * A name written along its ring (the rings variant): it starts at the arc's start and runs clockwise over the arc and
 * on along the free ring up to `runTo` (where the next arc on that ring starts). On the lower half of the dial (06:00 to
 * 18:00 by the middle of the text) the path is turned round, so the text is never upside down. The path runs through
 * the band's middle (`rBase`; the text is drawn with a central baseline); the text is cut with an ellipsis to the run,
 * or empty when fewer than three characters fit.
 * `offset` is where along the path the text is anchored (`anchor`).
 */
export function alongArcLabel(from: number, runTo: number, r: number, font: number, text: string): {
  d: string; text: string; flipped: boolean; rBase: number; offset: number; anchor: 'start' | 'end'; textTo: number;
} {
  const pad = font * 0.4, charW = font * 0.56;
  const end = Math.min(runTo, from + 1439.9);
  const runLen = ((end - from) / 1440) * 2 * Math.PI * r;
  const fits = Math.floor((runLen - 2 * pad) / charW);
  const shown = fits < 3 ? '' : clip(text, fits);
  // turn the path round when the text's own middle lies on the lower half
  const textMid = from + unitsToMin(pad + (shown.length * charW) / 2, r);
  const m = ((textMid % 1440) + 1440) % 1440;
  const flipped = m > 360 && m < 1080;
  // the text is drawn with a central baseline, so the path runs through the middle of the band
  const rBase = r;
  const a = pointAt(flipped ? end : from, rBase), b = pointAt(flipped ? from : end, rBase);
  const large = end - from > 720 ? 1 : 0;
  const d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${rBase.toFixed(2)} ${rBase.toFixed(2)} 0 ${large} ${flipped ? 0 : 1} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  const pathLen = ((end - from) / 1440) * 2 * Math.PI * rBase;
  const textTo = from + unitsToMin(2 * pad + shown.length * charW, r);
  return { d, text: shown, flipped, rBase, offset: flipped ? pathLen - pad : pad, anchor: flipped ? 'end' : 'start', textTo };
}

/**
 * Whether a name written along a ring from minute `from` to `to` at radius `r` (glyphs `font` high, centred on the
 * ring) touches any of the `rects` (the middle text): its band is sampled every couple of units.
 */
export function alongHits(from: number, to: number, r: number, font: number, rects: Rect[]): boolean {
  if (!rects.length) return false;
  const n = Math.max(2, Math.ceil((((to - from) / 1440) * 2 * Math.PI * r) / 2));
  for (let i = 0; i <= n; i++) {
    for (const dr of [-font / 2, 0, font / 2]) {
      const p = pointAt(from + ((to - from) * i) / n, r + dr);
      if (rects.some((b) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1)) return true;
    }
  }
  return false;
}
