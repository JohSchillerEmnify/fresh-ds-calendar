/**
 * Pure helpers that turn API items into per-day segments for the views.
 * API timed values always carry the calendar-zone offset, so the first 10 / next 5 chars are the local date / time.
 */
import { addDays, differenceInCalendarDays, parseIsoDate, timeToMinutes, toIsoDate } from './dates';
import type { CalendarItem, LocalDate } from '@/api/types';
import { t } from '@/i18n';

export const TASKLIST_BLOCK_MINUTES = 30;

/** Title as shown in the UI: an untitled task list has none (""), so no row is drawn and no task stands in for it. */
export function displayTitle(item: Pick<CalendarItem, 'kind' | 'title'>): string {
  return item.kind === 'tasklist' && !item.title.trim() ? '' : item.title;
}

/** Neutral name for text-only contexts (screen readers, toasts, reminders): the title, or "Task list" for an untitled list. Never a task. */
export function neutralName(item: Pick<CalendarItem, 'kind' | 'title'>): string {
  return displayTitle(item) || t('tasks.list.fallbackLabel');
}

/** Marker of a Google birthday entry (cake, ring for an anniversary); '' for every other item. */
export function specialMarker(item: CalendarItem): string {
  if (item.kind !== 'event' || !item.special) return '';
  return item.special === 'anniversary' ? '💍' : '🎂';
}

export interface Segment {
  item: CalendarItem;
  /** Local date this segment is on. */
  date: LocalDate;
  allDay: boolean;
  /** 'HH:mm' of this segment; null for all-day / untimed. */
  startTime: string | null;
  /** 'HH:mm', '24:00' when the item continues past midnight. */
  endTime: string | null;
  startMin: number;
  endMin: number;
  /** True for the first / last day of a multi-day item. */
  first: boolean;
  last: boolean;
  /** Task lists only: the list's own date when this open list is carried over to today. */
  carriedFrom?: LocalDate;
}

export const CARRY_OVER_DAYS = 30;

/** True for an open list dated within the last 30 days before `today` (shown on today, feature open-tasks-in-sight). */
export function isCarriedOver(item: CalendarItem, today: LocalDate | undefined): boolean {
  if (item.kind !== 'tasklist' || !item.date || !today || item.date >= today || item.doneCount >= item.totalCount) return false;
  const a = parseIsoDate(item.date), b = parseIsoDate(today);
  return !!a && !!b && differenceInCalendarDays(b, a) <= CARRY_OVER_DAYS;
}

/** Minutes a task list with a time takes: it lasts its estimate, else {@link TASKLIST_BLOCK_MINUTES}, up to midnight. */
export function taskListSpan(time: string, estimateMinutes: number | null): { startMin: number; endMin: number } {
  const startMin = timeToMinutes(time);
  return { startMin, endMin: Math.min(24 * 60, startMin + (estimateMinutes ?? TASKLIST_BLOCK_MINUTES)) };
}

export function itemSegments(item: CalendarItem, today?: LocalDate): Segment[] {
  if (item.kind === 'tasklist') {
    if (item.date === null) return []; // undated: in no calendar view
    if (isCarriedOver(item, today)) {
      return [{
        item, date: today!, allDay: false, startTime: null, endTime: null, startMin: 0, endMin: 0, first: true, last: true,
        carriedFrom: item.date,
      }];
    }
    const span = item.time !== null ? taskListSpan(item.time, item.estimateMinutes) : null;
    return [{
      item, date: item.date, allDay: false, startTime: item.time, endTime: span ? hhmm(span.endMin) : null,
      startMin: span?.startMin ?? 0, endMin: span?.endMin ?? 0, first: true, last: true,
    }];
  }
  if (item.allDay) {
    const a = parseIsoDate(item.start), b = parseIsoDate(item.end);
    if (!a || !b) return [];
    const n = Math.max(1, differenceInCalendarDays(b, a));
    return Array.from({ length: n }, (_, i) => ({
      item, date: toIsoDate(addDays(a, i)), allDay: true, startTime: null, endTime: null,
      startMin: 0, endMin: 0, first: i === 0, last: i === n - 1,
    }));
  }
  const sd = item.start.slice(0, 10), ed = item.end.slice(0, 10);
  const st = item.start.slice(11, 16), et = item.end.slice(11, 16);
  const a = parseIsoDate(sd), b = parseIsoDate(ed);
  if (!a || !b) return [];
  // An event ending exactly at 00:00 does not occupy the end date.
  const lastDay = et === '00:00' && ed !== sd ? addDays(b, -1) : b;
  const n = Math.max(1, differenceInCalendarDays(lastDay, a) + 1);
  return Array.from({ length: n }, (_, i) => {
    const first = i === 0, last = i === n - 1;
    const s = first ? st : '00:00';
    const e = last ? (et === '00:00' && ed !== sd ? '24:00' : et) : '24:00';
    return {
      item, date: toIsoDate(addDays(a, i)), allDay: false, startTime: s, endTime: e,
      startMin: timeToMinutes(s), endMin: e === '24:00' ? 1440 : timeToMinutes(e), first, last,
    };
  });
}

