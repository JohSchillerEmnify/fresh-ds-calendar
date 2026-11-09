import { notFound, preconditionFailed, validation, ApiException } from '../lib/errors.js';
import { addDays, formatInZone, localDateOf, startOfLocalDay } from '../lib/time.js';
import { NotFoundError, PreconditionFailedError, type CalendarProvider, type GoogleEvent } from '../providers/CalendarProvider.js';
import type { TaskList } from '../api/types.js';
import { decodeTaskList, encodeTaskList, encodeTaskListPatch, nextCompletedOn, type TaskListData } from './taskCodec.js';
import { isSharedId } from './sharedLists.js';

/** What the series logic needs from {@link CalendarService}: the lookups and writes it shares with ordinary list writes. */
export interface SeriesHost {
  locateKind(id: string, tasklist: boolean): Promise<GoogleEvent>;
  modify(id: string, fn: (d: TaskListData) => TaskListData): Promise<TaskList>;
  getTaskList(id: string): Promise<TaskList>;
  checkTaskData(d: TaskListData, before?: TaskListData): void;
  colorFor(d: TaskListData): string | null;
  today(): string;
}

/** Changes to repeating task lists that reach beyond one occurrence: "this and following" splits, first-occurrence lookup, part cleanup. */
export class TaskSeries {
  constructor(private readonly provider: CalendarProvider, private readonly tz: string, private readonly host: SeriesHost) {}

  /**
   * The first occurrence of a repeating list (the instance on the master's own start day, as a range read lists it). An
   * item change addressed to the series lands here, so it becomes an exception of its own (feature adhd-support).
   */
  async firstOccurrence(master: GoogleEvent): Promise<GoogleEvent> {
    const first = await this.occurrenceOn(master, decodeTaskList(master, this.tz).date!); // a repeating list always has a date
    // the first occurrence was deleted (or moved off its day): there is nothing of that week left to change
    if (!first) throw notFound('Task list not found');
    return first;
  }

  /** The local date (and instant, when timed) of an occurrence by its series' rule (`originalStartTime`, else its start). */
  ruleStart(ev: GoogleEvent): { date: string; ms: number | null } {
    const o = ev.originalStartTime ?? ev.start;
    if (o.date) return { date: o.date, ms: null };
    const ms = Date.parse(o.dateTime!);
    return { date: localDateOf(ms, this.tz), ms };
  }

  /** The occurrence of `master` whose rule date is `day`, as a range read of that day lists it; null when there is none. */
  private async occurrenceOn(master: GoogleEvent, day: string): Promise<GoogleEvent | null> {
    const timeMin = formatInZone(startOfLocalDay(day, this.tz), this.tz);
    const timeMax = formatInZone(startOfLocalDay(addDays(day, 1), this.tz), this.tz);
    const r = await this.provider.listEvents({ calendarId: master.calendarId, timeMin, timeMax, privateExtendedProperty: ['kind=tasklist'] });
    return r.items.find((e) => e.recurringEventId === master.id && e.status !== 'cancelled' && this.ruleStart(e).date === day) ?? null;
  }

  /**
   * The series, exceptions and other events of a calendar in one read, cancelled exceptions too, for finding a series'
   * exceptions. Read without the property filter: Google only guarantees `id`,
   * `recurringEventId` and `originalStartTime` on a cancelled exception (events resource, `status`), so a filter on our
   * private properties would miss the deleted weeks. Without singleEvents Google lists each series once and its
   * exceptions as events of their own.
   */
  private async seriesEvents(calendarId: string): Promise<GoogleEvent[]> {
    return (await this.provider.listEvents({ calendarId, singleEvents: false, showDeleted: true })).items;
  }

  /** The exceptions of `master` in one read of {@link CalendarService.seriesEvents}. */
  private exceptionsIn(all: GoogleEvent[], master: GoogleEvent): GoogleEvent[] {
    return all.filter((e) => e.recurringEventId === master.id);
  }

  /** Every live series ("part") of a repeating list in one read: the first one (`root`) and those split from it (private `series`). */
  private partsIn(all: GoogleEvent[], root: string): GoogleEvent[] {
    return all.filter((e) => e.recurrence?.length && !e.recurringEventId && e.status !== 'cancelled'
      && (e.id === root || e.extendedProperties?.private?.series === root));
  }

