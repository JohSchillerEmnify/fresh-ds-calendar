import { forbidden, preconditionFailed, validation } from '../lib/errors.js';
import { addDays, dayNumber, formatInZone, isDateTime, isLocalDate } from '../lib/time.js';
import type { CalendarEvent, CreateBirthdayInput, CreateEventInput, Reminders, UpdateEventInput } from '../api/types.js';
import type {
  CalendarProvider, GoogleEvent, GoogleEventInput, GoogleEventPatch, GoogleReminder, ProviderCalendar,
} from '../providers/CalendarProvider.js';
import { birthdayCreateBody, birthdayPatch } from './birthday.js';
import { etagEq, inContactsCalendar, onlyReminders, specialOf } from './eventRules.js';
import type { MotivationService } from './motivation.js';
import { hasWriteRole, readOnlyReason } from './ownership.js';
import { placeLeads, placeOf, placeProps } from './place.js';
import type { PrefsStore } from './prefsStore.js';

const DAY = 86_400_000;
const readOnlyBirthday = () => validation('Birthdays are read-only');

/** What event writes need from {@link CalendarService}: the calendar list, ownership checks and the Google-to-API mapping. */
export interface EventHost {
  calendarColor(id: string): Promise<string>;
  eventCalendars(): Promise<ProviderCalendar[]>;
  locateKind(id: string, tasklist: boolean): Promise<GoogleEvent>;
  mapOne(ev: GoogleEvent): Promise<unknown>;
  norm(dt: { date?: string; dateTime?: string }): string;
  primaryId(): Promise<string>;
  providerCalendars(): Promise<ProviderCalendar[]>;
  remindersOf(input: Reminders, cur?: GoogleEvent['reminders']): NonNullable<GoogleEvent['reminders']>;
  requireCalendar(id: string): Promise<void>;
  requireOwnCalendar(id: string): Promise<void>;
  requireOwnEvent(ev: GoogleEvent): Promise<void>;
  toEvent(ev: GoogleEvent, calColor: string, calDefaults?: GoogleReminder[]): CalendarEvent;
  rawInsert(): ((calendarId: string, ev: GoogleEventInput & { id: string }) => Promise<GoogleEvent>) | undefined;
}

/** Create, update and delete of events, including the birthday and read-only reminder rules. */
export class EventWrites {
  constructor(
    private readonly provider: CalendarProvider, private readonly motivation: MotivationService, private readonly prefs: PrefsStore,
    private readonly sub: string, private readonly tz: string, private readonly host: EventHost,
  ) {}

  private checkEventShape(m: { allDay: boolean; start: string; end: string }): void {
    if (m.allDay) {
      if (!isLocalDate(m.start)) throw validation('Start must be a date (YYYY-MM-DD) for all-day events', 'start');
      if (!isLocalDate(m.end)) throw validation('End must be a date (YYYY-MM-DD) for all-day events', 'end');
      if (m.end <= m.start) throw validation('End must be after start', 'end', 'errors.validation.endAfterStart');
      if (dayNumber(m.end) - dayNumber(m.start) > 366) throw validation('Event must be at most 366 days long', 'end', 'errors.validation.eventTooLong');
    } else {
      if (!isDateTime(m.start)) throw validation('Start must be a date and time with offset', 'start');
      if (!isDateTime(m.end)) throw validation('End must be a date and time with offset', 'end');
      const s = Date.parse(m.start), e = Date.parse(m.end);
      if (e <= s) throw validation('End must be after start', 'end', 'errors.validation.endAfterStart');
      if (e - s > 366 * DAY) throw validation('Event must be at most 366 days long', 'end', 'errors.validation.eventTooLong');
    }
  }

  private gTimes(m: { allDay: boolean; start: string; end: string }) {
    if (m.allDay) return { start: { date: m.start }, end: { date: m.end } };
    return {
      start: { dateTime: formatInZone(Date.parse(m.start), this.tz), timeZone: this.tz },
      end: { dateTime: formatInZone(Date.parse(m.end), this.tz), timeZone: this.tz },
    };
  }

  async createEvent(input: CreateEventInput, extra?: { id?: string }): Promise<CalendarEvent> {
    const calendarId = input.calendarId ?? (await this.host.primaryId());
    await this.host.requireCalendar(calendarId);
    await this.host.requireOwnCalendar(calendarId);
    this.checkEventShape(input);
    const g: GoogleEventInput = { summary: input.title, ...this.gTimes(input) };
    if (input.description) g.description = input.description;
    if (input.location) g.location = input.location;
    if (input.place && placeLeads(input.location ?? '', input.place.name)) g.extendedProperties = { private: placeProps(input.place) as Record<string, string> };
    if (input.colorId) g.colorId = input.colorId;
    if (input.reminders && !input.reminders.useDefault) g.reminders = this.host.remindersOf(input.reminders);
    const ev = extra?.id && this.host.rawInsert() ? await this.host.rawInsert()!(calendarId, { ...g, id: extra.id }) : await this.provider.insertEvent(calendarId, g);
    this.motivation.award(this.sub, 'create');
    return this.host.toEvent(ev, await this.host.calendarColor(calendarId));
  }

  /** A yearly birthday in the primary calendar, with exactly the fields Google accepts (`birthdayCreateBody`). */
  async createBirthday(input: CreateBirthdayInput): Promise<CalendarEvent> {
    const calendarId = await this.host.primaryId();
    const cal = (await this.host.eventCalendars()).find((c) => c.id === calendarId);
    if (cal && !hasWriteRole(cal)) throw forbidden('The primary calendar is read-only', 'calendar.birthday.readOnly');
    const ev = await this.provider.insertEvent(calendarId, birthdayCreateBody(input.title, input.date, input.colorId));
    this.motivation.award(this.sub, 'create');
    return this.host.toEvent(ev, await this.host.calendarColor(calendarId));
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    return (await this.host.mapOne(await this.host.locateKind(id, false))) as CalendarEvent;
  }

