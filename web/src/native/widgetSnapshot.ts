/**
 * The Android home-screen widget's snapshot (ARCHITECTURE "Android app and widget"): a compact, pure description of
 * the current week (Monday to Sunday), today's task lists and the theme colours. The widget fetches the week itself;
 * this snapshot supplies the theme, the language and a fallback when that fetch fails.
 */
import { addDays, format, startOfWeek } from 'date-fns';
import type { CalendarItem, LocalDate, TaskList } from '@/api/types';
import { parseIsoDate, WEEK_OPTS } from '@/lib/dates';
import { segmentsByDate } from '@/lib/items';
import type { Language } from '@/i18n/language';

/** The theme colour roles the widget uses, each `#rrggbb`. */
export interface WidgetTheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  surface: string;
  surfaceContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
}

/** One event as shown on one day: `start`/`end` are `HH:mm` wall times, null for all-day (and continuation days). */
export interface WidgetEvent {
  title: string;
  allDay: boolean;
  start: string | null;
  end: string | null;
  color: string;
}

export interface WidgetDay { date: LocalDate; events: WidgetEvent[] }
export interface WidgetTaskList { title: string; done: number; total: number; color: string }

export interface WidgetSnapshot {
  /** Format version; the native side ignores snapshots of a version it does not know. */
  v: 1;
  generatedAt: string;
  language: Language;
  dark: boolean;
  theme: WidgetTheme;
  weekStart: LocalDate;
  days: WidgetDay[];
  /** Today's task lists. */
  tasklists: WidgetTaskList[];
}

export interface SnapshotInput {
  items: CalendarItem[];
  today: LocalDate;
  theme: WidgetTheme;
  dark: boolean;
  language: Language;
  now: Date;
  /** Ids of the calendars the person switched off; their events are left out. */
  hiddenCalendars?: ReadonlySet<string>;
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Builds the snapshot of the week containing `input.today`.
 *
 * Events are split per day they cover by the calendar's own `segmentsByDate` (a multi-day event shows on each day; its time only on the first). Task lists
 * are not shown in the day columns; those dated today go into `tasklists`.
 *
 * @param input The loaded items (any range; others are ignored), today's date, theme, language and the clock.
 * @returns The snapshot, JSON-serialisable.
 */
export function buildWidgetSnapshot(input: SnapshotInput): WidgetSnapshot {
  const monday = startOfWeek(parseIsoDate(input.today)!, WEEK_OPTS);
  const segments = segmentsByDate(input.items.filter((it) => it.kind === 'event' && !input.hiddenCalendars?.has(it.calendarId))); // the calendar's own splitting and day order
  const days: WidgetDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(monday, i));
    const events = (segments.get(date) ?? []).map((seg): WidgetEvent => {
      const timed = !seg.allDay && seg.first;
      return { title: seg.item.title, allDay: !timed, start: timed ? seg.startTime : null, end: timed ? seg.endTime : null, color: seg.item.color };
    });
    return { date, events };
  });

  const tasklists = input.items
    .filter((it): it is TaskList => it.kind === 'tasklist' && it.date === input.today)
    .map((l) => ({ title: l.title, done: l.doneCount, total: l.totalCount, color: l.color }));

  return { v: 1, generatedAt: input.now.toISOString(), language: input.language, dark: input.dark, theme: input.theme, weekStart: days[0].date, days, tasklists };
}
