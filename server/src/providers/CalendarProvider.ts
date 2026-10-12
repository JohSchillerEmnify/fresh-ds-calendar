export interface GoogleEventDateTime { date?: string; dateTime?: string; timeZone?: string }
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
}

export interface ListEventsParams {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  privateExtendedProperty?: string[];
  showDeleted?: boolean;
}
export interface ListEventsResult { items: GoogleEvent[]; nextSyncToken?: string }

export interface WriteOptions { ifMatch?: string }

export interface CalendarProvider {
  readonly name: 'mock' | 'google';
  ping(): Promise<void>;
  listCalendars(): Promise<ProviderCalendar[]>;
  listEvents(p: ListEventsParams): Promise<ListEventsResult>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
  insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent>;
  patchEvent(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): Promise<GoogleEvent>;
  deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void>;
  moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent>;
  listChanges?(calendarId: string, syncToken: string): Promise<ListEventsResult>;
}

export class ProviderUnavailableError extends Error {}
export class ProviderError extends Error {}
export class NotFoundError extends Error {}
export class PreconditionFailedError extends Error {}
