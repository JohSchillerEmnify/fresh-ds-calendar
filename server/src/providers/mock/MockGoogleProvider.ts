import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_CALENDAR_COLORS, type CalendarColor } from '@calendar/shared/colors';
import { googleEventId } from '../../lib/ids.js';
import { addDays, addMonthsClamp, dayNumber, daysInMonth, formatInZone, localDateOf, localTimeOf, startOfLocalDay, zonedToUtc } from '../../lib/time.js';
import type { Clock } from '../../lib/clock.js';
import { RateGuard } from '../google/RateGuard.js';
import { isHolidayCalendarId, parseHolidayCalendarId } from '../holidayRegions.js';
import {
  NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError, ReauthRequiredError, CalendarPermissionMissingError, SyncTokenExpiredError,
  type CalendarProvider, type GoogleEvent, type GoogleReminder, type GoogleEventInput, type GoogleEventPatch, type ListEventsParams,
  type ListEventsResult, type ProviderCalendar, type WriteOptions, type ContactsResult,
} from '../CalendarProvider.js';
import { MockContacts } from './MockContacts.js';

/** The name Google gives a holiday calendar in the language of its id. */
function holidaySummary(id: string): string {
  const parsed = parseHolidayCalendarId(id);
  const lang = id.startsWith('de.') ? 'de' : 'en';
  const country = parsed ? new Intl.DisplayNames([lang], { type: 'region' }).of(parsed.code) : id;
  return lang === 'de' ? `Feiertage in ${country}` : `Holidays in ${country}`;
}

const MOCK_CALENDARS: ProviderCalendar[] = [
  { id: 'primary', summary: 'Personal', backgroundColor: '#039be5', primary: true, accessRole: 'owner' },
  { id: 'work', summary: 'Work', backgroundColor: '#0b8043', primary: false, accessRole: 'owner' },
];

/** Optional calendar fields a test may choose (e.g. Google's contacts Birthdays calendar). */
type CalendarExtra = Partial<Pick<ProviderCalendar, 'id' | 'backgroundColor' | 'accessRole' | 'owner'>>;

interface Persisted { seq: number; events: GoogleEvent[]; calendars?: ProviderCalendar[] }

export interface MockOptions {
  dataDir: string | null;      // null = memory only
  tz: string;
  clock: Clock;
  flushDelayMs?: number;
  /** Whether the person's token carries `contacts.readonly` (the People API refuses a token without it). */
  contactsGranted?: () => boolean;
}

/** Emulates Google Calendar API v3 semantics (ids, etag, updated, sequence, cancelled, extendedProperties). */
export class MockGoogleProvider implements CalendarProvider {
  readonly name = 'mock' as const;
  private events = new Map<string, GoogleEvent>();
  private seq = 0;
  /** Sync tokens carry this: a restart, a reset or {@link expireSyncTokens} makes older tokens answer 410 like Google's expired ones. */
  private epoch = newEpoch();
  /** Change counter at the last write of each event (what a sync token is compared with). */
  private changedAt = new Map<string, number>();
  /** Events that left a calendar (moved away), which a sync reports as cancelled there. */
  private gone: { calendarId: string; id: string; seq: number }[] = [];
  private outage: { status: 500 | 503 } | null = null;
  private readonly unreadable = new Set<string>();
  /** The real provider's rate guard (ADR 0007), without a fresh-cache window: every read still reaches the store. */
  private guard = newGuard();
  /** `Retry-After` (seconds) of the "rate limited" answer the next call gets; null = none queued. */
  private rateLimitNext: number | null = null;
  private revoked = false;
  private calendarMissing = false;
  /** Public (holiday) calendars Google answers 404 for. */
  private missingPublic = new Set<string>();
  private calendars: ProviderCalendar[] = MOCK_CALENDARS.map((c) => ({ ...c }));
  private timer: NodeJS.Timeout | null = null;
  private readonly file: string | null;
  private readonly tz: string;
  private readonly clock: Clock;
  private readonly delay: number;
  /** The person's Google contacts (People API stand-in, memory only). */
  readonly contacts: MockContacts;
  /** true when the store was loaded from disk and had content */
  readonly loadedFromDisk: boolean;

