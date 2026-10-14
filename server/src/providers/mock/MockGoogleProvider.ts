import fs from 'node:fs';
import path from 'node:path';
import { googleEventId } from '../../lib/ids.js';
import { addDays, addMonthsClamp, dayNumber, formatInZone, localDateOf, localTimeOf, startOfLocalDay, zonedToUtc } from '../../lib/time.js';
import type { Clock } from '../../lib/clock.js';
import {
  NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError, ReauthRequiredError, CalendarPermissionMissingError,
  type CalendarProvider, type GoogleEvent, type GoogleReminder, type GoogleEventInput, type GoogleEventPatch, type ListEventsParams,
  type ListEventsResult, type ProviderCalendar, type WriteOptions,
} from '../CalendarProvider.js';

export const MOCK_CALENDARS: ProviderCalendar[] = [
  { id: 'primary', summary: 'Personal', backgroundColor: '#039be5', primary: true, accessRole: 'owner' },
  { id: 'work', summary: 'Work', backgroundColor: '#0b8043', primary: false, accessRole: 'owner' },
];

/** Optional calendar fields a test may choose (e.g. Google's contacts Birthdays calendar). */
type CalendarExtra = Partial<Pick<ProviderCalendar, 'id' | 'backgroundColor' | 'accessRole'>>;

interface Persisted { seq: number; events: GoogleEvent[]; calendars?: ProviderCalendar[] }

export interface MockOptions {
  dataDir: string | null;      // null = memory only
  tz: string;
  clock: Clock;
  flushDelayMs?: number;
}

/** Emulates Google Calendar API v3 semantics (ids, etag, updated, sequence, cancelled, extendedProperties). */
export class MockGoogleProvider implements CalendarProvider {
  readonly name = 'mock' as const;
  private events = new Map<string, GoogleEvent>();
  private seq = 0;
  private outage: { status: 500 | 503 } | null = null;
  private revoked = false;
  private calendarMissing = false;
  private calendars: ProviderCalendar[] = MOCK_CALENDARS.map((c) => ({ ...c }));
  private timer: NodeJS.Timeout | null = null;
  private readonly file: string | null;
  private readonly tz: string;
  private readonly clock: Clock;
  private readonly delay: number;
  /** true when the store was loaded from disk and had content */
  readonly loadedFromDisk: boolean;

