/**
 * The "only one's own events are editable" rule (ARCHITECTURE "Only one's own events are editable"): which calendars count
 * as the person's own, and why an event is look-only. One place, used by the API mapping, the write checks and the picker.
 */
import type { GoogleEvent, ProviderCalendar } from '../providers/CalendarProvider.js';

/** Why an event is look-only: an invitation from `by`, or an event in the calendar of (or named) `by`. */
export interface ReadOnlyReason { kind: 'invitation' | 'calendar'; by: string }

/** Google's own calendar domains (groups, resources, holidays, imports): an id there is never a person's address. */
const GOOGLE_CALENDAR_DOMAIN = /@(?:[a-z0-9-]+\.)*calendar\.google\.com$/i;

/** True when a calendar id is a person's email address (the primary calendar of someone who shared it). */
export function isPersonAddress(id: string): boolean {
  return /^[^@\s]+@[^@\s]+$/.test(id) && !GOOGLE_CALENDAR_DOMAIN.test(id);
}

/** True when the role lets the person write at all (Google `owner` or `writer`). */
export const hasWriteRole = (c: ProviderCalendar | undefined): boolean => c?.accessRole === 'owner' || c?.accessRole === 'writer';

/**
 * True for the person's own calendars: the primary calendar, or a calendar they own (role `owner`) that is not another
 * person's. "Another person's" is decided by `owner` (Google `dataOwner`, or the primary calendar's address) when known,
 * else by the calendar id being a person's address. A known owner that cannot be compared with the person (no primary
 * address) is not own: the rule fails closed. Calendars shared by others stay look-only even with write rights.
 */
export function isOwnCalendar(c: ProviderCalendar | undefined, all: ProviderCalendar[]): boolean {
  if (!c || !hasWriteRole(c)) return false;
  if (c.primary) return true;
  if (c.accessRole !== 'owner') return false;
  const me = all.find((x) => x.primary)?.owner?.toLowerCase();
  if (c.owner) return !!me && c.owner.toLowerCase() === me;
  return !isPersonAddress(c.id) || c.id.toLowerCase() === me;
}

/** Who a non-own calendar belongs to, for the "Calendar of ..." line: its owner, else its address, else its name. */
function calendarOwnerLabel(c: ProviderCalendar | undefined, calendarId: string): string {
  return c?.owner ?? (isPersonAddress(calendarId) ? calendarId : c?.summary ?? calendarId);
}

/**
 * Why an ordinary event cannot be edited, or `null` when it can: it is in a calendar that is not the person's own, or the
 * person does not organise it (and the organiser did not allow guests to edit). An unknown calendar gives no reason.
 */
export function readOnlyReason(ev: GoogleEvent, all: ProviderCalendar[]): ReadOnlyReason | null {
  const cal = all.find((c) => c.id === ev.calendarId);
  if (!cal) return null;
  if (!isOwnCalendar(cal, all)) return { kind: 'calendar', by: calendarOwnerLabel(cal, ev.calendarId) };
  const org = ev.organizer;
  if (!org || org.self || ev.guestsCanModify) return null;
  return { kind: 'invitation', by: org.displayName || org.email || '' };
}
