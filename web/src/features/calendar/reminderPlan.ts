/**
 * The reminder plan: which reminders ring when, computed from the loaded items. One reminder per timed event (or timed task
 * list) and reminder lead, at start minus lead (feature reminders). Pure: the in-app snackbars and
 * the native notification scheduling (`transitionWarning.ts`) both read this list. Also the shared wording of a lead.
 */
import { itemSegments, type Segment } from '@/lib/items';
import { t } from '@/i18n';
import { addDays, formatDate, parseIsoDate, toIsoDate } from '@/lib/dates';
import { fromWallMinutes, localToIso, offsetMinutes } from './zone';
import { formatDuration } from './timeline';

/** Google allows at most 5 reminders per event and 5 defaults per calendar. */
export const MAX_REMINDERS = 5;
/** The leads the "Add reminder" picker offers, in minutes (a custom field covers the rest). */
export const REMINDER_PRESETS = [5, 10, 15, 30, 60, 90, 120, 1440] as const;

/** A lead as words: `30 min`, `1 h 30 min`, `1 day`, `At start` for 0. */
export function formatLead(minutes: number): string {
  if (minutes <= 0) return t('calendar.reminders.atStart');
  if (minutes % 1440 === 0) return t('calendar.reminders.days', { days: minutes / 1440 }, minutes / 1440);
  return formatDuration(minutes);
}

/** A lead list as words, in the given order (`30 min, 10 min`). */
export const formatLeads = (minutes: readonly number[]): string => minutes.map(formatLead).join(', ');

/** One reminder to ring. */
export interface PlannedReminder {
  /** Unique per event occurrence and lead: `<id>@<date>T<time>-<lead>`. */
  key: string;
  /** The occurrence alone (`<id>@<date>T<time>`): leads of one event share it. */
  occurrence: string;
  /** Epoch ms at which it rings (minute precision). */
  at: number;
  /** Epoch ms at which the event starts. */
  startAt: number;
  /** Epoch ms at which the event ends (the native notification stays until then). */
  endAt: number;
  /** Minutes before the start. */
  lead: number;
  /** The item's title as shown (an untitled list gets its placeholder). */
  itemTitle: string;
  /** Which kind of item reminds (the notifications pick their icon by it). */
  kind: 'event' | 'tasklist';
  /**
   * Notification text: the item's times, "11:00 – 11:30", never "in 30 min" (a notification may be read much later).
   * Prefixed with the day when the item is not on the day the reminder rings: "Tue 13 Oct, 11:00 – 11:30".
   */
  body: string;
}

/** The wording of a reminder for an event starting in `minutes` ("Dentist starts in 30 min"; `starts now` at 0). */
export const reminderText = (title: string, minutes: number): string =>
  minutes <= 0 ? t('calendar.warning.startsNow', { title }) : t('calendar.warning.startsIn', { title, duration: formatLead(minutes) });

/** A date as the notification texts show it: "Tue 13 Oct". */
const dayLabel = (date: string): string => formatDate(parseIsoDate(date)!, 'weekdayDayMonth');

/** The epoch ms of a wall-clock date and time in the calendar zone (DST safe). */
const instant = (date: string, time: string, tz: string): number => Date.parse(localToIso(date, time, tz));

/** The calendar-zone date of an instant. */
const zonedDate = (ms: number, tz: string): string => fromWallMinutes(Math.floor(ms / 60_000) + offsetMinutes(ms, tz)).date;

/** The wall-clock end of an item: on its last segment, which may lie beyond the planned days; `24:00` is 00:00 of the next day. */
function itemEnd(s: Segment): { date: string; time: string } {
  const last = s.last ? s : itemSegments(s.item).find((x) => x.last) ?? s;
  if (last.endTime === '24:00') return { date: toIsoDate(addDays(parseIsoDate(last.date)!, 1)), time: '00:00' };
  return { date: last.date, time: last.endTime ?? s.startTime ?? '' };
}

/**
 * The times of an item as its notification gives them, Google-Calendar-like: "11:00 – 11:30"; an end at the midnight
 * after the start day is "00:00"; any later end names its day ("22:00 – Tue 13 Oct, 01:00", "22:00 – Wed 14 Oct, 00:00").
 *
 * @param s The item's first segment.
 * @param end The item's end, from {@link itemEnd}.
 */
