/**
 * The Google side of "changes since" (ADR 0025, `GET /api/changes`): one person's events and task lists read through
 * sync tokens, one token per calendar, so a poll costs one call per calendar. An expired token (410) or a calendar the
 * device has no token for is listed in full and answered as `replace`. Repeating events are read unexpanded in the
 * change stream (a sync token cannot carry a time range) and their instances in the window are asked for per changed series.
 */
import { createHash } from 'node:crypto';
import type { CalendarEvent, TaskList } from '../api/types.js';
import { addDays, dayNumber, startOfLocalDay, formatInZone } from '../lib/time.js';
import {
  NotFoundError, ProviderError, ProviderForbiddenError, ProviderUnavailableError, RateLimitedError, SyncTokenExpiredError, SyncTokenTooLargeError, type CalendarProvider, type GoogleEvent, type ProviderCalendar,
} from '../providers/CalendarProvider.js';
import { calHash, logEvent } from '../lib/diag.js';
import { isTaskListEvent } from './taskCodec.js';
import { CONTACTS_SOURCE, type ContactsSource } from './contactBirthdays.js';

/** Days of window end the device may be behind before a calendar is simply listed again. */
const MAX_GAP_DAYS = 31;
/** How long a calendar that was too large to walk for a sync token is left alone. */
const NO_TOKEN_BACKOFF_MS = 10 * 60_000;
/** More changed repeating events than this in one calendar and poll: list the calendar in full instead of one `events.instances` call each. */
const MAX_SERIES_CALLS = 20;
/** First and longest wait before a calendar Google keeps refusing (gone, not permitted, fresh token refused) is asked again. */
const REFUSED_BACKOFF_MS = 60_000;
const REFUSED_BACKOFF_MAX_MS = 30 * 60_000;
const YEAR_BACK = 365;
const YEAR_AHEAD = 366;
/** Whether `e` is one calendar's own failure (that calendar is left out) and not the person's: a rate limit, a sign-in problem or a bug fails the whole answer. */
export function isCalendarFailure(e: unknown): boolean {
  return !(e instanceof RateLimitedError) && (e instanceof ProviderError || e instanceof ProviderUnavailableError || e instanceof NotFoundError);
}

/** Marks a cursor entry that is a content version of a token-less calendar, never a Google sync token. */
const VERSION_PREFIX = 'v:';

/** What the cursor remembers of the Google side: the window end of the last answer and one sync token per calendar. */
export interface FeedState { to: string; tokens: Record<string, string> }

export interface EventChanges {
  /** Every event calendar now present: the device drops the events of any other calendar. */
  calendars: string[];
  /** Calendars answered in full: the device drops their events first. */
  replace: string[];
  /** Repeating events whose stored instances the device drops first (their current instances are in `upserts`). */
  series: { calendarId: string; seriesId: string }[];
  removed: { calendarId: string; id: string }[];
  upserts: CalendarEvent[];
  /** Calendars that could not be read this time: the device keeps its copy of them; their cursor position is unchanged. */
  failed: string[];
}

export interface TaskListChanges {
  /** The tasks calendar was answered in full: the device drops all its (non-shared) lists first. */
  replace: boolean;
  series: string[];
  removed: string[];
  upserts: TaskList[];
  /** The tasks calendar could not be read this time: the device keeps its copy of the lists (shared lists are unaffected). */
  failed: boolean;
}

/** How the feed reads and maps one kind of calendar. */
interface Spec<T> {
  mine(e: GoogleEvent): boolean;
  /** False for a plain event that left the window (it is then reported as removed). */
  inScope(e: GoogleEvent): boolean;
  map(e: GoogleEvent): T;
  /** The calendar listed in full: its items and (unless `withToken` is false) a fresh sync token. */
  full(withToken?: boolean): Promise<{ upserts: T[]; token?: string }>;
  /** The items entering the window between `fromDate` and the window end (events: all, task lists: repeating ones only). */
  gap(fromDate: string): Promise<T[]>;
}

