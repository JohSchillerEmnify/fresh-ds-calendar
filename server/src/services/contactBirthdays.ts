/**
 * Dates of the person's Google contacts as read-only events of the virtual Birthdays calendar (feature contact-birthdays,
 * ADR 0043). The contacts are read through the People API's sync token and kept per person; the events are derived from them
 * for any window, so they travel through the change feed like the Google events.
 */
import { birthdayContactKey, birthdayTitleKey, yearlyDate } from '@calendar/shared/birthdays';
import type { CalendarEvent } from '../api/types.js';
import { addDays } from '../lib/time.js';
import { logEvent } from '../lib/diag.js';
import { SyncTokenExpiredError, type CalendarProvider, type ContactDate, type GoogleContact } from '../providers/CalendarProvider.js';
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

  private async read(): Promise<boolean> {
    try {
      let full = !this.token;
      let res;
      try {
        res = await this.provider.listContacts(this.token);
      } catch (e) {
        if (!(e instanceof SyncTokenExpiredError)) throw e;
        full = true;
        res = await this.provider.listContacts();
      }
      if (full) this.held.clear();
      for (const c of res.items) {
        if (c.deleted) this.held.delete(c.resourceName);
        else this.held.set(c.resourceName, c);
      }
      this.token = res.nextSyncToken;
      this.at = this.nowMs();
      return true;
    } catch (e) {
      // a missing scope, an outage or a rate limit: the other birthdays stay as they are, the next poll tries again
      logEvent('contacts_read_failed', { cause: e instanceof Error ? e.constructor.name : 'unknown' });
      return false;
    }
  }

  /** The contact dates falling in `[from, to)`, one event per year. */
  events(from: string, to: string, color: string): CalendarEvent[] {
    return contactEvents([...this.held.values()], from, to, color);
  }
}

interface Entry { kind: 'birthday' | 'anniversary' | 'other'; idKey: string; title: string; date: ContactDate }

/** Every dated entry of a contact with its kind and title; a contact without a display name has none. */
function entriesOf(c: GoogleContact): Entry[] {
  const name = c.name?.trim();
  if (!name) return [];
  const out: Entry[] = [];
  if (c.birthday) out.push({ kind: 'birthday', idKey: 'b', title: name, date: c.birthday });
  c.dates.forEach((d, i) => {
    const type = d.type?.trim().toLowerCase();
    if (type === 'anniversary') out.push({ kind: 'anniversary', idKey: `e${i}`, title: name, date: d.date });
    else if (!type || type === 'other') out.push({ kind: 'other', idKey: `e${i}`, title: name, date: d.date });
    else out.push({ kind: 'other', idKey: `e${i}`, title: `${d.type!.trim()}: ${name}`, date: d.date });
  });
  return out;
}

/** The read-only events of the contacts' dates in `[from, to)`; every date repeats every year. */
export function contactEvents(contacts: GoogleContact[], from: string, to: string, color: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const y0 = Number(from.slice(0, 4)), y1 = Number(to.slice(0, 4));
  for (const c of contacts) {
    for (const e of entriesOf(c)) {
      for (let y = y0; y <= y1; y++) {
        const date = yearlyDate(y, e.date.month, e.date.day);
        if (date < from || date >= to) continue;
        const special = e.kind === 'other' ? undefined : e.kind;
        events.push({
          kind: 'event', id: `contact:${c.resourceName}:${e.idKey}:${date}`, calendarId: BIRTHDAYS_ID, title: e.title, description: '', location: '',
          allDay: true, start: date, end: addDays(date, 1), colorId: null, color,
          ...(special ? { special, dupKey: birthdayContactKey(c.resourceName, special, date), dupAlt: birthdayTitleKey(e.title, date) } : {}),
          sourceCalendarId: CONTACTS_SOURCE, readOnly: true, readOnlyReason: { kind: 'contact' },
          contactBirthday: { resourceName: c.resourceName, ...(e.kind === 'birthday' && e.date.year ? { birthYear: e.date.year } : {}) },
          reminders: { useDefault: false, minutes: [] }, etag: `"contact"`, updated: NEVER,
        });
      }
    }
  }
  return events;
}
