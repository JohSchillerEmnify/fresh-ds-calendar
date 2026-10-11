import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isValid, parse, startOfMonth, startOfWeek,
} from 'date-fns';

/** Week starts Monday everywhere (BRIEF). */
export const WEEK_OPTS = { weekStartsOn: 1 as const };

export type ViewKind = 'month' | 'week' | 'day';
export const VIEWS: ViewKind[] = ['month', 'week', 'day'];

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
export function toIsoMonth(d: Date): string {
  return format(d, 'yyyy-MM');
}

/** Parses `yyyy-MM` or `yyyy-MM-dd`; returns null when invalid. */
export function parseParam(view: ViewKind, value: string | undefined): Date | null {
  if (!value) return null;
  const fmt = view === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd';
  if (value.length !== fmt.length) return null;
  const d = parse(value, fmt, new Date(2000, 0, 1));
  return isValid(d) ? d : null;
}

export function routeParam(view: ViewKind, d: Date): string {
  return view === 'month' ? toIsoMonth(d) : toIsoDate(d);
}

export function routePath(view: ViewKind, d: Date): string {
  return `/${view}/${routeParam(view, d)}`;
}

/**
 * Month grid: array of weeks (Mon..Sun), covering the whole month.
 * 4–6 rows depending on the month.
 */
export function monthGrid(anchor: Date): Date[][] {
  const start = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
  const end = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
  const days = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** The 7 days (Mon..Sun) of the week containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, WEEK_OPTS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftPeriod(view: ViewKind, anchor: Date, dir: 1 | -1): Date {
  if (view === 'month') return addMonths(anchor, dir);
  if (view === 'week') return addWeeks(anchor, dir);
  return addDays(anchor, dir);
}

export function periodLabel(view: ViewKind, anchor: Date): string {
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'day') return format(anchor, 'EEE, d MMM yyyy');
  const [first, last] = [weekDays(anchor)[0], weekDays(anchor)[6]];
  if (first.getMonth() === last.getMonth()) return `${format(first, 'd')}–${format(last, 'd MMM yyyy')}`;
  if (first.getFullYear() === last.getFullYear()) return `${format(first, 'd MMM')} – ${format(last, 'd MMM yyyy')}`;
  return `${format(first, 'd MMM yyyy')} – ${format(last, 'd MMM yyyy')}`;
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);
export function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
