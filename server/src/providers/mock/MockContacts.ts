import type { people_v1 } from '@googleapis/people';
import { fromPerson } from '../google/person.js';
import { CalendarPermissionMissingError, ProviderUnavailableError, SyncTokenExpiredError, type ContactsResult } from '../CalendarProvider.js';

/** What a test puts in a contact: the dates as the People API holds them (`year` 0 or absent = no year). */
export interface MockContactInput {
  name: string;
  birthday?: { year?: number; month: number; day: number };
  events?: { type?: string; year?: number; month: number; day: number }[];
}

interface Stored { person: people_v1.Schema$Person; seq: number }

const newEpoch = (): string => Math.random().toString(36).slice(2, 8);

/** People API stand-in: raw persons mapped like the real answer; token reads give only changes (deleted flagged), 403 without the scope. */
export class MockContacts {
  private persons = new Map<string, Stored>();
  private seq = 0;
  private next = 1;
  private epoch = newEpoch();
  private failure: number | null = null;

  /** `granted` says whether the person's token carries `contacts.readonly`. */
  constructor(private readonly granted: () => boolean) {}

  add(c: MockContactInput): string {
    const resourceName = `people/c${this.next++}`;
    const date = (d: { year?: number; month: number; day: number }) => ({ month: d.month, day: d.day, year: d.year ?? 0 });
    const person: people_v1.Schema$Person = {
      resourceName,
      names: [{ displayName: c.name, metadata: { primary: true } }],
      ...(c.birthday ? { birthdays: [{ date: date(c.birthday) }] } : {}),
      ...(c.events?.length ? { events: c.events.map((e) => ({ ...(e.type ? { type: e.type } : {}), date: date(e) })) } : {}),
    };
    this.persons.set(resourceName, { person, seq: ++this.seq });
    return resourceName;
  }

  /** The contact is gone: a sync-token read reports it as deleted, a full read leaves it out. */
  remove(resourceName: string): boolean {
    const s = this.persons.get(resourceName);
    if (!s) return false;
    s.person = { resourceName, metadata: { deleted: true } };
    s.seq = ++this.seq;
    return true;
  }

  /** Every call answers this HTTP status until it is null again. */
  setError(status: number | null): void {
    this.failure = status;
  }

  /** The token of the answers handed out so far no longer works (Google's 7 days). */
  expireTokens(): void {
    this.epoch = newEpoch();
  }

  reset(): void {
    this.persons.clear();
    this.seq = 0;
    this.next = 1;
    this.epoch = newEpoch();
    this.failure = null;
  }

  list(syncToken?: string): ContactsResult {
    if (!this.granted()) throw new CalendarPermissionMissingError('Request had insufficient authentication scopes (contacts.readonly)');
    if (this.failure !== null) throw new ProviderUnavailableError(`People API answered ${this.failure}`);
    let since = 0;
    if (syncToken) {
      const m = /^ct:([a-z0-9]+):(\d+)$/.exec(syncToken);
      if (!m || m[1] !== this.epoch) throw new SyncTokenExpiredError('EXPIRED_SYNC_TOKEN');
      since = Number(m[2]);
    }
    const items = [...this.persons.values()]
      .filter((s) => (syncToken ? s.seq > since : !s.person.metadata?.deleted))
      .map((s) => fromPerson(s.person));
    return { items, nextSyncToken: `ct:${this.epoch}:${this.seq}` };
  }
}