  async updateEvent(id: string, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> {
    const cur = await this.host.locateKind(id, false);
    if (specialOf(cur)) return this.updateBirthday(cur, input, ifMatch);
    const reason = onlyReminders(input) ? readOnlyReason(cur, await this.host.providerCalendars()) : null;
    if (reason) return this.updateReadOnlyReminders(cur, input.reminders!, reason.kind === 'calendar');
    await this.host.requireOwnEvent(cur);
    const curApi = this.host.toEvent(cur, '');
    const m = {
      title: input.title ?? curApi.title,
      description: input.description ?? curApi.description,
      location: input.location ?? curApi.location,
      allDay: input.allDay ?? curApi.allDay,
      start: input.start ?? curApi.start,
      end: input.end ?? curApi.end,
      colorId: input.colorId === undefined ? curApi.colorId : input.colorId,
      calendarId: input.calendarId ?? cur.calendarId,
    };
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    if (m.calendarId !== cur.calendarId) { await this.host.requireCalendar(m.calendarId); await this.host.requireOwnCalendar(m.calendarId); }
    this.checkEventShape(m);
    const patch: GoogleEventPatch = {
      summary: m.title, description: m.description || null as unknown as string, location: m.location || null as unknown as string,
      colorId: m.colorId, ...this.gTimes(m),
    };
    if (input.reminders) patch.reminders = this.host.remindersOf(input.reminders, cur.reminders);
    // the place is kept only while it still leads the location; a changed location without one clears stale properties
    if (input.place !== undefined || input.location !== undefined) {
      const place = input.place === undefined ? placeOf(cur) ?? null : input.place;
      patch.extendedProperties = { private: placeProps(place && placeLeads(m.location, place.name) ? place : null) };
    }
    let ev = await this.provider.patchEvent(cur.calendarId, id, patch, { ifMatch: ifMatch ?? cur.etag });
    if (m.calendarId !== cur.calendarId) ev = await this.provider.moveEvent(cur.calendarId, id, m.calendarId);
    return this.host.toEvent(ev, await this.host.calendarColor(ev.calendarId));
  }

  /**
   * The person's reminders for an event they can only read (feature reminders). In a calendar shared read-only Google has no
   * per-event reminders (its UI only offers notifications for the whole calendar), so the app keeps them itself and Google is
   * never asked. An invitation in the person's own calendar is different: Google stores its `reminders` (per person), so only
   * that field is sent.
   */
  private async updateReadOnlyReminders(cur: GoogleEvent, input: Reminders, sharedCalendar: boolean): Promise<CalendarEvent> {
    const color = await this.host.calendarColor(cur.calendarId);
    if (!sharedCalendar) return this.host.toEvent(await this.provider.patchEvent(cur.calendarId, cur.id, { reminders: this.host.remindersOf(input, cur.reminders) }), color);
    this.prefs.reminderOverrides.set(this.sub, cur.calendarId, cur.id, { useDefault: input.useDefault, minutes: input.useDefault ? [] : input.minutes });
    return this.host.toEvent(cur, color);
  }

  async deleteEvent(id: string, ifMatch?: string): Promise<void> {
    const cur = await this.host.locateKind(id, false);
    if (specialOf(cur)) {
      await this.requireEditableBirthday(cur);
      if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
      // the whole yearly birthday goes, not one year of it (Google leaves Contacts alone)
      await this.provider.deleteEvent(cur.calendarId, cur.recurringEventId ?? id);
      return;
    }
    await this.host.requireOwnEvent(cur);
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    await this.provider.deleteEvent(cur.calendarId, id, ifMatch ? { ifMatch } : undefined);
  }

  /** Birthdays of the contacts calendar and of calendars the person cannot write stay read-only. */
  private async requireEditableBirthday(cur: GoogleEvent): Promise<void> {
    const cal = (await this.host.providerCalendars()).find((c) => c.id === cur.calendarId);
    if (inContactsCalendar(cur) || !hasWriteRole(cal)) throw readOnlyBirthday();
  }

  /** Start and end of the opened instance after the series moved to the month and day of `masterDate`. */
  private movedInstance(cur: GoogleEvent, masterDate: string): Pick<GoogleEvent, 'start' | 'end'> {
    const date = `${(cur.start.date ?? this.host.norm(cur.start)).slice(0, 4)}-${masterDate.slice(5)}`;
    return { start: { date }, end: { date: addDays(date, 1) } };
  }

  /**
   * Edits a birthday: the series (`recurringEventId` of the instance the person opened) is patched, never one year, and only
   * with the fields Google allows on a birthday. The answer is the opened instance with the change applied.
   */
  private async updateBirthday(cur: GoogleEvent, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> {
    await this.requireEditableBirthday(cur);
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    const master = cur.recurringEventId ? await this.provider.getEvent(cur.calendarId, cur.recurringEventId) : cur;
    const patch = birthdayPatch(master, cur.start.date ?? this.host.norm(cur.start), input);
    const color = await this.host.calendarColor(cur.calendarId);
    if (Object.keys(patch).length === 0) return this.host.toEvent(cur, color);
    const ev = await this.provider.patchEvent(cur.calendarId, master.id, patch, { ifMatch: master.etag });
    // show the instance that was opened: its id and day, with the new name, colour and (when moved) day
    const shown: GoogleEvent = { ...ev, id: cur.id, recurringEventId: cur.recurringEventId, ...(patch.start ? this.movedInstance(cur, patch.start.date!) : {}) };
    return this.host.toEvent(shown, color);
  }
}
