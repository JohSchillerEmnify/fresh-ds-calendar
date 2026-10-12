/**
 * Pure helpers that turn API items into per-day segments for the views.
 * API timed values always carry the calendar-zone offset, so the first 10 / next 5 chars are the local date / time.
 */
import { addDays, differenceInCalendarDays, parseIsoDate, timeToMinutes, toIsoDate } from './dates';
import type { CalendarItem, LocalDate } from '@/api/types';

export const TASKLIST_BLOCK_MINUTES = 30;

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

/** True for an open list dated within the last 30 days before `today` (shown on today, ARCHITECTURE 5b). */
export function isCarriedOver(item: CalendarItem, today: LocalDate | undefined): boolean {
  if (item.kind !== 'tasklist' || !today || item.date >= today || item.doneCount >= item.totalCount) return false;
  const a = parseIsoDate(item.date), b = parseIsoDate(today);
  return !!a && !!b && differenceInCalendarDays(b, a) <= CARRY_OVER_DAYS;
}

export function itemSegments(item: CalendarItem, today?: LocalDate): Segment[] {
  if (item.kind === 'tasklist') {
    if (isCarriedOver(item, today)) {
      return [{
        item, date: today!, allDay: false, startTime: null, endTime: null, startMin: 0, endMin: 0, first: true, last: true,
        carriedFrom: item.date,
      }];
    }
    const timed = item.time !== null;
    const s = timed ? timeToMinutes(item.time!) : 0;
    const e = timed ? Math.min(24 * 60, s + (item.estimateMinutes ?? TASKLIST_BLOCK_MINUTES)) : 0;
    return [{
      item, date: item.date, allDay: false, startTime: item.time, endTime: timed ? hhmm(e) : null,
      startMin: s, endMin: e, first: true, last: true,
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

export function segmentsByDate(items: Iterable<CalendarItem>, today?: LocalDate): Map<LocalDate, Segment[]> {
  const map = new Map<LocalDate, Segment[]>();
  for (const it of items) {
    for (const s of itemSegments(it, today)) {
      const l = map.get(s.date);
      if (l) l.push(s);
      else map.set(s.date, [s]);
    }
  }
  for (const l of map.values()) l.sort(compareSegments);
  return map;
}

export interface PlacedSegment {
  seg: Segment;
  /** 0-based column inside the overlap cluster and the cluster's column count. */
  col: number;
  cols: number;
  /** Columns this block may occupy (>= 1): it widens into free columns to its right, like Google Calendar. */
  span: number;
  top: number; // minutes
  height: number; // minutes (>= min)
}

/**
 * Google-like column packing: items in a connected overlap cluster are split into equal columns;
 * touching items (end == start) do not overlap. `minMinutes` is the minimum rendered duration.
 */
export function packColumns(segs: Segment[], minMinutes = 0): PlacedSegment[] {
  const timed = segs.filter((s) => !s.allDay && s.startTime !== null).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: PlacedSegment[] = [];
  let cluster: PlacedSegment[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];
  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    for (const p of cluster) {
      let span = 1;
      for (let c = p.col + 1; c < p.cols; c++) {
        const blocked = cluster.some((q) => q.col === c && q.top < p.top + p.height && p.top < q.top + q.height);
        if (blocked) break;
        span++;
      }
      p.span = span;
    }
    out.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };
  for (const s of timed) {
    if (cluster.length && s.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= s.startMin);
    if (col < 0) col = colEnds.length;
    const visualEnd = Math.max(s.endMin, s.startMin + minMinutes);
    colEnds[col] = visualEnd;
    cluster.push({ seg: s, col, cols: 1, span: 1, top: s.startMin, height: Math.max(s.endMin - s.startMin, minMinutes) });
    clusterEnd = Math.max(clusterEnd, visualEnd);
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

/** Minimum rendered block height (px); the block keeps its start position (spec: timeline, short events). */
export const MIN_BLOCK_PX = 24;
/** Rendered top and height (px) of a timed segment: proportional to the duration, never below `MIN_BLOCK_PX`. */
export function blockGeometry(startMin: number, endMin: number, hourHeight: number, minPx = MIN_BLOCK_PX): { top: number; height: number } {
  return { top: (startMin / 60) * hourHeight, height: Math.max(((endMin - startMin) / 60) * hourHeight, minPx) };
}
/** Task lists with open items never render shorter than title row + 2 mini item rows (keeps the start, may overlap the next block like the 24 px event minimum). */
export const TASKLIST_MIN_BLOCK_PX = 44;
export function segmentMinPx(seg: Segment): number {
  const i = seg.item;
  return i.kind === 'tasklist' && i.items.some((x) => !x.done) ? TASKLIST_MIN_BLOCK_PX : MIN_BLOCK_PX;
}
