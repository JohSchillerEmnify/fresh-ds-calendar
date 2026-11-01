/**
 * Pure model of the bedtime runway (Labs, feature labs-bedtime-runway): the stretch from now to tonight's bedtime,
 * tonight's timed entries placed on it in minutes from now, and the free time they leave.
 *
 * Times are absolute wall-clock minutes (see `features/bedtime/bedtime.ts`), so a bedtime after midnight needs no
 * special case.
 */
import { absMinutes, pieceTime, tonight, type BedtimeWindow, type SegmentSource } from '@/features/bedtime/bedtime';
import { packColumns, taskListSpan, type Segment } from '@/lib/items';

/** One entry on the runway, in minutes from now; `col` of `cols` side-by-side lanes. */
interface RunwayEntry {
  seg: Segment;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** What the runway shows: nothing to count down to, the night already begun, or the runway itself. */
export type RunwayModel =
  | { kind: 'off' }
  | { kind: 'passed'; bedtime: string }
  | { kind: 'runway'; total: number; free: number; bedtime: string; entries: RunwayEntry[] };

const DAY = 1440;

/** ISO date of an absolute minute. */
const isoOf = (abs: number) => new Date(Math.floor(abs / DAY) * 86_400_000).toISOString().slice(0, 10);

/**
 * The segment as a timed span, or null when it has no time: an open list carried over to today keeps its own time
 * (like on the Approaching track); all-day events and lists without a time have none.
 *
 * @param s A segment of the items store.
 * @returns Its start and end in minutes of its day, or null.
 */
function span(s: Segment): { startMin: number; endMin: number } | null {
  if (s.allDay) return null;
  if (s.startTime !== null) return s;
  if (s.carriedFrom && s.item.kind === 'tasklist' && s.item.time) return taskListSpan(s.item.time, s.item.estimateMinutes);
  return null;
}

/**
 * One absolute span per timed item on the days from now to bedtime: the day pieces of a multi-day event join into one
 * block, then the minimum length applies once to the whole item (as everywhere it is laid out).
 *
 * @param segments The segments by date.
 * @param nowAbs Absolute minute of now.
 * @param bedAbs Absolute minute of bedtime.
 * @param minLength The minimum event length in minutes (0 = off).
 * @returns The items with their joined segment (first piece's, ending like the last piece) and absolute start and end.
 */
function itemSpans(segments: SegmentSource, nowAbs: number, bedAbs: number, minLength: number): Array<{ seg: Segment; start: number; end: number }> {
  const byId = new Map<string, { seg: Segment; start: number; end: number }>();
  for (let day = Math.floor(nowAbs / DAY); day <= Math.floor((bedAbs - 1) / DAY); day++) {
    const date = isoOf(day * DAY);
    for (const seg of segments.get(date) ?? []) {
      const sp = span(seg);
      if (!sp) continue;
      const start = absMinutes(date, sp.startMin), end = absMinutes(date, sp.endMin);
      const had = byId.get(seg.item.id);
      if (!had) byId.set(seg.item.id, { seg, start, end });
      else if (end > had.end) byId.set(seg.item.id, { seg: { ...had.seg, last: seg.last, endTime: seg.endTime }, start: had.start, end });
    }
  }
  return [...byId.values()].map((x) => ({ ...x, end: Math.max(x.end, x.start + minLength, x.start + 1) }));
}

/**
 * The runway from now to tonight's bedtime.
 *
 * @param windows The night windows around now (empty while bedtime mode is off).
 * @param nowAbs Absolute wall-clock minute of now.
 * @param segments The segments by date, hidden calendars already left out.
 * @param minLength The minimum event length in minutes (0 = off): a shorter entry is laid out as that long.
 * @returns `off` without a coming night, `passed` while the night has begun, else the runway with its entries (each
 *   clipped to now and bedtime, side by side where they overlap) and the free minutes (the runway minus their union).
 */
export function runwayModel(windows: readonly BedtimeWindow[], nowAbs: number, segments: SegmentSource, minLength: number): RunwayModel {
  const night = tonight(windows, nowAbs);
  if (!night) return { kind: 'off' };
  const bedtime = pieceTime(((night.start % DAY) + DAY) % DAY);
  if (night.start <= nowAbs) return { kind: 'passed', bedtime };
  const total = night.start - nowAbs;

  const spans = itemSpans(segments, nowAbs, night.start, minLength);

  // Clip to [now, bedtime) as minutes from now; packing gives the side-by-side lanes.
  const clipped: Segment[] = [];
  for (const { seg, start, end } of spans) {
    const s = Math.max(start, nowAbs) - nowAbs;
    const e = Math.min(end, night.start) - nowAbs;
    if (e > s) clipped.push({ ...seg, startTime: seg.startTime ?? '00:00', startMin: s, endMin: e });
  }
  const placed = packColumns(clipped, 0, false);
  const entries = placed.map((p) => ({ seg: spans.find((x) => x.seg.item.id === p.seg.item.id)!.seg, top: p.top, height: p.height, col: p.col, cols: p.cols }));

  // Free time: the runway minus the union of the entries.
  let taken = 0, reach = 0;
  for (const e of [...entries].sort((a, b) => a.top - b.top)) {
    const from = Math.max(e.top, reach), to = e.top + e.height;
    if (to > from) taken += to - from;
    reach = Math.max(reach, to);
  }
  return { kind: 'runway', total, free: total - taken, bedtime, entries };
}