function itemTimes(s: Segment, end: { date: string; time: string }): string {
  const sameEvening = end.date === s.date || (end.time === '00:00' && end.date === toIsoDate(addDays(parseIsoDate(s.date)!, 1)));
  const endText = sameEvening ? end.time : t('calendar.reminders.notification.dayTime', { day: dayLabel(end.date), time: end.time });
  return t('calendar.reminders.notification.times', { start: s.startTime ?? '', end: endText });
}

/** Which kinds of items remind (`events`: lock screen choice for the native plan; `tasklists`: the Reminders switch). */
export interface PlanKinds { events: boolean; tasklists: boolean }

/**
 * Every reminder of the timed items on the given days whose event has not started yet, soonest first. The ones with `at`
 * at or before now are due (their snackbar shows); the later ones are still ahead (scheduled natively). Instants come
 * from the wall-clock times in the calendar zone, so a reminder across a clock change rings at the right moment.
 *
 * @param days Segments per day, today first, consecutive days (hidden calendars already filtered out).
 * @param nowMs Now, epoch ms.
 * @param kinds Which kinds of items remind.
 * @param untitled Placeholder for an untitled list.
 * @param tz The calendar time zone (IANA name).
 */
export function reminderPlan(days: Segment[][], nowMs: number, kinds: PlanKinds, untitled: string, tz: string): PlannedReminder[] {
  const minuteStart = nowMs - (nowMs % 60_000);
  const out: PlannedReminder[] = [];
  for (const segs of days) {
    for (const s of segs) {
      if (s.allDay || !s.first || s.startTime === null || s.carriedFrom) continue;
      if (s.item.kind === 'event' ? !kinds.events : !kinds.tasklists) continue;
      // an event carries exact instants (its offsets settle the repeated hour of a clock change); a task list only has a
      // wall-clock date and time, so its instants are rebuilt in the calendar zone
      const exact = s.item.kind === 'event' ? s.item : null;
      const startAt = exact ? Date.parse(exact.start) : instant(s.date, s.startTime, tz);
      if (startAt <= minuteStart) continue;
      const itemTitle = s.item.title.trim() || untitled;
      const occurrence = `${s.item.id}@${s.date}T${s.startTime}`;
      const end = itemEnd(s);
      const endAt = Math.max(startAt, exact ? Date.parse(exact.end) : instant(end.date, end.time, tz));
      const times = itemTimes(s, end);
      for (const lead of new Set(s.item.reminders?.minutes ?? [])) {
        const at = startAt - lead * 60_000;
        // the day goes first when the reminder rings on another day than the item (a day lead, or just before midnight)
        const body = zonedDate(at, tz) === s.date ? times : t('calendar.reminders.notification.dayTime', { day: dayLabel(s.date), time: times });
        out.push({ key: `${occurrence}-${lead}`, occurrence, at, startAt, endAt, lead, itemTitle, kind: s.item.kind, body });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/** The Web Push plan covers this many days ahead (feature reminders). */
export const PUSH_PLAN_DAYS = 7;

/** One push the server sends at `at` (epoch ms); `key` is `reminder:<itemId>@<date>T<start>-<lead>`; `kind` picks its icon. */
export interface PushPlanEntry { at: number; title: string; body: string; key: string; kind: PlannedReminder['kind'] }

/**
 * The reminders the server pushes while the app is closed: the ones still ahead within the next 7 days, titled with the
 * item and saying its times like the native reminders, with the native reminder id as key.
 *
 * @param plan The output of {@link reminderPlan}.
 * @param nowMs Now, epoch ms.
 */
export function pushPlan(plan: readonly PlannedReminder[], nowMs: number): PushPlanEntry[] {
  const minuteStart = nowMs - (nowMs % 60_000);
  const until = nowMs + PUSH_PLAN_DAYS * 86_400_000;
  return plan.filter((p) => p.at > minuteStart && p.at <= until).map((p) => ({ at: p.at, title: p.itemTitle, body: p.body, key: `reminder:${p.key}`, kind: p.kind }));
}
