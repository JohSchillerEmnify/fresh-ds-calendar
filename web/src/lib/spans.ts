/**
 * Multi-day "bars" (Google style): events covering 2+ calendar days (all-day with an exclusive end, or timed and
 * lasting 24 h or more) are drawn as one continuous bar per visible week row instead of one chip per day.
 * Timed events shorter than 24 h that cross midnight keep their per-day blocks (see itemSegments).
 */
import { addDays, differenceInCalendarDays, parseIsoDate, timeToMinutes, toIsoDate } from './dates';
import type { CalendarEvent, CalendarItem, LocalDate } from '@/api/types';
import type { Segment } from './items';

export interface DayRange {
  /** First covered local date. */
  start: LocalDate;
  /** Last covered local date (inclusive). */
  last: LocalDate;
}

/** Covered dates of an event, or null when it is not a bar (single day, short overnight, task list). */
export function barRange(item: CalendarItem): DayRange | null {
  if (item.kind !== 'event') return null;
  const a = parseIsoDate(item.start.slice(0, 10));
  const b = parseIsoDate(item.end.slice(0, 10));
  if (!a || !b) return null;
  let lastDay = b;
  if (item.allDay) lastDay = addDays(b, -1); // Google all-day end is exclusive
  else {
    if (Date.parse(item.end) - Date.parse(item.start) < 24 * 3600e3) return null;
    if (item.end.slice(11, 16) === '00:00') lastDay = addDays(b, -1);
  }
  if (differenceInCalendarDays(lastDay, a) < 1) return null;
  return { start: toIsoDate(a), last: toIsoDate(lastDay) };
}
export const isBarEvent = (item: CalendarItem): boolean => barRange(item) !== null;

export interface Bar {
  item: CalendarEvent;
  /** 0-based columns inside the visible row, inclusive. */
  startCol: number;
  endCol: number;
  lane: number;
  continuedFromPrev: boolean;
  continuesToNext: boolean;
  /** Clipped first / last visible date of this segment. */
  startDate: LocalDate;
  endDate: LocalDate;
}

/**
 * Bar segments for one row of consecutive `dates` (a week row, or the visible days of week / day view).
 * Lanes are assigned greedily: earlier start first, then longer, then id (stable).
 */
export function computeBars(items: Iterable<CalendarItem>, dates: LocalDate[]): Bar[] {
  if (!dates.length) return [];
  const first = dates[0], last = dates[dates.length - 1];
  const col = new Map(dates.map((d, i) => [d, i]));
  const cand: { item: CalendarEvent; r: DayRange; len: number }[] = [];
  for (const item of items) {
    const r = barRange(item);
    if (!r || r.last < first || r.start > last) continue;
    cand.push({ item: item as CalendarEvent, r, len: differenceInCalendarDays(parseIsoDate(r.last)!, parseIsoDate(r.start)!) });
  }
  cand.sort((x, y) => (x.r.start < y.r.start ? -1 : x.r.start > y.r.start ? 1 : 0) || y.len - x.len || (x.item.id < y.item.id ? -1 : x.item.id > y.item.id ? 1 : 0));
  const laneEnd: number[] = [];
  return cand.map(({ item, r }) => {
    const startDate = r.start < first ? first : r.start, endDate = r.last > last ? last : r.last;
    const startCol = col.get(startDate)!, endCol = col.get(endDate)!;
    let lane = laneEnd.findIndex((e) => e < startCol);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = endCol;
    return { item, startCol, endCol, lane, continuedFromPrev: r.start < first, continuesToNext: r.last > last, startDate, endDate };
  });
}

export const laneCount = (bars: Bar[]): number => bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);

/** Pseudo segment for dragging a bar grabbed on `originDate`: planMove shifts by (drop date - originDate). */
export function barSegment(item: CalendarEvent, originDate: LocalDate): Segment {
  const t = item.allDay ? '00:00' : item.start.slice(11, 16);
  return {
    item, date: originDate, allDay: item.allDay, startTime: item.allDay ? null : t, endTime: null,
    startMin: item.allDay ? 0 : timeToMinutes(t), endMin: 0, first: true, last: true,
  };
}