  constructor(opts: MockOptions) {
    this.tz = opts.tz;
    this.clock = opts.clock;
    this.delay = opts.flushDelayMs ?? 200;
    this.contacts = new MockContacts(opts.contactsGranted ?? (() => false));
    this.file = opts.dataDir ? path.join(opts.dataDir, 'mock-google.json') : null;
    let loaded = false;
    if (this.file && fs.existsSync(this.file)) {
      try {
        const p = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Persisted;
        this.seq = p.seq ?? 0;
        for (const e of p.events ?? []) this.events.set(key(e.calendarId, e.id), e);
        if (Array.isArray(p.calendars) && p.calendars.length) this.calendars = p.calendars;
        loaded = this.events.size > 0;
      } catch {
        // corrupt store: start empty (the file is rewritten on the next flush)
      }
    }
    this.loadedFromDisk = loaded;
  }

  // ---- test hooks ----
  setOutage(down: boolean, status: 500 | 503 = 503): void {
    this.outage = down ? { status } : null;
  }
  /** The next call answers "rate limited" with this `Retry-After`, starting the guard's cooldown as Google would. */
  /** Makes Google fail every events read of this calendar (the others answer as usual); `*` is every calendar. */
  setUnreadable(calendarId: string, on: boolean): void {
    if (on) this.unreadable.add(calendarId); else this.unreadable.delete(calendarId);
  }
  setRateLimitNext(retryAfterSec: number): void {
    this.rateLimitNext = retryAfterSec;
  }
  cooldownMs(): number {
    return this.guard.cooldownMs();
  }
  /** Makes every sync token handed out so far answer 410 Gone, as when Google expires them. */
  expireSyncTokens(): void {
    this.epoch = newEpoch();
  }
  /** Simulates Google answering this person's token refresh with `invalid_grant`. */
  /** Simulates Google refusing calls because the calendar scope was not granted. */
  setCalendarMissing(missing: boolean): void {
    this.calendarMissing = missing;
  }

  /** Makes Google answer 404 for these public holiday calendars (they do not exist). */
  addPublicMissing(ids: string[]): void {
    for (const id of ids) this.missingPublic.add(id);
  }
  setRevoked(revoked: boolean): void {
    this.revoked = revoked;
  }
  /** Replaces this account's calendar list (TEST_MODE: own and shared calendars of one person). */
  setCalendars(cals: ProviderCalendar[]): void {
    this.calendars = cals.map((c) => ({ ...c }));
    this.scheduleFlush();
  }
  get isDown(): boolean {
    return this.outage !== null;
  }
  reset(): void {
    this.events.clear();
    this.changedAt.clear();
    this.gone = [];
    this.epoch = newEpoch();
    this.calendars = MOCK_CALENDARS.map((c) => ({ ...c }));
    this.outage = null;
    this.unreadable.clear();
    this.missingPublic.clear();
    this.guard = newGuard();
    this.lookups = 0;
    this.rateLimitNext = null;
    this.contacts.reset();
    this.scheduleFlush();
  }
  get size(): number {
    return this.events.size;
  }
  /** Raw store access that ignores the outage switch (test endpoints). */
  remote = {
    list: (calendarId?: string, includeCancelled = false): GoogleEvent[] =>
      [...this.events.values()].filter((e) => (!calendarId || e.calendarId === calendarId) && (includeCancelled || e.status !== 'cancelled')).map(clone),
    insert: (calendarId: string, ev: GoogleEventInput & { id?: string }): GoogleEvent => this.doInsert(calendarId, ev),
    patch: (calendarId: string, id: string, patch: GoogleEventPatch): GoogleEvent => this.doPatch(calendarId, id, patch),
    delete: (calendarId: string, id: string): void => {
      this.doPatch(calendarId, id, { status: 'cancelled' });
    },
    find: (id: string): GoogleEvent | undefined => [...this.events.values()].find((e) => e.id === id),
    /** The calendar list including hidden entries. */
    calendars: (): ProviderCalendar[] => this.calendars.map((c) => ({ ...c })),
    insertCalendar: (summary: string, hidden = false, extra?: CalendarExtra): ProviderCalendar => this.doInsertCalendar(summary, hidden, extra),
    /** Switches a calendar off or on in Google's list as another Google client would. */
    setHidden: (calendarId: string, hidden: boolean): void => {
      this.requireCalendar(calendarId);
      this.calendars.find((c) => c.id === calendarId)!.hidden = hidden;
      this.scheduleFlush();
    },
    /** Sets a calendar's `defaultReminders` as another Google client would. */
    setDefaultReminders: (calendarId: string, reminders: GoogleReminder[]): void => this.doSetDefaultReminders(calendarId, reminders),
  };

