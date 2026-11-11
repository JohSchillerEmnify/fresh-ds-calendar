/** Contact dates as read-only Birthdays events (feature contact-birthdays, ADR 0043), derived per window from contacts held per person. */
import { birthdayContactKey, birthdayTitleKey, yearlyDate } from '@calendar/shared/birthdays';
import type { CalendarEvent } from '@calendar/shared/api';
import { addDays } from '../lib/time.js';
import { logEvent } from '../lib/diag.js';
import { SyncTokenExpiredError, type CalendarProvider, type ContactDate, type ContactsResult, type GoogleContact } from '../providers/CalendarProvider.js';
import { BIRTHDAYS_ID } from './eventRules.js';

/** The pseudo source calendar the contact dates are held under on the device and in the change feed cursor. */
export const CONTACTS_SOURCE = 'people';
/** A held copy is not read again within this time (every poll of every open device asks). */
const FRESH_MS = 60_000;
const NEVER = '1970-01-01T00:00:00+00:00';

/** Contacts of one person, kept up to date with the People API's sync token. */
export class ContactsSource {
  private token: string | undefined;
  private held = new Map<string, GoogleContact>();
  private at = -Infinity;
  private inflight: Promise<boolean> | null = null;

  constructor(private readonly provider: CalendarProvider, private readonly granted: () => boolean, private readonly nowMs: () => number) {}

  /** Reads the changes since the last read; false when Google could not answer (the held copy stays, nothing else fails). */
  refresh(): Promise<boolean> {
    if (!this.granted()) {
      this.token = undefined;
      this.held.clear();
      return Promise.resolve(true);
    }
    if (this.nowMs() - this.at < FRESH_MS) return Promise.resolve(true);
    this.inflight ??= this.read().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  /** The next refresh asks Google again, whatever was read a moment ago. */
  forgetFreshness(): void {
    this.at = -Infinity;
  }

  /** Whether the contact dates are readable at all (the person's token has the scope). */
  get enabled(): boolean {
    return this.granted();
  }

  /** A token read, or a full one when there is no token or Google expired it. */
  private async fetch(): Promise<{ res: ContactsResult; full: boolean }> {
    if (!this.token) return { res: await this.provider.listContacts(), full: true };
    try {
      return { res: await this.provider.listContacts(this.token), full: false };
    } catch (e) {
      if (!(e instanceof SyncTokenExpiredError)) throw e;
      return { res: await this.provider.listContacts(), full: true };
    }
  }

  private async read(): Promise<boolean> {
    try {
      const { res, full } = await this.fetch();
      if (full) this.held.clear();
      for (const c of res.items) this.keep(c);
      this.token = res.nextSyncToken;
      this.at = this.nowMs();
      return true;
    } catch (e) {
      // a missing scope, an outage or a rate limit: the other birthdays stay as they are, the next poll tries again
      logEvent('contacts_read_failed', { cause: e instanceof Error ? e.constructor.name : 'unknown' });
      return false;
    }
  }

  private keep(c: GoogleContact): void {
    if (c.deleted) this.held.delete(c.resourceName);
    else this.held.set(c.resourceName, c);
  }

  /** The contact dates falling in `[from, to)`, one event per year. */
  events(from: string, to: string, color: string): CalendarEvent[] {
    return contactEvents([...this.held.values()], from, to, color);
  }
}

interface Entry { kind: 'birthday' | 'anniversary' | 'other'; idKey: string; title: string; date: ContactDate }

/** The kind and title of a custom-typed entry: `anniversary`, `other` or none keep the name; a label prefixes it. */
function describe(type: string | undefined, name: string): { kind: Entry['kind']; title: string } {
  const t = type?.trim();
  if (t?.toLowerCase() === 'anniversary') return { kind: 'anniversary', title: name };
  return { kind: 'other', title: !t || t.toLowerCase() === 'other' ? name : `${t}: ${name}` };
}

/** Every dated entry of a contact with its kind and title; a contact without a display name has none. */
function entriesOf(c: GoogleContact): Entry[] {
  const name = c.name?.trim();
  if (!name) return [];
  const out: Entry[] = c.birthday ? [{ kind: 'birthday', idKey: 'b', title: name, date: c.birthday }] : [];
  c.dates.forEach((d, i) => out.push({ ...describe(d.type, name), idKey: `e${i}`, date: d.date }));
  return out;
}

/** One occurrence of a contact's entry as a read-only event. */
function eventOf(c: GoogleContact, e: Entry, date: string, color: string): CalendarEvent {
  const special = e.kind === 'other' ? undefined : e.kind;
  return {
    kind: 'event', id: `contact:${c.resourceName}:${e.idKey}:${date}`, calendarId: BIRTHDAYS_ID, title: e.title, description: '', location: '',
    allDay: true, start: date, end: addDays(date, 1), colorId: null, color,
    ...(special ? { special, dupKey: birthdayContactKey(c.resourceName, special, date), dupAlt: birthdayTitleKey(e.title, date) } : {}),
    sourceCalendarId: CONTACTS_SOURCE, readOnly: true, readOnlyReason: { kind: 'contact' },
    contactBirthday: { resourceName: c.resourceName, ...(e.kind === 'birthday' && e.date.year ? { birthYear: e.date.year } : {}) },
    reminders: { useDefault: false, minutes: [] }, etag: `"contact"`, updated: NEVER,
  };
}

/** The read-only events of the contacts' dates in `[from, to)`; every date repeats every year. */
export function contactEvents(contacts: GoogleContact[], from: string, to: string, color: string): CalendarEvent[] {
  const years = Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, i) => Number(from.slice(0, 4)) + i);
  return contacts.flatMap((c) => entriesOf(c).flatMap((e) =>
    years.map((y) => yearlyDate(y, e.date.month, e.date.day)).filter((d) => d >= from && d < to).map((d) => eventOf(c, e, d, color))));
}
