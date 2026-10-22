/**
 * The reminder plan: which reminders ring when, computed from the loaded items. One reminder per timed event (or timed task
 * list) and reminder lead, at start minus lead (feature reminders). Pure: the in-app snackbars and
 * the native notification scheduling (`transitionWarning.ts`) both read this list. Also the shared wording of a lead.
 */
import { itemSegments, type Segment } from '@/lib/items';
import { t } from '@/i18n';
import { formatDate, parseIsoDate } from '@/lib/dates';
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
  /** Minutes before the start. */
  lead: number;
  /** The item's title as shown (an untitled list gets its placeholder). */
  itemTitle: string;
  /** Which kind of item reminds (the notifications pick their icon by it). */
  kind: 'event' | 'tasklist';
  /** In-app snackbar text: "Dentist starts in 30 min" (shown live, gone at the start). */
  title: string;
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

/**
 * The times of an item as its notification gives them, Google-Calendar-like: "11:00 – 11:30"; an end on a later day names
 * that day ("22:00 – Tue 13 Oct, 01:00"); an end at midnight is "00:00".
 *
 * @param s The item's first segment.
 */
function itemTimes(s: Segment): string {
  // the end lies on the item's last segment, which may be beyond the planned days
  const last = s.last ? s : itemSegments(s.item).find((x) => x.last) ?? s;
  const endTime = last.endTime === '24:00' ? '00:00' : last.endTime ?? '';
  const end = last.date === s.date ? endTime : t('calendar.reminders.notification.dayTime', { day: dayLabel(last.date), time: endTime });
  return t('calendar.reminders.notification.times', { start: s.startTime ?? '', end });
}

/** Which kinds of items remind (`events`: lock screen choice for the native plan; `tasklists`: the Reminders switch). */
export interface PlanKinds { events: boolean; tasklists: boolean }

/**
 * Every reminder of the timed items on the given days whose event has not started yet, soonest first. The ones with `at`
 * at or before now are due (their snackbar shows); the later ones are still ahead (scheduled natively).
 *
 * @param days Segments per day, today first, consecutive days (hidden calendars already filtered out).
 * @param nowMs Now, epoch ms.
 * @param nowMin Minute of today (0-1439) on the app clock.
 * @param kinds Which kinds of items remind.
 * @param untitled Placeholder for an untitled list.
 */
export function reminderPlan(days: Segment[][], nowMs: number, nowMin: number, kinds: PlanKinds, untitled: string): PlannedReminder[] {
  const minuteStart = nowMs - (nowMs % 60_000);
  const out: PlannedReminder[] = [];
  days.forEach((segs, i) => {
    for (const s of segs) {
      if (s.allDay || !s.first || s.startTime === null || s.carriedFrom) continue;
      if (s.item.kind === 'event' ? !kinds.events : !kinds.tasklists) continue;
      const startIn = i * 1440 + s.startMin - nowMin;
      if (startIn <= 0) continue;
      const itemTitle = s.item.title.trim() || untitled;
      const occurrence = `${s.item.id}@${s.date}T${s.startTime}`;
      const times = itemTimes(s);
      for (const lead of new Set(s.item.reminders?.minutes ?? [])) {
        // the day goes first when the reminder rings on another day than the item (a day lead, or just before midnight)
        const ringsOnItsDay = Math.floor((i * 1440 + s.startMin - lead) / 1440) === i;
        out.push({
          key: `${occurrence}-${lead}`, occurrence, at: minuteStart + (startIn - lead) * 60_000, startAt: minuteStart + startIn * 60_000, lead,
          itemTitle, kind: s.item.kind, title: reminderText(itemTitle, lead),
          body: ringsOnItsDay ? times : t('calendar.reminders.notification.dayTime', { day: dayLabel(s.date), time: times }),
        });
      }
    }
  });
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
