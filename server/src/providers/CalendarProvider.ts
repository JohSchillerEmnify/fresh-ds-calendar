import type { CalendarColor } from '@calendar/shared/colors';

/** One Google reminder: `popup` ones are shown and edited by the app, every other method (`email`) is only carried along. */
export interface GoogleReminder { method: string; minutes: number }
interface GoogleEventDateTime { date?: string; dateTime?: string; timeZone?: string }
export interface GoogleEvent {
  id: string; calendarId: string; etag: string; status: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string; description?: string; location?: string; colorId?: string;
  start: GoogleEventDateTime; end: GoogleEventDateTime;
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
  created: string; updated: string; iCalUID?: string; sequence?: number;
  /** RRULE lines of a recurring master (Google). Optional extension used for recurring task lists. */
  recurrence?: string[];
  /** Set on instances/exceptions of a recurring event. */
  recurringEventId?: string;
  /** Google `originalStartTime` of an instance/exception: its start by the series' rule (stays when the instance is moved). */
  originalStartTime?: GoogleEventDateTime;
  /** Google `eventType` (`default`, `birthday`, ...); written only when a birthday is created. */
  eventType?: string;
  /** Google `visibility` / `transparency`; written only when a birthday is created (`private` / `transparent`). */
  visibility?: string;
  transparency?: string;
  /** Google `birthdayProperties` of a birthday event: `type` is birthday / anniversary / custom / other / self; a create sends only `{ type: 'birthday' }`. */
  birthdayProperties?: { type?: string; customTypeName?: string; contact?: string };
  /** Google `reminders`: `useDefault` means the calendar's `defaultReminders`, else `overrides` (absent = none). */
  reminders?: { useDefault: boolean; overrides?: GoogleReminder[] };
  /** Google `organizer`: `self` is true when the organiser is the calendar the event is read from; absent = created in that calendar. */
  organizer?: { email?: string; displayName?: string; self?: boolean };
  /** Google `guestsCanModify`: the organiser lets other guests edit the event. */
  guestsCanModify?: boolean;
}
export type GoogleEventInput = Omit<GoogleEvent, 'id' | 'calendarId' | 'etag' | 'created' | 'updated' | 'status'>
  & { status?: GoogleEvent['status'] };

/**
 * Patch (Google patch semantics): `null` removes a field / extended property.
 * Widened from `Partial<GoogleEventInput>` so deletions can be expressed (documented deviation).
 */
export type GoogleEventPatch = Partial<Omit<GoogleEventInput, 'extendedProperties' | 'colorId'>> & {
  colorId?: string | null;
  extendedProperties?: { private?: Record<string, string | null>; shared?: Record<string, string | null> };
};

export interface ProviderCalendar {
  id: string; summary: string; backgroundColor: string; primary: boolean;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  /** The palette id of the colour, when Google has one for it (`calendarList` entry `colorId`). */
  colorId?: string;
  /** Switched off in Google's own calendar list (`calendarList` entry `hidden`). */
  hidden?: boolean;
  /**
   * Email of the calendar's owner: the person's own address on their primary calendar, Google's `dataOwner` on a secondary
   * one (`dataOwner` is only set for secondary calendars). Absent where Google gives none (mock default, some resources).
   */
  owner?: string;
  /** Google's `defaultReminders` of the calendar list entry (what events with `reminders.useDefault` use). */
  defaultReminders?: GoogleReminder[];
}

export interface ListEventsParams {
  calendarId: string;
  /** Absent bounds mean no bound (the undated task lists are read by their property alone). */
  timeMin?: string;
  timeMax?: string;
  /** `key=value` filters, all of which must match. */
  privateExtendedProperty?: string[];
  showDeleted?: boolean;
  /**
   * Google `singleEvents` (default true: repeating events come as their instances). `false` lists each series once (its
   * master) and its exceptions as events of their own, unexpanded; how the exceptions of a series are found.
   */
  singleEvents?: boolean;
}
export interface ListEventsResult { items: GoogleEvent[]; nextSyncToken?: string }

export interface WriteOptions { ifMatch?: string }

export interface CalendarProvider {
  readonly name: 'mock' | 'google';
  ping(): Promise<void>;
  /** Every calendar list entry, including hidden ones (`hidden` set). */
  listCalendars(): Promise<ProviderCalendar[]>;
  /** Creates a secondary calendar owned by the person (`calendars.insert`). */
  insertCalendar(summary: string): Promise<ProviderCalendar>;
  /** Switches a calendar list entry off or on in Google's list (`calendarList.patch` `hidden`). */
  setCalendarHidden(calendarId: string, hidden: boolean): Promise<void>;
  /** Replaces a calendar list entry's `defaultReminders` (`calendarList.patch`). */
  setCalendarDefaultReminders(calendarId: string, reminders: GoogleReminder[]): Promise<void>;
  /** Sets the person's colour of a calendar list entry (`calendarList.patch`): a palette `colorId`, or RGB with `colorRgbFormat`. */
  setCalendarColor(calendarId: string, color: { colorId: string } | { backgroundColor: string; foregroundColor: string }): Promise<void>;
  /** Google's calendar colour palette (`colors.get`, the `calendar` map). */
  calendarColors(): Promise<CalendarColor[]>;
  listEvents(p: ListEventsParams): Promise<ListEventsResult>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
  insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent>;
  patchEvent(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): Promise<GoogleEvent>;
  deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void>;
  moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent>;
  /**
   * What changed in a calendar since `syncToken` (a `nextSyncToken` of a list read with `singleEvents: false`): every page,
   * unexpanded series and their exceptions, cancelled entries included. Throws {@link SyncTokenExpiredError} when the token
   * is no longer usable (Google 410): the caller lists the calendar in full again.
   */
  listChanges(calendarId: string, syncToken: string): Promise<ListEventsResult>;
  /**
   * A fresh sync token for a calendar, taken by walking every page of an unfiltered read (`singleEvents: false`,
   * `showDeleted: true`) and keeping no items. Throws {@link SyncTokenTooLargeError} when the calendar is too large to walk.
   */
  listSyncToken(calendarId: string): Promise<string | undefined>;
  /** The instances of one repeating event (`events.instances`) in `[timeMin, timeMax)`, exceptions applied, cancelled ones left out. */
  listInstances(calendarId: string, seriesId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]>;
  /** Milliseconds left of a rate-limit cooldown (no Google calls are made meanwhile); 0 or absent when not cooling down. */
  cooldownMs?(): number;
}

export class ProviderUnavailableError extends Error {}
/** Google's per-person rate limit is in force: no call was made (or it was refused); try again after `retryAfterSec`. */
export class RateLimitedError extends ProviderUnavailableError {
  constructor(readonly retryAfterSec: number) {
    super('Google rate limit: cooling down');
  }
}
/** Google answered 403 for a permission reason (not a rate limit, not a missing scope): the person may not do this on that calendar. */
export class ProviderForbiddenError extends ProviderUnavailableError {}
/** Google no longer accepts the person's refresh token (invalid_grant): they must sign in again. */
export class ReauthRequiredError extends Error {}
/** Google refuses calendar calls because the person did not grant the calendar scope at sign-in. */
export class CalendarPermissionMissingError extends Error {}
/** A sync token was refused (Google 410 Gone): drop what was kept for that calendar and list it again without a token. */
export class SyncTokenExpiredError extends Error {}
export class ProviderError extends Error {}
/** A calendar has too many events to walk for a sync token; the caller backs off before trying again. */
export class SyncTokenTooLargeError extends ProviderError {}
export class NotFoundError extends Error {}
export class PreconditionFailedError extends Error {}
