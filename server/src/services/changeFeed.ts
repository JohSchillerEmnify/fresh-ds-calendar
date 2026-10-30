/**
 * The Google side of "changes since" (ADR 0025, `GET /api/changes`): one person's events and task lists read through
 * sync tokens, one token per calendar, so a poll costs one call per calendar. An expired token (410) or a calendar the
 * device has no token for is listed in full and answered as `replace`. Repeating events are read unexpanded in the
 * change stream (a sync token cannot carry a time range) and their instances in the window are asked for per changed series.
 */
import type { CalendarEvent, TaskList } from '../api/types.js';
import { addDays, dayNumber, startOfLocalDay, formatInZone } from '../lib/time.js';
import { NotFoundError, SyncTokenExpiredError, type CalendarProvider, type GoogleEvent, type ProviderCalendar } from '../providers/CalendarProvider.js';
import { isTaskListEvent } from './taskCodec.js';

/** Days of window end the device may be behind before a calendar is simply listed again. */
const MAX_GAP_DAYS = 31;
const YEAR_BACK = 365;
const YEAR_AHEAD = 366;

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
}

export interface TaskListChanges {
  /** The tasks calendar was answered in full: the device drops all its (non-shared) lists first. */
  replace: boolean;
  series: string[];
  removed: string[];
  upserts: TaskList[];
}

/** How the feed reads and maps one kind of calendar. */
interface Spec<T> {
  mine(e: GoogleEvent): boolean;
  /** False for a plain event that left the window (it is then reported as removed). */
  inScope(e: GoogleEvent): boolean;
  map(e: GoogleEvent): T;
  /** The calendar listed in full: its items and a fresh sync token. */
  full(): Promise<{ upserts: T[]; token?: string }>;
  /** The items entering the window between `fromDate` and the window end (events: all, task lists: repeating ones only). */
  gap(fromDate: string): Promise<T[]>;
}

interface Part<T> { replace: boolean; series: string[]; removed: string[]; upserts: T[]; token?: string }

export interface FeedDeps {
  eventCalendars(): Promise<ProviderCalendar[]>;
  tasksId: string;
  toEvent(e: GoogleEvent, cal: ProviderCalendar): CalendarEvent;
  toTaskList(e: GoogleEvent): TaskList;
}

/** The events window kept on a device: today minus a year up to today plus a year (end exclusive). */
export function windowOf(today: string): { from: string; to: string } {
  return { from: addDays(today, -YEAR_BACK), to: addDays(today, YEAR_AHEAD) };
}

export class CalendarChanges {
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
    const events: EventChanges = { calendars: cals.map((c) => c.id), replace: [], series: [], removed: [], upserts: [] };
    const eventParts = await Promise.all(cals.map(async (cal) => {
      const part = await this.read(cal.id, prev, forced.has(cal.id), this.eventSpec(cal));
      return { cal, part };
    }));
    for (const { cal, part } of eventParts) {
      if (part.token) tokens[cal.id] = part.token;
      if (part.replace) events.replace.push(cal.id);
      events.series.push(...part.series.map((seriesId) => ({ calendarId: cal.id, seriesId })));
      events.removed.push(...part.removed.map((id) => ({ calendarId: cal.id, id })));
      events.upserts.push(...part.upserts);
    }
    const tasks = await this.read(this.deps.tasksId, prev, false, this.taskSpec());
    if (tasks.token) tokens[this.deps.tasksId] = tasks.token;
    return {
      events,
      taskLists: { replace: tasks.replace, series: tasks.series, removed: tasks.removed, upserts: tasks.upserts },
      state: { to: windowOf(this.today).to, tokens },
    };
  }

  private eventSpec(cal: ProviderCalendar): Spec<CalendarEvent> {
    const p = this.provider;
    const { timeMin, timeMax } = this.range;
    const mine = (e: GoogleEvent) => !isTaskListEvent(e);
    return {
      mine,
      inScope: (e) => this.overlaps(e),
      map: (e) => this.deps.toEvent(e, cal),
      full: async () => {
        // the token comes from an unexpanded read: it cannot be asked together with a time range, and the window read below needs one
        const base = await p.listEvents({ calendarId: cal.id, singleEvents: false, showDeleted: true, timeMin });
        const win = await p.listEvents({ calendarId: cal.id, timeMin, timeMax });
        return { upserts: win.items.filter((e) => e.status !== 'cancelled' && mine(e)).map((e) => this.deps.toEvent(e, cal)), token: base.nextSyncToken };
      },
      gap: async (fromDate) => {
        const win = await p.listEvents({ calendarId: cal.id, timeMin: formatInZone(startOfLocalDay(fromDate, this.tz), this.tz), timeMax });
        return win.items.filter((e) => e.status !== 'cancelled' && mine(e)).map((e) => this.deps.toEvent(e, cal));
      },
    };
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
    const token = prev?.tokens[calendarId];
    const gap = prev ? dayNumber(windowOf(this.today).to) - dayNumber(prev.to) : 0;
    if (token && !forced && gap <= MAX_GAP_DAYS) {
      try {
        const part = await this.incremental(calendarId, token, spec);
        if (gap > 0) part.upserts.push(...(await spec.gap(prev!.to)));
        return part;
      } catch (e) {
        if (!(e instanceof SyncTokenExpiredError)) throw e;
      }
    }
    const full = await spec.full();
    return { replace: true, series: [], removed: [], upserts: full.upserts, token: full.token };
  }

  private async incremental<T>(calendarId: string, token: string, spec: Spec<T>): Promise<Part<T>> {
    const r = await this.provider.listChanges(calendarId, token);
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
        if (spec.inScope(e)) part.upserts.push(spec.map(e));
        else part.removed.push(e.id);
      }
    }
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
