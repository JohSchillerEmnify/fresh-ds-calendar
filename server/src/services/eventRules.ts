import type { CalendarEvent, UpdateEventInput } from '../api/types.js';
import type { GoogleEvent } from '../providers/CalendarProvider.js';

/** Calendar id prefix of Google's contacts "Birthdays" calendar (`addressbook#contacts@group.v.calendar.google.com`). */
const BIRTHDAY_CALENDAR_PREFIX = 'addressbook#contacts@';

/** Birthday kind of a Google event: by `eventType`, or by living in the contacts Birthdays calendar; `undefined` for ordinary events. */
export function specialOf(ev: GoogleEvent): CalendarEvent['special'] {
  if (ev.eventType !== 'birthday' && !ev.calendarId.startsWith(BIRTHDAY_CALENDAR_PREFIX)) return undefined;
  return ev.birthdayProperties?.type === 'anniversary' ? 'anniversary' : 'birthday';
}

/** Id of the app's virtual Birthdays calendar (ADR 0038): every birthday event, whichever calendar holds it. */
export const BIRTHDAYS_ID = 'birthdays';
/** Colour of the virtual Birthdays calendar until the person picks one (the colour of Google's contacts calendar). */
export const BIRTHDAYS_COLOR = '#9fc6e7';

/** True for Google's old contacts "Birthdays" calendar, which the app folds into {@link BIRTHDAYS_ID}. */
export const isContactsCalendarId = (id: string) => id.startsWith(BIRTHDAY_CALENDAR_PREFIX);

/** An event of Google's contacts "Birthdays" calendar: made from contacts, never edited here. */
export const inContactsCalendar = (ev: GoogleEvent) => ev.calendarId.startsWith(BIRTHDAY_CALENDAR_PREFIX);

/** True when an update changes nothing but the reminders. */
export const onlyReminders = (input: UpdateEventInput): boolean => {
  const keys = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  return keys.length === 1 && keys[0] === 'reminders';
};
/** True when two etags name the same version (weak marker and quotes ignored). */
export const etagEq = (a: string, b: string) => a.replace(/^W\//, '').replaceAll('"', '') === b.replace(/^W\//, '').replaceAll('"', '');
