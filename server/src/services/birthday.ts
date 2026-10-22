/**
 * Google birthdays (`eventType: "birthday"`): the exact create body Google accepts and the patch it allows
 * (feature birthdays). Pure functions, no I/O.
 */
import { validation } from '../lib/errors.js';
import { addDays, isLocalDate } from '../lib/time.js';
import type { UpdateEventInput } from '../api/types.js';
import type { GoogleEvent, GoogleEventInput, GoogleEventPatch } from '../providers/CalendarProvider.js';

/** Yearly rule of a birthday; 29 February repeats on the last day of February in the years without one. */
export function birthdayRule(date: string): string {
  return date.slice(5) === '02-29' ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY';
}

/**
 * The `events.insert` body of a new birthday. Google rejects any other property on a birthday, so this is the whole
 * body: no description, location, extended properties or `birthdayProperties` contact.
 */
export function birthdayCreateBody(title: string, date: string, colorId?: string | null): GoogleEventInput {
  if (!isLocalDate(date)) throw validation('Date must be YYYY-MM-DD', 'date');
  return {
    eventType: 'birthday', summary: title, start: { date }, end: { date: addDays(date, 1) }, recurrence: [birthdayRule(date)],
    visibility: 'private', transparency: 'transparent', birthdayProperties: { type: 'birthday' },
    ...(colorId ? { colorId } : {}),
  };
}

/** True when the date of the birthday cannot change: it comes from a contact, or it is the person's own (`type: self`). */
export function birthdayDateLocked(ev: Pick<GoogleEvent, 'birthdayProperties'>): boolean {
  return !!ev.birthdayProperties?.contact || ev.birthdayProperties?.type === 'self';
}

/**
 * The `events.patch` body for a birthday edit: only `summary`, `colorId` and a one-day all-day `start`/`end`, the fields
 * Google allows. `shownDate` is the day the person edited (an instance of the yearly series); only the month and day of a new date count, the master keeps its year.
 * Returns an empty patch when nothing changes. Other fields in `input` are refused, never dropped silently.
 */
export function birthdayPatch(master: GoogleEvent, shownDate: string, input: UpdateEventInput): GoogleEventPatch {
  for (const k of ['description', 'location', 'reminders', 'calendarId'] as const) {
    if (input[k] !== undefined) throw validation(`A birthday has no ${k}`, k, 'calendar.birthday.field');
  }
  if (input.allDay === false) throw validation('A birthday is an all-day event', 'allDay', 'calendar.birthday.field');
  const patch: GoogleEventPatch = {};
  if (input.title !== undefined) patch.summary = input.title;
  if (input.colorId !== undefined) patch.colorId = input.colorId;
  if (input.start !== undefined || input.end !== undefined) {
    const start = input.start ?? shownDate;
    if (!isLocalDate(start)) throw validation('Date must be YYYY-MM-DD', 'start');
    if (input.end !== undefined && input.end !== addDays(start, 1)) throw validation('A birthday lasts one day', 'end', 'calendar.birthday.field');
    // only the day of the year can change: the series keeps its start year (the birth year)
    if (start.slice(5) !== shownDate.slice(5)) {
      if (birthdayDateLocked(master)) throw validation('The date of this birthday is set in Google Contacts', 'start', 'calendar.birthday.dateLocked');
      const masterDate = master.start.date!;
      // 29 February has its own yearly rule, which a patch cannot change: no move onto or off it
      if (start.slice(5) === '02-29' || masterDate.slice(5) === '02-29') {
        throw validation('A birthday cannot be moved to or from 29 February; delete it and create it again', 'start', 'calendar.birthday.leapDay');
      }
      const next = `${masterDate.slice(0, 4)}-${start.slice(5)}`;
      patch.start = { date: next };
      patch.end = { date: addDays(next, 1) };
    }
  }
  return patch;
}