function hhmm(m: number): string {
  return m >= 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Ordering in a day: all-day events, untimed task lists, then timed by start; ties by title. */
export function daySortKey(s: Segment): [number, number, string] {
  const rank = s.allDay ? 0 : s.item.kind === 'tasklist' && s.startTime === null ? 1 : 2;
  return [rank, s.startMin, s.item.title.toLowerCase()];
}
export function compareSegments(a: Segment, b: Segment): number {
  const [ra, ma, ta] = daySortKey(a), [rb, mb, tb] = daySortKey(b);
  return ra - rb || ma - mb || (ta < tb ? -1 : ta > tb ? 1 : 0);
}

/** Segments of every item grouped by day, each day ordered (`compareSegments`); `split` cuts one item into its segments. */
export function segmentsByDate(
  items: Iterable<CalendarItem>, today?: LocalDate, split: (it: CalendarItem, today?: LocalDate) => Segment[] = itemSegments,
): Map<LocalDate, Segment[]> {
  const map = new Map<LocalDate, Segment[]>();
  for (const it of items) {
    for (const s of split(it, today)) {
      const l = map.get(s.date);
      if (l) l.push(s);
      else map.set(s.date, [s]);
    }
  }
  for (const l of map.values()) l.sort(compareSegments);
  return map;
}

/** Overlapping blocks whose starts are at least this far apart cascade (the later one drawn on top, indented). */
export const OVERLAP_STACK_MIN_START_GAP_MIN = 15;
/** One title row of a block (px): top border, 1 px padding, the 16 px title line. A cascade leaves at least this much of the
 * earlier block visible, so its title is never cut (owner, 2026-10-20). */
export const TITLE_ROW_PX = 18;
/** Indent (px) per cascade level. */
export const STACK_INDENT_PX = 10;
/** Deepest cascade level; beyond it blocks fall back to side-by-side columns of the last group. */
export const MAX_STACK_DEPTH = 3;

export interface PlacedSegment {
  seg: Segment;
  /** 0-based column inside the start group and the group's column count (near-identical starts share columns). */
  col: number;
  cols: number;
  /** Columns this block may occupy (>= 1): it widens into free columns to its right, like Google Calendar. */
  span: number;
  /** Cascade level (0 = base, drawn first); the renderer offsets level n by n * STACK_INDENT_PX and draws it on top. */
  level: number;
  top: number; // minutes
  height: number; // minutes: the drawn height, the real duration (never past the real end)
}

/**
 * Packing: items in a connected overlap cluster are grouped by start time. Blocks starting within
 * OVERLAP_STACK_MIN_START_GAP_MIN of the group's first start share equal columns (a title would be hidden otherwise);
 * a later group that overlaps cascades one level deeper (up to MAX_STACK_DEPTH, then it joins the last group's columns).
 * What overlaps is decided from the REAL start and end only (feature min-event-length): the drawn minimum
 * height never makes back-to-back or merely close items overlap. A block that lasts less than `minMinutes` is a bare title row,
 * so a truly overlapping later block cascades over it only when it starts at least `minMinutes` later; closer ones share columns.
 * The drawn box (`PlacedSegment.height`) is the real duration: never past the real end, so a short block never paints over
 * its neighbour and equal durations look equal (owner, 2026-10-21).
 * Touching items (end == start) do not overlap. With `stack` false nothing cascades:
 * a whole overlap cluster shares columns (lanes), as the horizontal Labs view needs.
 */
/**
 * `minMinutes` is the title-row minimum per block, in minutes: a number for all, or per segment. It only decides the cascade
 * (a block shorter than it is a bare title row), never the drawn height.
 * `titleMinutes` is one title row ({@link TITLE_ROW_PX}) in minutes: a later block cascades over an earlier one only when it
 * starts at least that far in (and at least OVERLAP_STACK_MIN_START_GAP_MIN), else they share columns.
 * `minLength` is the owner's minimum event length in minutes (0 = off): a shorter block is laid out as that long everywhere
 * here, drawn so and overlapping what starts within it (feature min-event-length); its real times stay untouched.
 * `limit` (> 0, with `stack`) is the owner's "events side by side" setting of the day or week grid: entries go side by
 * side up to that many columns before they cascade ({@link packSideBySide}); 0 keeps the start-group cascade above (Labs).
 */
export function packColumns(segs: Segment[], minMinutes: number | ((s: Segment) => number) = 0, stack = true, titleMinutes = 0, minLength = 0, limit = 0): PlacedSegment[] {
  const minOf = (s: Segment) => (typeof minMinutes === 'function' ? minMinutes(s) : minMinutes);
  // The end everything below uses: the real end, at least one minute (two zero-length items never paint on top of each
  // other) and at least the minimum event length.
  const layoutEnd = (s: Segment) => Math.max(s.endMin, s.startMin + 1, s.startMin + minLength);
  const timed = segs.filter((s) => !s.allDay && s.startTime !== null).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  if (stack && limit > 0) return packSideBySide(timed, limit, layoutEnd, (s) => Math.max(OVERLAP_STACK_MIN_START_GAP_MIN, titleMinutes, layoutEnd(s) - s.startMin < minOf(s) ? minOf(s) : 0));
  const out: PlacedSegment[] = [];
  interface Group { start: number; end: number; level: number; items: PlacedSegment[]; colEnds: number[]; stackGap: number }
  let groups: Group[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const g of groups) {
      for (const p of g.items) p.cols = g.colEnds.length;
      for (const p of g.items) {
        let span = 1;
        for (let c = p.col + 1; c < p.cols; c++) {
          const blocked = g.items.some((q) => q.col === c && q.top < layoutEnd(p.seg) && p.top < layoutEnd(q.seg));
          if (blocked) break;
          span++;
        }
        p.span = span;
      }
      out.push(...g.items);
    }
    groups = [];
    clusterEnd = -1;
  };
  for (const s of timed) {
    if (groups.length && s.startMin >= clusterEnd) flush();
    const min = minOf(s);
    const end = layoutEnd(s);
    let g = groups[groups.length - 1];
    if (!g || (stack && s.startMin - g.start >= g.stackGap)) {
      const level = 1 + groups.filter((x) => x.end > s.startMin).reduce((m, x) => Math.max(m, x.level), -1);
      if (!g || level <= MAX_STACK_DEPTH) {
        // A block drawn taller than its duration is only a title row: a cascaded later block must leave that whole row visible.
        // Any block keeps its title row clear: at a low zoom 15 min is shorter than one title row (`titleMinutes`).
        const stackGap = Math.max(OVERLAP_STACK_MIN_START_GAP_MIN, titleMinutes, end - s.startMin < min ? min : 0);
        g = { start: s.startMin, end, level, items: [], colEnds: [], stackGap };
        groups.push(g);
      }
    }
    let col = g.colEnds.findIndex((e) => e <= s.startMin);
    if (col < 0) col = g.colEnds.length;
    g.colEnds[col] = end;
    g.end = Math.max(g.end, end);
    g.items.push({ seg: s, col, cols: 1, span: 1, level: g.level, top: s.startMin, height: end - s.startMin });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

/**
 * Side-by-side packing with a column limit (feature event-display, owner 2026-10-25: "Day/Week view: events side by side").
 * Entries come sorted by start (same start: the longer first). Each takes the leftmost column free at its start, or opens
 * a new one while fewer than `limit` are used. When all are busy it is laid over the last column, one cascade level above
 * the topmost block there (capped at {@link MAX_STACK_DEPTH}), and that column stays busy until everything over it ends.
 * Titles stay readable (owner, 2026-10-20): when the topmost block of the last column starts less than its `gapOf` before
 * the entry, the entry opens one more column instead, beyond the limit, but at most one (owner, 2026-10-25): with
 * `limit + 1` columns in use, further near-simultaneous entries are laid over the last column even if a title is covered.
 *
 * @param timed The timed segments of one day, sorted by start, then the longer first.
 * @param limit The most columns placed side by side before entries cascade.
 * @param layoutEnd The end (minutes) a segment is laid out to.
 * @param gapOf The least start distance (minutes) a later block needs to cascade over this one and leave its title visible.
 * @returns The placed segments, in placement order.
 */
function packSideBySide(timed: Segment[], limit: number, layoutEnd: (s: Segment) => number, gapOf: (s: Segment) => number): PlacedSegment[] {
  const out: PlacedSegment[] = [];
  interface Column { busyUntil: number; top: PlacedSegment }
  let cols: Column[] = [];
  let cluster: PlacedSegment[] = [];
  let clusterEnd = -1;
  const flush = () => {
    // the whole overlap cluster shares the width in as many columns as it used; base blocks widen into free columns
    for (const p of cluster) {
      p.cols = cols.length;
      if (p.level > 0) continue;
      const end = p.top + p.height;
      let span = 1;
      for (let c = p.col + 1; c < p.cols && !cluster.some((q) => q.col === c && q.top < end && p.top < q.top + q.height); c++) span++;
      p.span = span;
    }
    out.push(...cluster);
    cluster = [];
    cols = [];
    clusterEnd = -1;
  };
  for (const s of timed) {
    if (cluster.length && s.startMin >= clusterEnd) flush();
    const end = layoutEnd(s);
    const p: PlacedSegment = { seg: s, col: 0, cols: 1, span: 1, level: 0, top: s.startMin, height: end - s.startMin };
    const free = cols.findIndex((c) => c.busyUntil <= s.startMin);
    const last = cols[cols.length - 1];
    if (free >= 0) {
      p.col = free;
      cols[free] = { busyUntil: end, top: p };
    } else if (cols.length < limit || (cols.length === limit && s.startMin - last.top.top < gapOf(last.top.seg))) {
      // a new column: still under the limit, or (once, owner 2026-10-25) a cascade here would hide the title below
      p.col = cols.length;
      cols.push({ busyUntil: end, top: p });
    } else {
      p.col = cols.length - 1;
      p.level = Math.min(last.top.level + 1, MAX_STACK_DEPTH);
      cols[p.col] = { busyUntil: Math.max(last.busyUntil, end), top: p };
    }
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

/** Category/tag filter semantics (API.md): categories OR, tags OR, groups AND; events never filtered. */
export interface Filters {
  categories: string[]; // category ids, 'none' = no category
  tags: string[];
}
export function filterActive(f: Filters): boolean {
  return f.categories.length + f.tags.length > 0;
}
export function matchesFilters(item: CalendarItem, f: Filters): boolean {
  if (item.kind === 'event' || !filterActive(f)) return true;
  if (f.categories.length && !f.categories.includes(item.categoryId ?? 'none')) return false;
  if (f.tags.length) {
    const have = item.tags.map((t) => t.toLowerCase());
    if (!f.tags.some((t) => have.includes(t.toLowerCase()))) return false;
  }
  return true;
}

/**
 * Minimum rendered block box height (px): 24 px visible plus the block's 1 px bottom gap; the block keeps its
 * start position (spec: timeline, short events).
 */
export const MIN_BLOCK_PX = 25;
/** Rendered top and height (px) of a timed segment: proportional to the duration, never below `MIN_BLOCK_PX`. */
export function blockGeometry(startMin: number, endMin: number, hourHeight: number, minPx = MIN_BLOCK_PX): { top: number; height: number } {
  return { top: (startMin / 60) * hourHeight, height: Math.max(((endMin - startMin) / 60) * hourHeight, minPx) };
}
