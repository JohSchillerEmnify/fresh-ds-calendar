import {
  addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isValid, parse, startOfMonth, startOfWeek,
} from 'date-fns';

/** Week starts Monday everywhere (BRIEF). All date-only math uses local `Date`s at 00:00 (no time zone surprises). */
export const WEEK_OPTS = { weekStartsOn: 1 as const };

export type ViewKind = 'year' | 'month' | 'week' | 'day';
export const VIEWS: ViewKind[] = ['year', 'month', 'week', 'day'];
export const VIEW_LABEL: Record<ViewKind, string> = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
export function toIsoMonth(d: Date): string {
  return format(d, 'yyyy-MM');
}

const REF = new Date(2000, 0, 1);
/** Strict `yyyy-MM-dd` parser; null for anything invalid (e.g. 2026-02-30). */
export function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parse(s, 'yyyy-MM-dd', REF);
  return isValid(d) ? d : null;
}
export function parseIsoMonth(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  const d = parse(s, 'yyyy-MM', REF);
  return isValid(d) ? d : null;
}
export function parseYear(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}$/.test(s)) return null;
  return new Date(Number(s), 0, 1);
}

/** Parses the route param of a view into its anchor date (week → its Monday); null when invalid. */
export function parseParam(view: ViewKind, value: string | undefined): Date | null {
  if (view === 'year') return parseYear(value);
  if (view === 'month') return parseIsoMonth(value);
  const d = parseIsoDate(value);
  if (!d) return null;
  return view === 'week' ? startOfWeek(d, WEEK_OPTS) : d;
}

export function routeParam(view: ViewKind, d: Date): string {
  if (view === 'year') return format(d, 'yyyy');
  if (view === 'month') return toIsoMonth(d);
  if (view === 'week') return toIsoDate(startOfWeek(d, WEEK_OPTS));
  return toIsoDate(d);
}
export function routePath(view: ViewKind, d: Date): string {
  return `/${view}/${routeParam(view, d)}`;
}

/** Month grid: weeks (Mon..Sun) covering the month incl. adjacent days. */
export function monthGrid(anchor: Date): Date[][] {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), WEEK_OPTS),
    end: endOfWeek(endOfMonth(anchor), WEEK_OPTS),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, WEEK_OPTS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftPeriod(view: ViewKind, anchor: Date, dir: 1 | -1): Date {
  if (view === 'year') return addYears(anchor, dir);
  if (view === 'month') return addMonths(anchor, dir);
  if (view === 'week') return addWeeks(anchor, dir);
  return addDays(anchor, dir);
}

/** Period title, en-GB (ARCHITECTURE §5). */
export function periodTitle(view: ViewKind, anchor: Date): string {
  if (view === 'year') return format(anchor, 'yyyy');
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'day') return format(anchor, 'EEEE, d MMMM yyyy');
  const days = weekDays(anchor);
  const [a, b] = [days[0], days[6]];
  if (a.getFullYear() !== b.getFullYear()) return `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`;
  if (a.getMonth() !== b.getMonth()) return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`;
  return `${format(a, 'd')} – ${format(b, 'd MMM yyyy')}`;
}

/** First and last (inclusive) day of the period the view shows. */
export function periodBounds(view: ViewKind, anchor: Date): [Date, Date] {
  if (view === 'year') return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31)];
  if (view === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
  if (view === 'week') return [startOfWeek(anchor, WEEK_OPTS), endOfWeek(anchor, WEEK_OPTS)];
  return [anchor, anchor];
}

/** `[from, to)` ISO range the view needs from `/api/items` (month incl. adjacent days). */
export function fetchRange(view: ViewKind, anchor: Date): [string, string] {
  let a: Date, b: Date;
  if (view === 'month') {
    const g = monthGrid(anchor);
    a = g[0][0];
    b = g[g.length - 1][6];
  } else [a, b] = periodBounds(view, anchor);
  return [toIsoDate(a), toIsoDate(addDays(b, 1))];
}

export function inPeriod(view: ViewKind, anchor: Date, d: Date): boolean {
  const [a, b] = periodBounds(view, anchor);
  return differenceInCalendarDays(d, a) >= 0 && differenceInCalendarDays(b, d) >= 0;
}

/** Focus date after a route change: keep if inside, else today if inside, else the period's first day. */
export function nextFocus(view: ViewKind, anchor: Date, focus: Date | null, today: Date): Date {
  if (focus && inPeriod(view, anchor, focus)) return focus;
  if (inPeriod(view, anchor, today)) return today;
  return periodBounds(view, anchor)[0];
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);
export function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
export function minutesToTime(m: number): string {
  const c = Math.max(0, Math.min(24 * 60, Math.round(m)));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}
export function timeToMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}
export { addDays, differenceInCalendarDays };
