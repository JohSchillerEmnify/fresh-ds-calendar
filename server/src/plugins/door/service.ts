/** What the door board gets: open items of door-tagged lists that are due, and today's events — titles and times only. */
import type { CalendarService } from '../../services/calendar.js';
import type { TaskList } from '../../api/types.js';
import { addDays } from '../../lib/time.js';

/** The tag a task list carries when it is marked "Show on door". */
export const DOOR_TAG = 'door';

export interface DoorReminder {
  title: string;
  list: string;
  /** The list's date; null for an undated list (due until it is done). */
  date: string | null;
  time?: string;
}
export interface DoorEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

/** A repeating list's occurrences share the master's id before the `_YYYYMMDD` (timed: `_YYYYMMDDTHHMMSSZ`) suffix. */
const masterId = (id: string) => id.replace(/_\d{8}(T\d{6}Z)?$/, '');

/**
 * Door-tagged lists that are due today (dated today or earlier, or undated), one per repeating list — its latest
 * due occurrence — oldest date first, undated last; within a list the items keep their order.
 */
export function dueDoorLists(lists: TaskList[], today: string): TaskList[] {
  const due = lists.filter((l) => l.tags.includes(DOOR_TAG) && (l.date === null || l.date <= today));
  const latest = new Map<string, TaskList>();
  for (const l of due) {
    const key = l.seriesKey ?? l.seriesId ?? (l.recurrence ? masterId(l.id) : l.id);
    const seen = latest.get(key);
    if (!seen || (l.date ?? '') > (seen.date ?? '')) latest.set(key, l);
  }
  return [...latest.values()].sort((a, b) => {
    if (a.date === null || b.date === null) return Number(a.date === null) - Number(b.date === null);
    return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title);
  });
}

export async function doorAnswer(cal: CalendarService, hidden: Set<string>, today: string): Promise<{ reminders: DoorReminder[]; events: DoorEvent[] }> {
  const [{ items: lists }, { items }] = await Promise.all([cal.allOpenTaskLists(today), cal.items(today, addDays(today, 1))]);
  const reminders = dueDoorLists(lists, today).flatMap((l) => l.items.filter((i) => !i.done).map((i) => ({
    title: i.title, list: l.title, date: l.date, ...(l.time ? { time: l.time } : {}),
  })));
  const events = items.flatMap((i) => (i.kind === 'event' && !hidden.has(i.calendarId) ? [{ title: i.title, start: i.start, end: i.end, allDay: i.allDay }] : []));
  return { reminders, events };
}
