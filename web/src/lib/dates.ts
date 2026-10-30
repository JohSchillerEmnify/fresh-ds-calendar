import {
  addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek,
  startOfMonth, startOfWeek,
} from 'date-fns';
import { dateLocale, language } from '@/i18n/language';

/** Week starts Monday everywhere (BRIEF). All date-only math uses local `Date`s at 00:00 (no time zone surprises). */
export const WEEK_OPTS = { weekStartsOn: 1 as const };

export type ViewKind = 'year' | 'month' | 'week' | 'day';
export const VIEWS: ViewKind[] = ['year', 'month', 'week', 'day'];
export const VIEW_LABEL: Record<ViewKind, string> = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };

const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * English date formatting for the date-fns tokens the app uses (yyyy, MM, MMM, MMMM, dd, d, EEE, EEEE); output equals
 * date-fns `format` with its default en-US locale. Written out because `format` + locale cost ~9 KB gzipped on the first load.
 *
 * @throws RangeError For an invalid date, like date-fns.
 */
export function format(d: Date, pattern: string): string {
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid time value');
  return pattern.replace(/yyyy|MMMM|MMM|MM|EEEE|EEE|dd|d/g, (token) => {
    switch (token) {
      case 'yyyy': return String(d.getFullYear()).padStart(4, '0');
      case 'MM': return String(d.getMonth() + 1).padStart(2, '0');
      case 'MMM': return EN_MONTHS[d.getMonth()].slice(0, 3);
      case 'MMMM': return EN_MONTHS[d.getMonth()];
      case 'dd': return String(d.getDate()).padStart(2, '0');
      case 'd': return String(d.getDate());
      case 'EEE': return EN_DAYS[d.getDay()].slice(0, 3);
      default: return EN_DAYS[d.getDay()];
    }
  });
}

/** An `Intl` formatter for the active language's date locale (de-DE for German and the fun languages). */
const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dateLocale(), o);

/** Short weekday labels Monday..Sunday in the active language (English keeps its fixed three-letter forms). */
export function weekdayLabels(): string[] {
  if (language.value === 'en') return EN_WEEKDAYS;
  const f = intl({ weekday: 'short' });
  // 2024-01-01 was a Monday
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)));
}

/** Month names January..December in the active language. */
export function monthNames(): string[] {
  if (language.value === 'en') return EN_MONTHS;
  const f = intl({ month: 'long' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2024, i, 1)));
}

/** Display date shapes; each maps to a date-fns pattern (English, kept as before) and `Intl` options (other languages). */
const DATE_FORMATS = {
  weekday: { en: 'EEE', intl: { weekday: 'short' } },
  dayMonthShort: { en: 'd MMM', intl: { day: 'numeric', month: 'short' } },
  weekdayDayMonth: { en: 'EEE d MMM', intl: { weekday: 'short', day: 'numeric', month: 'short' } },
  weekdayDayMonthLong: { en: 'EEEE d MMMM', intl: { weekday: 'long', day: 'numeric', month: 'long' } },
  monthYear: { en: 'MMMM yyyy', intl: { month: 'long', year: 'numeric' } },
  full: { en: 'EEEE d MMMM yyyy', intl: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } },
} as const satisfies Record<string, { en: string; intl: Intl.DateTimeFormatOptions }>;
export type DateFormatKind = keyof typeof DATE_FORMATS;

/** Formats a date for display in the active language: date-fns for English (feature language), `Intl` de-DE otherwise. */
export function formatDate(d: Date, kind: DateFormatKind): string {
  const spec = DATE_FORMATS[kind];
  return language.value === 'en' ? format(d, spec.en) : intl(spec.intl).format(d);
}

export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
export function toIsoMonth(d: Date): string {
  return format(d, 'yyyy-MM');
}

/** The local date `y-m-d` at 00:00, or null when it does not exist (month 13, 30 February, year 0). */
function localDate(y: number, m: number, d: number): Date | null {
  if (y < 1) return null;
  const date = new Date(y, m - 1, d);
  // years 0-99 would otherwise map to 1900-1999
  date.setFullYear(y);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Strict `yyyy-MM-dd` parser; null for anything invalid (e.g. 2026-02-30). (No date-fns `parse`: it is ~11 KB gzipped.) */
export function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return localDate(Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10)));
}
export function parseIsoMonth(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  return localDate(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 1);
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

/**
 * Period title in the active language: en-GB for English, `Intl` de-DE otherwise (feature language). `short` shortens
 * only the day view's title ("Mon, 12 Oct"; the one-row header, feature header-layout). A week is titled by the month of its Thursday ("Oct 2026", feature header-expressive).
 */
export function periodTitle(view: ViewKind, anchor: Date, short = false): string {
  if (language.value !== 'en') return localizedPeriodTitle(view, anchor, short);
  if (view === 'year') return format(anchor, 'yyyy');
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'day') return format(anchor, short ? 'EEE, d MMM' : 'EEEE, d MMMM yyyy');
  // a week is titled by the month of its Thursday; the day row shows the days
  return format(weekDays(anchor)[3], 'MMM yyyy');
}

/** The period title through `Intl` (German and the fun languages). */
function localizedPeriodTitle(view: ViewKind, anchor: Date, short: boolean): string {
  if (view === 'year') return String(anchor.getFullYear());
  if (view === 'month') return intl({ month: 'long', year: 'numeric' }).format(anchor);
  if (view === 'day' && short) return intl({ weekday: 'short', day: 'numeric', month: 'short' }).format(anchor);
  if (view === 'day') return intl({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
  return intl({ month: 'short', year: 'numeric' }).format(weekDays(anchor)[3]);
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