  private check(): void {
    if (this.revoked) throw new ReauthRequiredError('invalid_grant');
    if (this.calendarMissing) throw new CalendarPermissionMissingError('Calendar scope not granted');
    // as GoogleProvider.call: no call during a cooldown; a queued rate-limit answer starts one
    this.guard.assertOpen();
    if (this.rateLimitNext !== null) {
      const retryAfter = this.rateLimitNext;
      this.rateLimitNext = null;
      throw this.guard.noteRateLimited('mock', retryAfter);
    }
    if (this.outage) {
      if (this.outage.status === 500) throw new ProviderError('Simulated provider error');
      throw new ProviderUnavailableError('Simulated outage');
    }
    this.guard.noteSuccess();
  }

  // ---- CalendarProvider ----
  async ping(): Promise<void> {
    this.check();
  }

  async listContacts(syncToken?: string): Promise<ContactsResult> {
    return this.contacts.list(syncToken);
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    return this.guard.cached('calendarList', async () => {
      this.check();
      return this.calendars.map((c) => ({ ...c }));
    });
  }

  async insertCalendar(summary: string): Promise<ProviderCalendar> {
    this.check();
    return this.doInsertCalendar(summary, false);
  }

  async publicCalendarExists(calendarId: string): Promise<boolean> {
    this.check();
    return this.isPublic(calendarId);
  }

  async subscribeCalendar(calendarId: string): Promise<ProviderCalendar> {
    this.check();
    if (!this.isPublic(calendarId)) throw new NotFoundError('Not Found');
    // Google refuses a calendar that is already in the list with 409 "Already Exists"
    if (this.calendars.some((c) => c.id === calendarId)) throw new ProviderError('Google 409: Already Exists');
    const cal: ProviderCalendar = { id: calendarId, summary: holidaySummary(calendarId), backgroundColor: '#7986cb', primary: false, accessRole: 'reader', hidden: false };
    this.calendars.push(cal);
    this.scheduleFlush();
    return { ...cal };
  }

  async unsubscribeCalendar(calendarId: string): Promise<void> {
    this.check();
    this.requireCalendar(calendarId);
    const cal = this.calendars.find((c) => c.id === calendarId)!;
    // Google refuses to remove the primary calendar from its own list
    if (cal.primary) throw new ProviderError('Google 400: Cannot remove the primary calendar');
    this.calendars = this.calendars.filter((c) => c.id !== calendarId);
    this.scheduleFlush();
  }

  async setCalendarHidden(calendarId: string, hidden: boolean): Promise<void> {
    this.check();
    this.requireCalendar(calendarId);
    this.calendars.find((c) => c.id === calendarId)!.hidden = hidden;
    this.scheduleFlush();
  }

  async setCalendarDefaultReminders(calendarId: string, reminders: GoogleReminder[]): Promise<void> {
    this.check();
    this.doSetDefaultReminders(calendarId, reminders);
  }

  async listEvents(p: ListEventsParams): Promise<ListEventsResult> {
    const key = `events|${p.calendarId}|${p.timeMin ?? ''}|${p.timeMax ?? ''}|${p.showDeleted ? 1 : 0}|${p.singleEvents === false ? 0 : 1}|${(p.privateExtendedProperty ?? []).join('&')}|${(p.eventTypes ?? []).join(',')}`;
    return this.guard.cached(key, async () => this.readEvents(p));
  }

  private readEvents(p: ListEventsParams): ListEventsResult {
    this.check();
    if (this.unreadable.has(p.calendarId) || this.unreadable.has('*')) throw new ProviderError('Simulated provider error');
    return this.collect(p);
  }

