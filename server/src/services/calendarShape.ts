/** Anonymised diagnostic of where a person's birthdays live (event `calendar_shape`, issue 59); no names, ids or titles. */
import { calHash, logEvent, subHash } from '../lib/diag.js';
import type { CalendarProvider, GoogleEvent, ProviderCalendar } from '../providers/CalendarProvider.js';
import { isContactsCalendarId } from './eventRules.js';

/** The day each person's shape was last logged: one line per person and day. */
const loggedOn = new Map<string, string>();

/** Forgets what was logged, so the next read logs again (tests). */
export function forgetCalendarShape(): void {
  loggedOn.clear();
}

/** Counts of the birthday events of one calendar, by type, plus the two shapes that Google may drop from a view. */
function summarise(events: GoogleEvent[]) {
  const byType: Record<string, number> = {};
  let before1900 = 0;
  let noRecurrence = 0;
  for (const e of events) {
    const type = e.birthdayProperties?.type ?? 'none';
    byType[type] = (byType[type] ?? 0) + 1;
    if (Number.parseInt((e.start.date ?? e.start.dateTime ?? '').slice(0, 4), 10) < 1900) before1900++;
    if (!e.recurrence?.length) noRecurrence++;
  }
  return { birthdays: events.length, byType, before1900, noRecurrence };
}

/** Logs the shape of every calendar of `sub` once per `day`; a failing read is logged as `error` and never thrown. */
export async function logCalendarShape(
  provider: CalendarProvider, sub: string, day: string, cals: ProviderCalendar[], selected: (id: string) => boolean,
): Promise<void> {
  if (loggedOn.get(sub) === day) return;
  loggedOn.set(sub, day);
  const shapes = [];
  for (const c of cals) {
    const contacts = isContactsCalendarId(c.id);
    const head = { calHash: calHash(c.id), primary: !!c.primary, hidden: !!c.hidden, selected: selected(c.id), accessRole: c.accessRole, isContactsCalendar: contacts };
    try {
      const r = await provider.listEvents({ calendarId: c.id, singleEvents: false, ...(contacts ? {} : { eventTypes: ['birthday'] }) });
      shapes.push({ ...head, ...summarise(r.items.filter((e) => e.status !== 'cancelled' && !e.recurringEventId)) });
    } catch {
      shapes.push({ ...head, error: true });
    }
  }
  logEvent('calendar_shape', { sub: subHash(sub), calendars: JSON.stringify(shapes) });
}