  constructor(opts: MockOptions) {
    this.tz = opts.tz;
    this.clock = opts.clock;
    this.delay = opts.flushDelayMs ?? 200;
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
  /** Simulates Google answering this person's token refresh with `invalid_grant`. */
  /** Simulates Google refusing calls because the calendar scope was not granted. */
  setCalendarMissing(missing: boolean): void {
    this.calendarMissing = missing;
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
    this.calendars = MOCK_CALENDARS.map((c) => ({ ...c }));
    this.outage = null;
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
    /** Sets a calendar's `defaultReminders` as another Google client would. */
    setDefaultReminders: (calendarId: string, reminders: GoogleReminder[]): void => this.doSetDefaultReminders(calendarId, reminders),
  };

  private check(): void {
    if (this.revoked) throw new ReauthRequiredError('invalid_grant');
    if (this.calendarMissing) throw new CalendarPermissionMissingError('Calendar scope not granted');
    if (!this.outage) return;
    if (this.outage.status === 500) throw new ProviderError('Simulated provider error');
    throw new ProviderUnavailableError('Simulated outage');
  }

  // ---- CalendarProvider ----
  async ping(): Promise<void> {
    this.check();
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    this.check();
    return this.calendars.map((c) => ({ ...c }));
  }

  async insertCalendar(summary: string): Promise<ProviderCalendar> {
    this.check();
    return this.doInsertCalendar(summary, false);
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
    this.check();
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
      // recurring masters are expanded only inside a bounded range
      const cands = e.recurrence && !e.recurringEventId && Number.isFinite(min) && Number.isFinite(max) ? this.expand(e, min, max, exceptions) : [e];
      for (const c of cands) {
        const [s, en] = this.bounds(c);
        if (!(en > min && s < max)) continue;
        if (filters.some(([k, v]) => c.extendedProperties?.private?.[k] !== v)) continue;
        out.push(clone(c));
      }
    }
    return { items: out, nextSyncToken: `sync-${this.seq}` };
  }

  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    this.check();
    return clone(this.resolve(calendarId, eventId));
  }

  async insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent> {
    this.check();
    return this.doInsert(calendarId, ev);
  }

  async patchEvent(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): Promise<GoogleEvent> {
    this.check();
    return this.doPatch(calendarId, eventId, patch, o);
  }

  async deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void> {
    this.check();
    const cur = this.resolve(calendarId, eventId);
    if (cur.status === 'cancelled') throw new NotFoundError('Resource has been deleted');
    this.doPatch(calendarId, eventId, { status: 'cancelled' }, o);
  }

  async moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent> {
    this.check();
    this.requireCalendar(destinationCalendarId);
    const cur = this.getStored(calendarId, eventId);
    if (cur.status === 'cancelled') throw new NotFoundError('Not Found');
    this.events.delete(key(calendarId, eventId));
    cur.calendarId = destinationCalendarId;
    this.touch(cur);
    this.events.set(key(destinationCalendarId, eventId), cur);
    this.scheduleFlush();
    return clone(cur);
  }

  async listChanges(calendarId: string, _syncToken: string): Promise<ListEventsResult> {
    this.check();
    return { items: this.remote.list(calendarId, true), nextSyncToken: `sync-${this.seq}` };
  }

  // ---- internals ----
  private requireCalendar(id: string): void {
    if (!this.calendars.some((c) => c.id === id)) throw new NotFoundError(`Calendar ${id} not found`);
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

  private virtualInstance(calendarId: string, id: string): GoogleEvent | null {
    const m = /^(.+)_(\d{8})$/.exec(id);
    if (!m) return null;
    const master = this.events.get(key(calendarId, m[1]!));
    if (!master?.recurrence || master.status === 'cancelled') return null;
    const date = `${m[2]!.slice(0, 4)}-${m[2]!.slice(4, 6)}-${m[2]!.slice(6)}`;
    const min = startOfLocalDay(date, this.tz);
    return this.expand(master, min, min + 86_400_000, new Set()).find((x) => x.id === id) ?? null;
  }

  private masterDate(e: GoogleEvent): string {
    return e.start.date ?? localDateOf(Date.parse(e.start.dateTime!), e.start.timeZone ?? this.tz);
  }

  private expand(m: GoogleEvent, min: number, max: number, exceptions: Set<string>): GoogleEvent[] {
    const rule = /FREQ=(DAILY|WEEKLY|MONTHLY)/.exec(m.recurrence![0] ?? '')?.[1];
    if (!rule) return [m];
    const base = this.masterDate(m);
    const baseTime = m.start.dateTime ? localTimeOf(Date.parse(m.start.dateTime), m.start.timeZone ?? this.tz) : null;
    const durationMs = this.bounds(m)[1] - this.bounds(m)[0];
    const spanDays = m.start.date ? dayNumber(m.end.date!) - dayNumber(m.start.date) : 0;
    const out: GoogleEvent[] = [];
    const lo = localDateOf(min, this.tz);
    const behind = Math.max(0, dayNumber(lo) - dayNumber(base) - spanDays - 2);
    const n0 = rule === 'DAILY' ? behind : rule === 'WEEKLY' ? Math.floor(behind / 7) : Math.floor(behind / 31);
    for (let n = n0; n < n0 + 5000 && out.length < 400; n++) {
      const date = rule === 'DAILY' ? addDays(base, n) : rule === 'WEEKLY' ? addDays(base, 7 * n) : addMonthsClamp(base, n).date;
      if (startOfLocalDay(date, this.tz) >= max) break;
      const id = `${m.id}_${date.replaceAll('-', '')}`;
      if (exceptions.has(`${m.id}|${id}`)) continue;
      const inst: GoogleEvent = { ...clone(m), id, recurringEventId: m.id, recurrence: undefined };
      delete inst.recurrence;
      if (m.start.date) {
        inst.start = { date };
        inst.end = { date: addDays(date, spanDays) };
      } else {
        const s = zonedToUtc(date, baseTime!, this.tz);
        inst.start = { dateTime: formatInZone(s, this.tz), timeZone: m.start.timeZone ?? this.tz };
        inst.end = { dateTime: formatInZone(s + durationMs, this.tz), timeZone: m.end.timeZone ?? this.tz };
      }
      const [s0, e0] = this.bounds(inst);
      if (e0 > min && s0 < max) out.push(inst);
    }
    return out;
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
  }

  private doInsert(calendarId: string, ev: GoogleEventInput & { id?: string }): GoogleEvent {
    this.requireCalendar(calendarId);
    const id = ev.id ?? googleEventId();
    if (this.events.has(key(calendarId, id))) throw new ProviderError('Conflict: identifier already exists');
    const now = new Date(this.clock.real()).toISOString();
    const e: GoogleEvent = {
      ...clone(ev), id, calendarId, status: ev.status ?? 'confirmed', etag: '', created: now, updated: now,
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

const key = (cal: string, id: string) => `${cal}\u0000${id}`;
const clone = <T>(x: T): T => structuredClone(x);
const etagEq = (a: string, b: string) => a.replace(/^W\//, '').replaceAll('"', '') === b.replace(/^W\//, '').replaceAll('"', '');

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