  private collect(p: ListEventsParams): ListEventsResult {
    this.requireCalendar(p.calendarId);
    const min = p.timeMin ? Date.parse(p.timeMin) : -Infinity;
    const max = p.timeMax ? Date.parse(p.timeMax) : Infinity;
    const filters = (p.privateExtendedProperty ?? []).map((s) => {
      const i = s.indexOf('=');
      return [s.slice(0, i), s.slice(i + 1)] as const;
    });
    const out: GoogleEvent[] = [];
    const exceptions = new Set<string>();
    for (const e of this.events.values()) if (e.recurringEventId && e.calendarId === p.calendarId) exceptions.add(`${e.recurringEventId}|${e.id}`);
    for (const e of this.events.values()) {
      if (e.calendarId !== p.calendarId) continue;
      if (e.status === 'cancelled' && !p.showDeleted) continue;
      if (p.eventTypes && !p.eventTypes.includes(e.eventType ?? 'default')) continue;
      // recurring masters are expanded only inside a bounded range (and not at all without `singleEvents`: Google lists the master)
      const cands = p.singleEvents !== false && e.recurrence && !e.recurringEventId && Number.isFinite(min) && Number.isFinite(max) ? this.expand(e, min, max, exceptions) : [e];
      // an exception past its series' UNTIL is no longer an occurrence (Google only shows what the rule makes)
      if (p.singleEvents !== false && e.recurringEventId && this.pastUntil(e)) continue;
      // Google lists an unexpanded series when any of its occurrences falls in the window, not only its first one
      const seriesInWindow = p.singleEvents === false && !!e.recurrence && !e.recurringEventId && Number.isFinite(min) && Number.isFinite(max) && this.expand(e, min, max, exceptions).length > 0;
      for (const c of cands) {
        const [s, en] = this.bounds(c);
        if (!seriesInWindow && !(en > min && s < max)) continue;
        // Google: a cancelled exception only guarantees id, recurringEventId and originalStartTime (no properties)
        const shown = c.status === 'cancelled' && c.recurringEventId ? cancelledShape(c) : c;
        if (filters.some(([k, v]) => shown.extendedProperties?.private?.[k] !== v)) continue;
        out.push(clone(shown));
      }
    }
    return { items: out, nextSyncToken: this.syncToken() };
  }

