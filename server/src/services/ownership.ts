/**
 * The "who may edit what" rule (feature events-readonly): editing follows Google's permissions (a calendar is editable when
 * the person has a write role there), and why an event is look-only. One place, used by the API mapping and the write checks.
 */
import type { GoogleEvent, ProviderCalendar } from '../providers/CalendarProvider.js';

/** Why an event is look-only: an invitation from `by`, or an event in the calendar of (or named) `by`. */
export interface ReadOnlyReason { kind: 'invitation' | 'calendar'; by: string }

/** Google's own calendar domains (groups, resources, holidays, imports): an id there is never a person's address. */
const GOOGLE_CALENDAR_DOMAIN = /@(?:[a-z0-9-]+\.)*calendar\.google\.com$/i;

/** True when a calendar id is a person's email address (the primary calendar of someone who shared it). */
function isPersonAddress(id: string): boolean {
  return /^[^@\s]+@[^@\s]+$/.test(id) && !GOOGLE_CALENDAR_DOMAIN.test(id);
}

/** True when Google lets the person write in the calendar (role `owner` or `writer`): editing follows Google. */
export const hasWriteRole = (c: ProviderCalendar | undefined): boolean => c?.accessRole === 'owner' || c?.accessRole === 'writer';

/** Who a look-only calendar belongs to, for the "Calendar of ..." line: its owner, else its address, else its name. */
function calendarOwnerLabel(c: ProviderCalendar | undefined, calendarId: string): string {
  return c?.owner ?? (isPersonAddress(calendarId) ? calendarId : c?.summary ?? calendarId);
}

/**
 * Why an ordinary event cannot be edited, or `null` when it can: the person may not write in its calendar, or the
 * person does not organise it (and the organiser did not allow guests to edit). An unknown calendar gives no reason.
 */
export function readOnlyReason(ev: GoogleEvent, all: ProviderCalendar[]): ReadOnlyReason | null {
  const cal = all.find((c) => c.id === ev.calendarId);
  if (!cal) return null;
  if (!hasWriteRole(cal)) return { kind: 'calendar', by: calendarOwnerLabel(cal, ev.calendarId) };
  const org = ev.organizer;
  // An organiser equal to the calendar is the calendar's own event (group calendars), not an invitation.
  if (!org || org.self || org.email?.toLowerCase() === ev.calendarId.toLowerCase() || ev.guestsCanModify) return null;
  return { kind: 'invitation', by: org.displayName || org.email || '' };
}