  /** `change` for a whole series: the series itself (which its plain occurrences follow) and each live exception (ticks kept). */
  private async forWhole(master: GoogleEvent, change: (d: TaskListData) => TaskListData, exceptions: GoogleEvent[]): Promise<void> {
    await this.host.modify(master.id, change);
    for (const e of exceptions) if (e.status !== 'cancelled') await this.host.modify(e.id, change);
  }

  /** The bound a series' rule sets (RFC 5545 `UNTIL`, inclusive): the local date of its last possible occurrence; null = none. */
  private untilOf(master: GoogleEvent): string | null {
    const u = /UNTIL=(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?/.exec(ruleLine(master));
    if (!u) return null;
    return u[4] ? localDateOf(Date.parse(`${u[1]}-${u[2]}-${u[3]}T${u[4]}:${u[5]}:${u[6]}Z`), this.tz) : `${u[1]}-${u[2]}-${u[3]}`;
  }

  /**
   * A change for this and all following occurrences of a repeating list (feature tasklist-repeating;
   * Google's "This and following events"). Earlier occurrences never change. The Calendar API has no such operation:
   * like Google Calendar itself, the series is split. Every later part of the list (same `series` key) gets the change as a
   * whole; in the part holding the shown occurrence, the shown one gets it, a new series takes over the later ones (with
   * the part's own bound) and the part ends with the shown one. From a part's first occurrence nothing is split.
   * `check` runs on the shown occurrence first (unknown item → 404) so a refused change writes nothing.
   */
  async forFollowing(id: string, change: (d: TaskListData) => TaskListData, check?: (d: TaskListData) => void): Promise<TaskList> {
    const cur = isSharedId(id) ? null : await this.host.locateKind(id, true);
    const seriesId = cur?.recurringEventId ?? (cur?.recurrence?.length ? cur.id : null);
    if (!cur || !seriesId) throw validation('This list does not repeat', 'scope');
    check?.(decodeTaskList(cur, this.tz));
    const master = cur.id === seriesId ? cur : await this.host.locateKind(seriesId, true);
    // a rule that ends after a number of times cannot be cut at a date without counting it out: not split
    if (/[:;]COUNT=/.test(ruleLine(master))) throw validation('This list repeats a set number of times; change it in Google Calendar', 'scope');
    const root = master.extendedProperties?.private?.series ?? master.id;
    const shown = this.ruleStart(cur);
    const all = await this.seriesEvents(master.calendarId);
    const parts = this.partsIn(all, root);
    // every later part of the list gets the change as a whole
    for (const part of parts) if (part.id !== master.id && this.ruleStart(part).date > shown.date) await this.forWhole(part, change, this.exceptionsIn(all, part));
    if (shown.date <= this.ruleStart(master).date) {
      // the part's first occurrence: there is nothing earlier in it to keep
      await this.forWhole(master, change, this.exceptionsIn(all, master));
      return this.host.getTaskList(id);
    }
    // the shown occurrence: an exception of the old series from now on
    await this.host.modify(cur.id, change);
    await this.splitAt(master, shown, change, parts);
    return this.host.getTaskList(id);
  }

  /** The first live occurrence of `master` after `day` within `days` days; null when none. */
  private async nextOccurrence(master: GoogleEvent, day: string, days: number): Promise<GoogleEvent | null> {
    const timeMin = formatInZone(startOfLocalDay(addDays(day, 1), this.tz), this.tz);
    const timeMax = formatInZone(startOfLocalDay(addDays(day, days + 1), this.tz), this.tz);
    const r = await this.provider.listEvents({ calendarId: master.calendarId, timeMin, timeMax, privateExtendedProperty: ['kind=tasklist'] });
    const later = r.items.filter((e) => e.recurringEventId === master.id && e.status !== 'cancelled' && this.ruleStart(e).date > day);
    later.sort((x, y) => (this.ruleStart(x).date < this.ruleStart(y).date ? -1 : 1));
    return later[0] ?? null;
  }

  /**
   * Splits `master` after the shown occurrence (Google Calendar's "This and following"). The new series starts at the
   * earliest later occurrence by rule date — the next live one or any later exception, also one moved far away or a
   * deleted one — and copies the old series' recurrence lines (so it keeps the old bound); a series an earlier, unfinished
   * try already made there is used again. Each later exception is carried over to the new series' occurrence of the same
   * rule date (its own data plus `change`; a deleted one deletes it) and then deleted. Only when nothing is left to carry
   * does the old series end with the shown occurrence (`UNTIL`, written with If-Match): a failure on the way leaves
   * duplicates, never a lost week.
   */
  private async splitAt(master: GoogleEvent, shown: { date: string; ms: number | null }, change: (d: TaskListData) => TaskListData, parts: GoogleEvent[]): Promise<void> {
    const root = master.extendedProperties?.private?.series ?? master.id;
    const bound = this.untilOf(master);
    const inPart = (e: GoogleEvent) => { const d = this.ruleStart(e).date; return d > shown.date && (bound === null || d <= bound); };
    let fresh: GoogleEvent | null = null;
    // only a new series made by this request may lose a plain week (one deleted before in the old series); a reused one never
    let made = false;
    // the dates this request carried over: never taken for a plain week, whatever a lagging list read says
    const carried = new Set<string>();
    for (let attempt = 1; attempt <= 3; attempt++) {
      // one read per pass: the old series' later exceptions and what the new series has at each date
      const all = await this.seriesEvents(master.calendarId);
      const later = this.exceptionsIn(all, master).filter(inPart);
      if (!fresh) {
        const next = (await this.nextOccurrence(master, shown.date, 62)) ?? (bound === null ? await this.nextOccurrence(master, shown.date, 400) : null);
        const starts = [...(next ? [this.ruleStart(next).date] : []), ...later.map((e) => this.ruleStart(e).date)].sort();
        // nothing after the shown occurrence in this part: it ends there already
        if (!starts.length) {
          if (bound === null) throw new ApiException('PROVIDER_ERROR', 502, 'No later task list of this series was found to change');
          return;
        }
        fresh = parts.find((p) => p.id !== master.id && this.ruleStart(p).date === starts[0]) ?? null;
        if (!fresh) {
          fresh = await this.newPart(master, starts[0]!, root, change);
          made = true;
        }
      }
      const target = fresh;
      const own = new Map(this.exceptionsIn(all, target).map((x) => [this.ruleStart(x).date, x] as const));
      for (const e of later) await this.carry(e, target, change, own, made, carried);
      // anything that came in meanwhile is carried first; the old series ends only when nothing later is left in it
      const cur = await this.host.locateKind(master.id, true);
      if (this.exceptionsIn(await this.seriesEvents(master.calendarId), master).some((e) => e.status !== 'cancelled' && inPart(e))) continue;
      try {
        await this.provider.patchEvent(cur.calendarId, cur.id, { recurrence: withUntil(cur.recurrence ?? [], untilValue(shown)) }, { ifMatch: cur.etag });
        return;
      } catch (e) {
        if (!(e instanceof PreconditionFailedError)) throw e;
      }
    }
    throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
  }

  /** A new series ("part") of the list from `start` on: the old series' data plus `change`, its RRULE and EXDATE lines, `series` = root. */
  private async newPart(master: GoogleEvent, start: string, root: string, change: (d: TaskListData) => TaskListData): Promise<GoogleEvent> {
    const base = { ...decodeTaskList(master, this.tz), date: start, completedOn: null };
    const d = change(base);
    this.host.checkTaskData(d, base);
    const g = encodeTaskList(d, this.tz, this.host.colorFor(d));
    // the rule and its exclusions; an RDATE (an extra date) belongs to the old series only
    g.recurrence = (master.recurrence ?? []).filter((l) => l.startsWith('RRULE:') || l.startsWith('EXDATE'));
    g.extendedProperties!.private!.series = root;
    if (master.reminders) g.reminders = master.reminders;
    return this.provider.insertEvent(master.calendarId, g);
  }

  /**
   * Carries one later exception of the old series over to `fresh`'s occurrence of the same rule date. `own` holds the new
   * series' exceptions by rule date (kept up to date here). A deleted one deletes the new series' occurrence only when this
   * request made the new series and has not carried that date itself; a reused series keeps every week. A
   * live one gives the occurrence its own data (ticks, times, reminders) plus `change` and is then deleted; when that week
   * was deleted in the new series already, 409 (the person decides which copy goes). An occurrence that cannot be found
   * stops the split before the old series is ended (nothing is lost).
   */
  private async carry(
    e: GoogleEvent, fresh: GoogleEvent, change: (d: TaskListData) => TaskListData, own: Map<string, GoogleEvent>, made: boolean, carried: Set<string>,
  ): Promise<void> {
    const day = this.ruleStart(e).date;
    const had = own.get(day);
    if (e.status === 'cancelled') {
      // a week deleted in the old series is deleted in the new one only by the request that made it, and never a date it
      // carried itself; a reused series keeps every week (a deleted one may come back once, nothing is lost)
      if (had || !made || carried.has(day)) return;
      const found = await this.occurrenceOn(fresh, day);
      if (found) {
        await this.provider.deleteEvent(fresh.calendarId, found.id);
        own.set(day, { ...found, status: 'cancelled' });
        carried.add(day);
      }
      return;
    }
    // a split left half done showed the week twice and the new copy was deleted: which copy stays is the person's call
    // (the old one keeps its ticks; nothing is deleted or restored here)
    if (had?.status === 'cancelled') {
      throw new ApiException('CONFLICT', 409, `This list shows twice on ${day}; delete the other copy, then try again`, [{ field: 'date', issue: day }], 'tasklist.showsTwice');
    }
    // an earlier pass may have carried (and moved) it already: its exception in the new series is the one to write
    const inst = had ?? await this.occurrenceOn(fresh, day);
    if (!inst) throw new ApiException('PROVIDER_ERROR', 502, 'A later task list could not be carried over; nothing was ended');
    const data = decodeTaskList(e, this.tz);
    const dd = change(data);
    dd.completedOn = nextCompletedOn(data, dd, this.host.today());
    const patch = encodeTaskListPatch(dd, this.tz, this.host.colorFor(dd), inst);
    if (e.reminders) patch.reminders = e.reminders;
    own.set(day, await this.provider.patchEvent(fresh.calendarId, inst.id, patch, { ifMatch: inst.etag }));
    carried.add(day);
    await this.deleteOld(e);
  }

  /** Deletes an old exception that was carried over (already gone counts as done). */
  private async deleteOld(e: GoogleEvent): Promise<void> {
    try {
      await this.provider.deleteEvent(e.calendarId, e.id);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
    }
  }

  /** Deletes the later parts of a series split by "this and following" (same `series` key, later start) after `cur` was deleted. */
  async deleteLaterParts(cur: GoogleEvent): Promise<void> {
    const root = cur.extendedProperties?.private?.series ?? cur.id;
    const r = await this.provider.listEvents({ calendarId: cur.calendarId, privateExtendedProperty: ['kind=tasklist', `series=${root}`], singleEvents: false });
    const from = this.ruleStart(cur).date;
    for (const e of r.items) {
      if (e.recurrence?.length && !e.recurringEventId && e.status !== 'cancelled' && e.id !== cur.id && this.ruleStart(e).date > from) await this.provider.deleteEvent(e.calendarId, e.id);
    }
  }
}

/** The RRULE line of a series (other lines, e.g. EXDATE, may come first). */
const ruleLine = (m: GoogleEvent): string => m.recurrence?.find((l) => l.startsWith('RRULE:')) ?? '';

/** The recurrence lines with the RRULE ended at `until` (any UNTIL / COUNT replaced, other lines and parts kept). */
const withUntil = (lines: string[], until: string): string[] => lines.map((l) => (l.startsWith('RRULE:')
  ? `RRULE:${[...l.slice(6).split(';').filter((x) => x && !/^(UNTIL|COUNT)=/.test(x)), `UNTIL=${until}`].join(';')}` : l));

/** RFC 5545 UNTIL of an occurrence's rule start: a date for an all-day series, the UTC instant for a timed one. */
const untilValue = (at: { date: string; ms: number | null }): string => (at.ms === null
  ? at.date.replaceAll('-', '') : new Date(at.ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));