interface Part<T> { failed?: boolean; replace: boolean; series: string[]; removed: string[]; upserts: T[]; token?: string }

/** Per calendar: its last full read's token, refusals in a row, the back-off, and whether it is compared by content (Google refuses its tokens). */
export interface CalendarHealth { fullToken?: string; refused: number; strikes: number; until: number; tokenless?: boolean }

/** Google refused, a second time in a row, the sync token its own full read just handed out: listing in full again would repeat on every poll. */
class FreshTokenRefusedError extends Error {}

export interface FeedDeps {
  eventCalendars(): Promise<ProviderCalendar[]>;
  tasksId: string;
  toEvent(e: GoogleEvent, cal: ProviderCalendar): CalendarEvent;
  toTaskList(e: GoogleEvent): TaskList;
  /** Per calendar, the time before which no sync token is asked for again (kept by the person's calendar service). */
  noTokenUntil: Map<string, number>;
  /** Per calendar, the refusal back-off (kept by the person's calendar service, shared by the poller and every device). */
  health: Map<string, CalendarHealth>;
  nowMs(): number;
  /** The person's Google contacts and the Birthdays colour their dates take (feature contact-birthdays). */
  contacts?: { source: ContactsSource; color: string };
}

/** The events window kept on a device: today minus a year up to today plus a year (end exclusive). */
export function windowOf(today: string): { from: string; to: string } {
  return { from: addDays(today, -YEAR_BACK), to: addDays(today, YEAR_AHEAD) };
}

export class CalendarChanges {
  /** Errors of a full read that followed a refused (410) sync token: the cursor must not keep that dead token. */
  private readonly afterRefusal = new WeakSet<object>();
  private readonly range: { timeMin: string; timeMax: string; minMs: number; maxMs: number };

  constructor(private readonly provider: CalendarProvider, private readonly tz: string, private readonly deps: FeedDeps, private readonly today: string) {
    const w = windowOf(today);
    const minMs = startOfLocalDay(w.from, tz), maxMs = startOfLocalDay(w.to, tz);
    this.range = { timeMin: formatInZone(minMs, tz), timeMax: formatInZone(maxMs, tz), minMs, maxMs };
  }

  /**
   * The changes of every event calendar and of the tasks calendar since `prev` (null = none: everything in full).
   * `forced` names event calendars to list in full although their token is fine (their events changed without Google
   * knowing, e.g. the person's own reminders on a read-only event).
   */
  async since(prev: FeedState | null, forced: ReadonlySet<string>): Promise<{ events: EventChanges; taskLists: TaskListChanges; state: FeedState }> {
    const cals = await this.deps.eventCalendars();
    const tokens: Record<string, string> = {};
    const events: EventChanges = { calendars: cals.map((c) => c.id), replace: [], series: [], removed: [], upserts: [], failed: [] };
    const eventParts = await Promise.all(cals.map(async (cal) => {
      const part = await this.read(cal.id, prev, forced.has(cal.id), this.eventSpec(cal));
      return { cal, part };
    }));
    for (const { cal, part } of eventParts) {
      if (part.token) tokens[cal.id] = part.token;
      if (part.failed) events.failed.push(cal.id);
      if (part.replace) events.replace.push(cal.id);
      events.series.push(...part.series.map((seriesId) => ({ calendarId: cal.id, seriesId })));
      events.removed.push(...part.removed.map((id) => ({ calendarId: cal.id, id })));
      events.upserts.push(...part.upserts);
    }
    await this.addContacts(prev, events, tokens);
    const tasks = await this.read(this.deps.tasksId, prev, false, this.taskSpec());
    if (tasks.token) tokens[this.deps.tasksId] = tasks.token;
    return {
      events,
      taskLists: { replace: tasks.replace, series: tasks.series, removed: tasks.removed, upserts: tasks.upserts, failed: !!tasks.failed },
      // a calendar that failed keeps the old window end, so the gap it missed is read next time
      state: { to: prev && (events.failed.length || tasks.failed) ? prev.to : windowOf(this.today).to, tokens },
    };
  }

