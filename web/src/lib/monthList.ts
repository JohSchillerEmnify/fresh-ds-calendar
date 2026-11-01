/** Geometry of the month list that scrolls up and down (month-vertical): fixed week heights make positions plain arithmetic. */
import { getDay, getDaysInMonth } from 'date-fns';
import { WEEK_OPTS } from './dates';

/** The list reaches from January of this year to December of the other one (a deep link outside it is clamped). */
const FIRST_YEAR = 1970;
const LAST_YEAR = 2100;
/** The number of months in the list. */
export const MONTH_COUNT = (LAST_YEAR - FIRST_YEAR + 1) * 12;

/** The fixed height of a week row (px): a phone's, and a wider screen's. */
export const weekHeight = (phone: boolean): number => (phone ? 96 : 128);
/** The height of a month's header and of the pinned weekday row (px). */
export const MONTH_HEADER_H = 40;
export const WEEKDAY_ROW_H = 28;

/** The pixel sizes the list is laid out with: one week row and a month's header. */
export interface ListMetrics { weekH: number; headerH: number }
/** Where each month starts, from the top of the first one (`tops[MONTH_COUNT]` is the total height). */
export interface ListLayout extends ListMetrics { tops: number[] }

/** The list position of the month `d` is in, clamped to the list. */
export function monthIndex(d: Date): number {
  return Math.min(MONTH_COUNT - 1, Math.max(0, (d.getFullYear() - FIRST_YEAR) * 12 + d.getMonth()));
}

/** The first day of the month at list position `i`. */
export function monthDate(i: number): Date {
  return new Date(FIRST_YEAR + Math.floor(i / 12), i % 12, 1);
}

/** How many week rows the month at list position `i` has (every date once, the month starts on a new row). */
export function weeksOf(i: number): number {
  const first = monthDate(i);
  return Math.ceil(((getDay(first) - WEEK_OPTS.weekStartsOn + 7) % 7 + getDaysInMonth(first)) / 7);
}

const layouts = new Map<string, ListLayout>();

/** The layout for these metrics (built once per size: about 1,500 months of plain arithmetic). */
export function listLayout(m: ListMetrics): ListLayout {
  const key = `${m.weekH}/${m.headerH}`;
  let l = layouts.get(key);
  if (!l) {
    const tops = [0];
    for (let i = 0; i < MONTH_COUNT; i++) tops.push(tops[i] + m.headerH + weeksOf(i) * m.weekH);
    l = { ...m, tops };
    layouts.set(key, l);
  }
  return l;
}

/** The position of the month that holds the list offset `y` (the last month for an offset past the end). */
export function monthAtOffset(l: ListLayout, y: number): number {
  let lo = 0;
  let hi = MONTH_COUNT - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (l.tops[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The month with the largest share of the visible stretch `[top, top + viewH)`; the earlier month wins a tie. */
export function mostInView(l: ListLayout, top: number, viewH: number): number {
  const first = monthAtOffset(l, top);
  let best = first;
  let bestShare = -1;
  for (let i = first; i < MONTH_COUNT && l.tops[i] < top + viewH; i++) {
    const share = Math.min(l.tops[i + 1], top + viewH) - Math.max(l.tops[i], top);
    if (share > bestShare) { best = i; bestShare = share; }
  }
  return best;
}

/** The offset that keeps the month at `top` in view at the same relative place when the layout changes (e.g. the week height on rotation). */
export function rescaleTop(from: ListLayout, to: ListLayout, top: number): number {
  if (from === to) return top;
  const m = monthAtOffset(from, top);
  return to.tops[m] + ((top - from.tops[m]) * to.weekH) / from.weekH;
}
