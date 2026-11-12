/**
 * The Android home-screen widget's snapshot (feature phone-widget): a compact, pure description of
 * the days from this week's Monday to 13 days after today (the week widgets use the week, the list widget the 14 days from today),
 * today's task lists and the theme colours. The widget fetches the week itself;
 * this snapshot supplies the theme, the language and a fallback when that fetch fails.
 */
import { addDays, differenceInCalendarDays, format, startOfWeek } from 'date-fns';
import type { CalendarItem, LocalDate, TaskList } from '@/api/types';
import { listColor } from '@/features/tasklists/categories';
import { parseIsoDate, WEEK_OPTS } from '@/lib/dates';
import { segmentsByDate, specialMarker } from '@/lib/items';
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
interface WidgetEvent {
  title: string;
  allDay: boolean;
  start: string | null;
  end: string | null;
  color: string;
}

interface WidgetDay { date: LocalDate; events: WidgetEvent[] }
interface WidgetTaskList { title: string; done: number; total: number; color: string }

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
  /** The minimum event length in minutes (0 = none): the widget lays shorter timed entries out as this long. */
  minEventMinutes: number;
  /** How many overlapping events the week view places side by side (2 or 3): the widget's week grid follows it. */
  weekSideBySide: number;
  /** The Multi-day widget's number of days (1 to 7) and the hours it fits into its height (Settings › Widgets). */
  scrollDays: number;
  scrollHours: number;
  /** Text size of the Multi-day widget in percent. */
  scrollTextPercent: number;
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
  /** The person's minimum event length in minutes (default 0 = none). */
  minEventMinutes?: number;
  /** The person's "Week view: events side by side" setting (default 2). */
  weekSideBySide?: number;
  /** The "Task categories" switch (default on); off, a task list takes its calendar's colour, as in the app. */
  categoriesOn?: boolean;
  /** The "Hours in view" setting of the Multi-day widget (default 16). */
  androidWidgetHours?: number;
  /** The shared Timeline day count (default 3). */
  timelineDays?: number;
  /** The shared Timeline text size in percent (default 110). */
  timelineTextSize?: number;
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
/** The list widget reaches today and the 13 days after it. */
const SCROLL_DAYS = 14;

/**
 * Builds the snapshot from the Monday of the week containing `input.today` to 13 days after today.
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
  const length = differenceInCalendarDays(parseIsoDate(input.today)!, monday) + SCROLL_DAYS;
  const days: WidgetDay[] = Array.from({ length }, (_, i) => {
    const date = iso(addDays(monday, i));
    const events = (segments.get(date) ?? []).map((seg): WidgetEvent => {
      const timed = !seg.allDay && seg.first;
      const marker = specialMarker(seg.item);
      return { title: marker ? `${marker} ${seg.item.title}` : seg.item.title, allDay: !timed, start: timed ? seg.startTime : null, end: timed ? seg.endTime : null, color: seg.item.color };
    });
    return { date, events };
  });

  const tasklists = input.items
    .filter((it): it is TaskList => it.kind === 'tasklist' && it.date === input.today)
    .map((l) => ({ title: l.title, done: l.doneCount, total: l.totalCount, color: listColor(l, input.categoriesOn ?? true) }));

  return { v: 1, generatedAt: input.now.toISOString(), language: input.language, dark: input.dark, theme: input.theme, weekStart: days[0].date, days, tasklists, minEventMinutes: input.minEventMinutes ?? 0, weekSideBySide: input.weekSideBySide ?? 2, scrollDays: input.timelineDays ?? 3, scrollHours: input.androidWidgetHours ?? 16, scrollTextPercent: input.timelineTextSize ?? 110 };
}