  /** The contacts' dates as one more event source, compared by content; when Google cannot answer the device keeps what it holds. */
  private async addContacts(prev: FeedState | null, events: EventChanges, tokens: Record<string, string>): Promise<void> {
    const c = this.deps.contacts;
    if (!c?.source.enabled) return;
    const held = prev?.tokens[CONTACTS_SOURCE];
    if (!(await c.source.refresh())) {
      if (held !== undefined) { events.calendars.push(CONTACTS_SOURCE); tokens[CONTACTS_SOURCE] = held; }
      return;
    }
    const w = windowOf(this.today);
    const upserts = c.source.events(w.from, w.to, c.color);
    const token = VERSION_PREFIX + createHash('sha1').update(JSON.stringify(upserts)).digest('base64url');
    events.calendars.push(CONTACTS_SOURCE);
    tokens[CONTACTS_SOURCE] = token;
    if (held === token) return;
    events.replace.push(CONTACTS_SOURCE);
    events.upserts.push(...upserts);
  }

  private eventSpec(cal: ProviderCalendar): Spec<CalendarEvent> {
    const p = this.provider;
    const { timeMin, timeMax } = this.range;
    const mine = (e: GoogleEvent) => !isTaskListEvent(e);
    return {
      mine,
      inScope: (e) => this.overlaps(e),
      map: (e) => this.deps.toEvent(e, cal),
      full: async (withToken = true) => {
        // the token comes from a read without the parameters Google refuses together with a sync token (time range, filters); the window read below has them
        const token = withToken ? await this.tokenFor(cal.id) : undefined;
        const win = await p.listEvents({ calendarId: cal.id, timeMin, timeMax });
        return { upserts: win.items.filter((e) => e.status !== 'cancelled' && mine(e)).map((e) => this.deps.toEvent(e, cal)), token };
      },
      gap: async (fromDate) => {
        const win = await p.listEvents({ calendarId: cal.id, timeMin: formatInZone(startOfLocalDay(fromDate, this.tz), this.tz), timeMax });
        return win.items.filter((e) => e.status !== 'cancelled' && mine(e)).map((e) => this.deps.toEvent(e, cal));
      },
    };
  }

  /** A fresh sync token by a token-only page walk; a calendar too large to walk is left alone for a while (its answer is `failed`). */
  private async tokenFor(calendarId: string): Promise<string | undefined> {
    const until = this.deps.noTokenUntil.get(calendarId);
    if (until !== undefined && until > this.deps.nowMs()) throw new ProviderError('Backing off: calendar too large for a sync token');
    try {
      return await this.provider.listSyncToken(calendarId);
    } catch (e) {
      if (e instanceof SyncTokenTooLargeError) this.deps.noTokenUntil.set(calendarId, this.deps.nowMs() + NO_TOKEN_BACKOFF_MS);
      throw e;
    }
  }

  private taskSpec(): Spec<TaskList> {
    const p = this.provider;
    const calendarId = this.deps.tasksId;
    const { timeMin, timeMax } = this.range;
    const mine = isTaskListEvent;
    const repeated = (e: GoogleEvent) => e.status !== 'cancelled' && mine(e) && !!e.recurringEventId;
    return {
      mine,
      inScope: () => true,
      map: (e) => this.deps.toTaskList(e),
      full: async () => {
        // every plain list of any date from the unexpanded read; the instances of repeating lists only inside the window
        const base = await p.listEvents({ calendarId, singleEvents: false, showDeleted: true });
        const win = await p.listEvents({ calendarId, timeMin, timeMax, privateExtendedProperty: ['kind=tasklist'] });
        const plain = base.items.filter((e) => e.status !== 'cancelled' && mine(e) && !e.recurrence?.length && !e.recurringEventId);
        return { upserts: [...plain, ...win.items.filter(repeated)].map((e) => this.deps.toTaskList(e)), token: base.nextSyncToken };
      },
      gap: async (fromDate) => {
        const win = await p.listEvents({ calendarId, timeMin: formatInZone(startOfLocalDay(fromDate, this.tz), this.tz), timeMax, privateExtendedProperty: ['kind=tasklist'] });
        return win.items.filter(repeated).map((e) => this.deps.toTaskList(e));
      },
    };
  }