  private syncToken(): string {
    return `sync-${this.epoch}-${this.seq}`;
  }

  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    this.check();
    return clone(this.resolve(calendarId, eventId));
  }

  async insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent> {
    this.check();
    if (ev.eventType === 'birthday') checkBirthdayInsert(ev);
    return this.doInsert(calendarId, ev);
  }

  async patchEvent(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): Promise<GoogleEvent> {
    this.check();
    this.requireCalendar(calendarId);
    const cur = this.events.get(key(calendarId, eventId)) ?? this.virtualInstance(calendarId, eventId);
    if (cur?.eventType === 'birthday') checkBirthdayPatch(cur, patch);
    return this.doPatch(calendarId, eventId, patch, o);
  }

  async deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void> {
    this.check();
    const cur = this.resolve(calendarId, eventId);
    if (cur.status === 'cancelled') throw new NotFoundError('Resource has been deleted');
    this.doPatch(calendarId, eventId, { status: 'cancelled' }, o);
    // deleting a series deletes its exceptions with it (Google)
    if (cur.recurrence) {
      for (const e of [...this.events.values()]) {
        if (e.calendarId === calendarId && e.recurringEventId === eventId && e.status !== 'cancelled') this.doPatch(calendarId, e.id, { status: 'cancelled' });
      }
    }
  }

  async moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent> {
    this.check();
    this.requireCalendar(destinationCalendarId);
    const cur = this.getStored(calendarId, eventId);
    if (cur.status === 'cancelled') throw new NotFoundError('Not Found');
    if (cur.eventType === 'birthday') throw new ProviderError('Google 400: a birthday cannot be moved to another calendar');
    this.events.delete(key(calendarId, eventId));
    this.changedAt.delete(key(calendarId, eventId));
    cur.calendarId = destinationCalendarId;
    this.touch(cur);
    this.gone.push({ calendarId, id: eventId, seq: this.seq });
    this.events.set(key(destinationCalendarId, eventId), cur);
    this.scheduleFlush();
    return clone(cur);
  }

  /** How many change lookups (`listChanges`) were made since the last reset (test hook). */
  lookups = 0;

  async listChanges(calendarId: string, syncToken: string): Promise<ListEventsResult> {
    this.lookups++;
    this.check();
    this.requireCalendar(calendarId);
    const m = /^sync-([a-z0-9]+)-(\d+)$/.exec(syncToken);
    if (!m || m[1] !== this.epoch) throw new SyncTokenExpiredError('Sync token expired');
    const since = Number(m[2]);
    const items: GoogleEvent[] = [];
    for (const [k, e] of this.events) {
      if (e.calendarId !== calendarId || (this.changedAt.get(k) ?? 0) <= since) continue;
      items.push(clone(e.status === 'cancelled' && e.recurringEventId ? cancelledShape(e) : e));
    }
    for (const g of this.gone) {
      if (g.calendarId === calendarId && g.seq > since) items.push({ id: g.id, calendarId, etag: '', status: 'cancelled', start: {}, end: {}, created: '', updated: '' });
    }
    return { items, nextSyncToken: this.syncToken() };
  }

  async listSyncToken(calendarId: string): Promise<string | undefined> {
    this.check();
    this.requireCalendar(calendarId);
    return this.syncToken();
  }

  async listInstances(calendarId: string, seriesId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]> {
    this.check();
    const master = this.events.get(key(calendarId, seriesId));
    if (!master?.recurrence || master.status === 'cancelled') return [];
    return this.collect({ calendarId, timeMin, timeMax }).items.filter((e) => e.id === seriesId || e.recurringEventId === seriesId);
  }

  async setCalendarColor(calendarId: string, color: { colorId: string } | { backgroundColor: string; foregroundColor: string }): Promise<void> {
    this.check();
    this.requireCalendar(calendarId);
    const entry = this.calendars.find((c) => c.id === calendarId)!;
    if ('colorId' in color) {
      const known = GOOGLE_CALENDAR_COLORS.find((c) => c.id === color.colorId);
      if (!known) throw new ProviderError(`Unknown colorId ${color.colorId}`);
      // like Google: an RGB colour already on the entry supersedes colorId, so a bare colorId does not change what is shown
      Object.assign(entry, { colorId: known.id });
    } else {
      Object.assign(entry, color, { colorId: undefined });
    }
    this.scheduleFlush();
  }

  async calendarColors(): Promise<CalendarColor[]> {
    this.check();
    return [...GOOGLE_CALENDAR_COLORS];
  }

  // ---- internals ----
  /** A public holiday calendar exists for anyone, in the person's list or not, unless the test made it missing. */
  private isPublic(id: string): boolean {
    return isHolidayCalendarId(id) && !this.missingPublic.has(id);
  }

  private requireCalendar(id: string): void {
    if (!this.calendars.some((c) => c.id === id) && !this.isPublic(id)) throw new NotFoundError(`Calendar ${id} not found`);
  }

  private doSetDefaultReminders(calendarId: string, reminders: GoogleReminder[]): void {
    this.requireCalendar(calendarId);
    this.calendars.find((c) => c.id === calendarId)!.defaultReminders = reminders.map((r) => ({ ...r }));
    this.scheduleFlush();
  }

  private doInsertCalendar(summary: string, hidden: boolean, extra: CalendarExtra = {}): ProviderCalendar {
    const cal: ProviderCalendar = {
      id: `${googleEventId()}@group.calendar.google.com`, summary, backgroundColor: '#039be5', primary: false, accessRole: 'owner', hidden, ...extra,
    };
    this.calendars.push(cal);
    this.scheduleFlush();
    return { ...cal };
  }

  private getStored(calendarId: string, id: string): GoogleEvent {
    this.requireCalendar(calendarId);
    const e = this.events.get(key(calendarId, id));
    if (!e) throw new NotFoundError('Not Found');
    return e;
  }

  /** Resolves stored events and virtual recurring instances (`<masterId>_<YYYYMMDD>[T..]`). */
  private resolve(calendarId: string, id: string): GoogleEvent {
    this.requireCalendar(calendarId);
    const stored = this.events.get(key(calendarId, id));
    if (stored) {
      if (stored.status === 'cancelled') throw new NotFoundError('Not Found');
      return stored;
    }
    const inst = this.virtualInstance(calendarId, id);
    if (inst) return inst;
    throw new NotFoundError('Not Found');
  }

  /** Google's instance ids: `<masterId>_<YYYYMMDD>` for all-day series, `<masterId>_<YYYYMMDD>T<HHMMSS>Z` (UTC start) for timed ones. */
  private virtualInstance(calendarId: string, id: string): GoogleEvent | null {
    const m = /^(.+)_(\d{8})(?:T(\d{6})Z)?$/.exec(id);
    if (!m) return null;
    const master = this.events.get(key(calendarId, m[1]!));
    if (!master?.recurrence || master.status === 'cancelled') return null;
    const day = `${m[2]!.slice(0, 4)}-${m[2]!.slice(4, 6)}-${m[2]!.slice(6)}`;
    // a timed id names the UTC start: its local day may be another one
    const date = m[3] ? localDateOf(Date.parse(`${day}T${m[3].slice(0, 2)}:${m[3].slice(2, 4)}:${m[3].slice(4)}Z`), this.tz) : day;
    const min = startOfLocalDay(date, this.tz);
    return this.expand(master, min, min + 86_400_000, new Set()).find((x) => x.id === id) ?? null;
  }

  private masterDate(e: GoogleEvent): string {
    return e.start.date ?? localDateOf(Date.parse(e.start.dateTime!), e.start.timeZone ?? this.tz);
  }

  /** The RRULE line of a series (other lines, e.g. EXDATE, may come first). */
  private ruleLine(m: GoogleEvent): string {
    return m.recurrence?.find((l) => l.startsWith('RRULE:')) ?? '';
  }

  /** RFC 5545 UNTIL (inclusive): a date for an all-day series, a UTC instant for a timed one (how a split ends a series). */
  private until(m: GoogleEvent): { date: string | null; ms: number | null } {
    const u = /UNTIL=(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?/.exec(this.ruleLine(m));
    return { date: u && !u[4] ? `${u[1]}-${u[2]}-${u[3]}` : null, ms: u?.[4] ? Date.parse(`${u[1]}-${u[2]}-${u[3]}T${u[4]}:${u[5]}:${u[6]}Z`) : null };
  }

  /** An exception whose rule start lies after its series' UNTIL. */
  private pastUntil(e: GoogleEvent): boolean {
    const m = this.events.get(key(e.calendarId, e.recurringEventId!));
    const o = e.originalStartTime;
    if (!m || !o) return false;
    const u = this.until(m);
    if (o.date) return u.date !== null && o.date > u.date;
    return u.ms !== null && Date.parse(o.dateTime!) > u.ms;
  }

  private expand(m: GoogleEvent, min: number, max: number, exceptions: Set<string>): GoogleEvent[] {
    const rule = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(this.ruleLine(m))?.[1];
    const lastOfFeb = /BYMONTH=2;BYMONTHDAY=-1/.test(this.ruleLine(m));
    const { date: untilDate, ms: untilMs } = this.until(m);
    if (!rule) return [m];
    const base = this.masterDate(m);
    const baseTime = m.start.dateTime ? localTimeOf(Date.parse(m.start.dateTime), m.start.timeZone ?? this.tz) : null;
    const durationMs = this.bounds(m)[1] - this.bounds(m)[0];
    const spanDays = m.start.date ? dayNumber(m.end.date!) - dayNumber(m.start.date) : 0;
    const out: GoogleEvent[] = [];
    const lo = localDateOf(min, this.tz);
    const behind = Math.max(0, dayNumber(lo) - dayNumber(base) - spanDays - 2);
    const n0 = rule === 'DAILY' ? behind : rule === 'WEEKLY' ? Math.floor(behind / 7) : rule === 'MONTHLY' ? Math.floor(behind / 31) : Math.floor(behind / 366);
    for (let n = n0; n < n0 + 5000 && out.length < 400; n++) {
      const date = rule === 'DAILY' ? addDays(base, n) : rule === 'WEEKLY' ? addDays(base, 7 * n) : rule === 'MONTHLY' ? addMonthsClamp(base, n).date : this.yearly(base, n, lastOfFeb);
      if (!date) continue; // 29 February in a year without one: Google skips it
      if (startOfLocalDay(date, this.tz) >= max) break;
      if (untilDate && date > untilDate) break;
      // Google instance: the master's fields with its own id, start and etag, `recurringEventId` and `originalStartTime`
      const inst: GoogleEvent = { ...clone(m), recurringEventId: m.id };
      delete inst.recurrence;
      if (m.start.date) {
        inst.id = `${m.id}_${date.replaceAll('-', '')}`;
        inst.start = { date };
        inst.end = { date: addDays(date, spanDays) };
      } else {
        const s = zonedToUtc(date, baseTime!, this.tz);
        if (untilMs !== null && s > untilMs) break;
        inst.id = `${m.id}_${new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`;
        inst.start = { dateTime: formatInZone(s, this.tz), timeZone: m.start.timeZone ?? this.tz };
        inst.end = { dateTime: formatInZone(s + durationMs, this.tz), timeZone: m.end.timeZone ?? this.tz };
      }
      if (exceptions.has(`${m.id}|${inst.id}`)) continue;
      inst.originalStartTime = { ...inst.start };
      inst.etag = `"${m.etag.replaceAll('"', '')}-${inst.id.slice(m.id.length + 1)}"`;
      const [s0, e0] = this.bounds(inst);
      if (e0 > min && s0 < max) out.push(inst);
    }
    return out;
  }

  /** The n-th yearly date after `base`; `null` for 29 February in a common year. `lastOfFeb` is the rule `BYMONTH=2;BYMONTHDAY=-1`. */
  private yearly(base: string, n: number, lastOfFeb: boolean): string | null {
    const [y, m, d] = base.split('-').map(Number) as [number, number, number];
    const ny = y + n;
    const day = lastOfFeb ? daysInMonth(ny, 2) : d;
    if (day > daysInMonth(ny, m)) return null;
    return `${String(ny).padStart(4, '0')}-${String(lastOfFeb ? 2 : m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private bounds(e: GoogleEvent): [number, number] {
    const s = e.start.date ? startOfLocalDay(e.start.date, this.tz) : Date.parse(e.start.dateTime!);
    const en = e.end.date ? startOfLocalDay(e.end.date, this.tz) : Date.parse(e.end.dateTime!);
    return [s, en];
  }

  private touch(e: GoogleEvent): void {
    this.seq++;
    e.updated = new Date(this.clock.real()).toISOString();
    e.sequence = (e.sequence ?? 0) + 1;
    e.etag = `"${this.seq.toString(36)}${Math.floor(this.clock.real() / 1000).toString(36)}"`;
    this.changedAt.set(key(e.calendarId, e.id), this.seq);
  }

  private doInsert(calendarId: string, ev: GoogleEventInput & { id?: string }): GoogleEvent {
    this.requireCalendar(calendarId);
    const id = ev.id ?? googleEventId();
    if (this.events.has(key(calendarId, id))) throw new ProviderError('Conflict: identifier already exists');
    const now = new Date(this.clock.real()).toISOString();
    // Google gives events in a group calendar the calendar itself as organiser.
    const cal = this.calendars.find((c) => c.id === calendarId);
    const organizer = !ev.organizer && cal && !cal.primary && calendarId.endsWith('@group.calendar.google.com')
      ? { email: calendarId, displayName: cal.summary, self: true } : undefined;
    const e: GoogleEvent = {
      ...clone(ev), ...(organizer ? { organizer } : {}), id, calendarId, status: ev.status ?? 'confirmed', etag: '', created: now, updated: now,
      iCalUID: `${id}@mock.google.com`, sequence: -1,
    };
    this.touch(e);
    e.sequence = 0;
    this.events.set(key(calendarId, id), e);
    this.scheduleFlush();
    return clone(e);
  }

  private doPatch(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): GoogleEvent {
    this.requireCalendar(calendarId);
    let cur = this.events.get(key(calendarId, eventId));
    if (!cur) {
      // Patching a virtual recurring instance materialises an exception event.
      const inst = this.virtualInstance(calendarId, eventId);
      if (!inst) throw new NotFoundError('Not Found');
      if (o?.ifMatch && !etagEq(o.ifMatch, inst.etag)) throw new PreconditionFailedError('Precondition Failed');
      cur = inst;
      this.events.set(key(calendarId, eventId), cur);
    } else if (o?.ifMatch && !etagEq(o.ifMatch, cur.etag)) {
      throw new PreconditionFailedError('Precondition Failed');
    }
    applyPatch(cur, patch);
    this.touch(cur);
    this.scheduleFlush();
    return clone(cur);
  }

  // ---- persistence ----
  private scheduleFlush(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushSync();
    }, this.delay);
    this.timer.unref();
  }

  flushSync(): void {
    if (!this.file) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const data: Persisted = { seq: this.seq, events: [...this.events.values()], calendars: this.calendars };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, this.file);
  }

  close(): void {
    this.flushSync();
  }
}

const newEpoch = (): string => Math.random().toString(36).slice(2, 10) || 'e0';
const key = (cal: string, id: string) => `${cal}\u0000${id}`;
const clone = <T>(x: T): T => structuredClone(x);
const etagEq = (a: string, b: string) => a.replace(/^W\//, '').replaceAll('"', '') === b.replace(/^W\//, '').replaceAll('"', '');

/** Properties Google accepts on a new birthday (events.insert with `eventType: "birthday"`); nothing else is allowed. */
const BIRTHDAY_INSERT_KEYS = new Set(['eventType', 'summary', 'start', 'end', 'recurrence', 'visibility', 'transparency', 'colorId', 'reminders', 'birthdayProperties']);
/** Properties Google accepts when a birthday is patched. */
const BIRTHDAY_PATCH_KEYS = new Set(['colorId', 'summary', 'reminders', 'start', 'end']);

const bad = (msg: string) => new ProviderError(`Google 400 invalid birthday: ${msg}`);

/** The `date` of a one-day all-day `{ date }` value, or null (a null `dateTime` is what the Google provider adds when patching). */
function dayOf(dt: { date?: string; dateTime?: string | null } | undefined): string | null {
  return dt?.date && !dt.dateTime ? dt.date : null;
}

/** Google's rules for creating a birthday (checked independently of the server code that builds the body). */
function checkBirthdayInsert(ev: GoogleEventInput): void {
  for (const [k, v] of Object.entries(ev)) if (v !== undefined && !BIRTHDAY_INSERT_KEYS.has(k)) throw bad(`property "${k}" is not allowed`);
  const start = dayOf(ev.start), end = dayOf(ev.end);
  if (!start || !end || end !== addDays(start, 1)) throw bad('start and end must be one all-day date');
  const rule = start.slice(5) === '02-29' ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY';
  if (ev.recurrence?.length !== 1 || ev.recurrence[0] !== rule) throw bad(`recurrence must be ${rule}`);
  if (ev.visibility !== 'private') throw bad('visibility must be private');
  if (ev.transparency !== 'transparent') throw bad('transparency must be transparent');
  const bp = ev.birthdayProperties;
  if (bp && (Object.keys(bp).length !== 1 || bp.type !== 'birthday')) throw bad('birthdayProperties may only be { type: "birthday" }');
}

/** Google's rules for patching a birthday: four fields, and no new date for a birthday of a contact or the person's own. */
function checkBirthdayPatch(cur: GoogleEvent, patch: GoogleEventPatch): void {
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && !BIRTHDAY_PATCH_KEYS.has(k)) throw bad(`property "${k}" cannot be changed`);
  if (!patch.start && !patch.end) return;
  const start = dayOf(patch.start), end = dayOf(patch.end);
  if (!start || !end || end !== addDays(start, 1)) throw bad('start and end must be one all-day date');
  const locked = !!cur.birthdayProperties?.contact || cur.birthdayProperties?.type === 'self';
  if (locked && start !== cur.start.date) throw bad('the date of a birthday from a contact (or of type self) cannot change');
}

function applyPatch(cur: GoogleEvent, patch: GoogleEventPatch): void {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'extendedProperties') {
      const ep = (v ?? {}) as NonNullable<GoogleEventPatch['extendedProperties']>;
      cur.extendedProperties ??= {};
      for (const scope of ['private', 'shared'] as const) {
        const src = ep[scope];
        if (!src) continue;
        const dst = (cur.extendedProperties[scope] ??= {});
        for (const [pk, pv] of Object.entries(src)) {
          if (pv === null || pv === '') delete dst[pk];
          else dst[pk] = pv;
        }
        if (Object.keys(dst).length === 0) delete cur.extendedProperties[scope];
      }
      if (Object.keys(cur.extendedProperties).length === 0) delete cur.extendedProperties;
    } else if (v === null || v === undefined) {
      delete (cur as unknown as Record<string, unknown>)[k];
    } else {
      (cur as unknown as Record<string, unknown>)[k] = structuredClone(v);
    }
  }
}

/** A rate guard whose reads are never fresh (ttl 0), so it only answers from its cache while rate limited. */
function newGuard(): RateGuard {
  return new RateGuard({ ttlMs: 0 });
}

/** What Google guarantees on a cancelled exception: id, recurringEventId and originalStartTime (the rest may be empty). */
function cancelledShape(e: GoogleEvent): GoogleEvent {
  return {
    id: e.id, calendarId: e.calendarId, etag: e.etag, status: 'cancelled', recurringEventId: e.recurringEventId, originalStartTime: e.originalStartTime,
    start: {}, end: {}, created: e.created, updated: e.updated,
  };
}