  /** One calendar: incremental with its token, else (no token, expired, forced, or too far behind) in full. */
  private async read<T>(calendarId: string, prev: FeedState | null, forced: boolean, spec: Spec<T>): Promise<Part<T>> {
    // while backing off the calendar is answered unchanged and loses its token, so the read after the back-off is in full
    const skipped: Part<T> = { replace: false, series: [], removed: [], upserts: [] };
    if ((this.deps.health.get(calendarId)?.until ?? 0) > this.deps.nowMs()) return skipped;
    try {
      return await this.readOrThrow(calendarId, prev, forced, spec);
    } catch (e) {
      if (e instanceof FreshTokenRefusedError) {
        // Google says "full sync required" again for a fresh token: read in full at once and compare by content from now on (no back-off)
        this.health(calendarId).tokenless = true;
        return this.compared(calendarId, prev, forced, spec);
      }
      // the person-wide failures stop the whole answer; one calendar's failure leaves that calendar as the device has it
      // only the provider's own failures degrade; a rate limit, a sign-in problem or a bug (a TypeError) fails the request
      if (!isCalendarFailure(e)) throw e;
      if (e instanceof NotFoundError || e instanceof ProviderForbiddenError) this.strike(calendarId, e instanceof NotFoundError ? 'notFound' : 'forbidden');
      return { failed: true, replace: false, series: [], removed: [], upserts: [], token: this.afterRefusal.has(e as object) ? undefined : prev?.tokens[calendarId] };
    }
  }

  /** Google refused this calendar once more: leave it alone for a while, twice as long each time in a row (logged once per strike). */
  private strike(calendarId: string, cause: string): void {
    const h = this.health(calendarId);
    h.strikes++;
    const backoffMs = Math.min(REFUSED_BACKOFF_MS * 2 ** (h.strikes - 1), REFUSED_BACKOFF_MAX_MS);
    h.until = this.deps.nowMs() + backoffMs;
    h.fullToken = undefined;
    h.refused = 0;
    logEvent('google_calendar_backoff', { calHash: calHash(calendarId), cause, strikes: h.strikes, backoffMs });
  }

  private health(calendarId: string): CalendarHealth {
    let h = this.deps.health.get(calendarId);
    if (!h) this.deps.health.set(calendarId, (h = { refused: 0, strikes: 0, until: 0 }));
    return h;
  }

  private async readOrThrow<T>(calendarId: string, prev: FeedState | null, forced: boolean, spec: Spec<T>): Promise<Part<T>> {
    if (this.health(calendarId).tokenless) return this.compared(calendarId, prev, forced, spec);
    // a content version (left from before a restart) is no sync token: the calendar is read in full
    const kept = prev?.tokens[calendarId];
    const token = kept?.startsWith(VERSION_PREFIX) ? undefined : kept;
    const gap = prev ? dayNumber(windowOf(this.today).to) - dayNumber(prev.to) : 0;
    let refused = false;
    if (token && !forced && gap <= MAX_GAP_DAYS) {
      try {
        const part = await this.incremental(calendarId, token, spec);
        if (gap > 0) part.upserts.push(...(await spec.gap(prev!.to)));
        return part;
      } catch (e) {
        if (!(e instanceof SyncTokenExpiredError)) throw e;
        refused = true;
      }
    }
    const full = await this.fullMarked(spec, refused);
    this.health(calendarId).fullToken = full.token;
    return { replace: true, series: [], removed: [], upserts: full.upserts, token: full.token };
  }

  /** The full read; when it fails right after a refused token the error is marked, so the cursor does not keep that dead token. */
  private async fullMarked<T>(spec: Spec<T>, refused: boolean): Promise<{ upserts: T[]; token?: string }> {
    try {
      return await spec.full();
    } catch (e) {
      if (refused && e instanceof Object) this.afterRefusal.add(e);
      throw e;
    }
  }

  /** A token-less calendar: listed in full, answered as `replace` only when its content moved since the version the device got. */
  private async compared<T>(calendarId: string, prev: FeedState | null, forced: boolean, spec: Spec<T>): Promise<Part<T>> {
    const { upserts } = await spec.full(false);
    // sorted: Google promises no order, and a reordered list is no change
    const token = VERSION_PREFIX + createHash('sha1').update(upserts.map((u) => JSON.stringify(u)).sort().join('\n')).digest('base64url');
    if (!forced && prev?.tokens[calendarId] === token) return { replace: false, series: [], removed: [], upserts: [], token };
    return { replace: true, series: [], removed: [], upserts, token };
  }

  private async incremental<T>(calendarId: string, token: string, spec: Spec<T>): Promise<Part<T>> {
    const h = this.health(calendarId);
    const r = await this.provider.listChanges(calendarId, token).catch((e: unknown) => {
      // one refusal is an ordinary expiry (listed in full once); the fresh token of that full read refused too is a loop (at once after a back-off)
      if (e instanceof SyncTokenExpiredError && token === h.fullToken && ++h.refused >= (h.strikes > 0 ? 1 : 2)) throw new FreshTokenRefusedError();
      throw e;
    });
    // the token works again: forget earlier refusals
    h.refused = 0;
    h.strikes = 0;
    const part: Part<T> = { replace: false, series: [], removed: [], upserts: [], token: r.nextSyncToken ?? token };
    const dirty = new Set<string>();
    for (const e of r.items) {
      if (e.status === 'cancelled') {
        // a cancelled entry has no properties to tell its kind: report it for both and drop its series (a cancelled series has no instances)
        part.removed.push(e.id);
        if (!e.recurringEventId) part.series.push(e.id);
      } else if (e.recurringEventId) dirty.add(e.recurringEventId);
      else if (e.recurrence?.length) { if (spec.mine(e)) dirty.add(e.id); }
      else if (spec.mine(e)) {
        // a series that became a plain event: the device drops the instances it still holds
        part.series.push(e.id);
        if (spec.inScope(e)) part.upserts.push(spec.map(e));
        else part.removed.push(e.id);
      }
    }
    // too many changed series for one call each: a full read of the calendar is cheaper (the caller lists it again)
    if (dirty.size > MAX_SERIES_CALLS) throw new SyncTokenExpiredError('Too many changed series');
    // the instances of a changed series come from Google, which applies the rule, the exceptions and the window
    for (const seriesId of dirty) {
      part.series.push(seriesId);
      for (const i of await this.instances(calendarId, seriesId)) if (spec.mine(i)) part.upserts.push(spec.map(i));
    }
    return part;
  }

  private async instances(calendarId: string, seriesId: string): Promise<GoogleEvent[]> {
    try {
      return await this.provider.listInstances(calendarId, seriesId, this.range.timeMin, this.range.timeMax);
    } catch (e) {
      if (e instanceof NotFoundError) return [];
      throw e;
    }
  }

  /** Whether a plain event lies (at least partly) inside the window. */
  private overlaps(e: GoogleEvent): boolean {
    const s = e.start.date ? startOfLocalDay(e.start.date, this.tz) : Date.parse(e.start.dateTime!);
    const en = e.end.date ? startOfLocalDay(e.end.date, this.tz) : Date.parse(e.end.dateTime!);
    return en > this.range.minMs && s < this.range.maxMs;
  }
}
