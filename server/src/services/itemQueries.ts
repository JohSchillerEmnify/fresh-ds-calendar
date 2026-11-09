import type { CalendarEvent, CalendarItem, Category, SummaryDay, TaskList } from '../api/types.js';
import { dedupeBirthdays } from '@calendar/shared/birthdays';
import type { Clock } from '../lib/clock.js';
import { addDays, formatInZone, localDateOf, startOfLocalDay, zonedToUtc } from '../lib/time.js';
import type { CalendarProvider, GoogleEvent, GoogleReminder, ProviderCalendar } from '../providers/CalendarProvider.js';
import type { SettingsStore } from './settingsStore.js';
import { BIRTHDAYS_ID } from './eventRules.js';
import { isTaskListEvent, isUndatedEvent } from './taskCodec.js';
import type { TasksCalendar } from './tasksCalendar.js';

/** What the read queries need from {@link CalendarService}: the calendar list and the mapping of Google events. */
export interface QueryHost {
  eventCalendars(): Promise<ProviderCalendar[]>;
  toEvent(ev: GoogleEvent, calColor: string, calDefaults?: GoogleReminder[]): CalendarEvent;
  toTaskList(ev: GoogleEvent, calColor: string, cats: Category[]): TaskList;
  sharedTaskLists(fallbackColor: string): TaskList[];
  calendarColor(id: string): Promise<string>;
  calendarColorSync(id: string): string;
  stale(): boolean;
}

/** Read side of the calendar: item ranges, the open and archived task lists, and the per-day summary. */
export class ItemQueries {
  constructor(
    private readonly provider: CalendarProvider, private readonly settings: SettingsStore, private readonly tasks: TasksCalendar,
    private readonly clock: Clock, private readonly sub: string, private readonly tz: string, private readonly host: QueryHost,
  ) {}

  /** Events of the event calendars plus the task lists of the tasks calendar (`calendarIds` narrows both). */
  async fetchRange(from: string, to: string, calendarIds?: string[], tasklistsOnly = false): Promise<CalendarItem[]> {
    const tasksId = await this.tasks.id();
    // birthdays live in any calendar, so asking for them reads them all; the result is narrowed by the id each event shows
    const readAll = !calendarIds || calendarIds.includes(BIRTHDAYS_ID);
    const cals = tasklistsOnly ? [] : (await this.host.eventCalendars()).filter((c) => readAll || calendarIds.includes(c.id));
    const timeMin = formatInZone(startOfLocalDay(from, this.tz), this.tz);
    const timeMax = formatInZone(startOfLocalDay(to, this.tz), this.tz);
    const cats = this.settings.categories(this.sub);
    const eventLists = cals.map(async (c) => {
      const r = await this.provider.listEvents({ calendarId: c.id, timeMin, timeMax });
      // task-list-shaped events outside the tasks calendar are not task lists (ADR 0006)
      return r.items.filter((e) => e.status !== 'cancelled' && !isTaskListEvent(e)).map((e): CalendarItem => this.host.toEvent(e, c.backgroundColor, c.defaultReminders))
        .filter((i) => !calendarIds || calendarIds.includes(i.calendarId));
    });
    const taskLists = (async (): Promise<CalendarItem[]> => {
      if (calendarIds && !calendarIds.includes(tasksId)) return [];
      const r = await this.provider.listEvents({ calendarId: tasksId, timeMin, timeMax, privateExtendedProperty: ['kind=tasklist'] });
      const color = await this.host.calendarColor(tasksId);
      // undated lists sit on the anchor date: a range that reaches it must not show them
      return r.items.filter((e) => e.status !== 'cancelled' && isTaskListEvent(e) && !isUndatedEvent(e)).map((e): CalendarItem => this.host.toTaskList(e, color, cats));
    })();
    const sharedLists = (): CalendarItem[] => {
      if (calendarIds && !calendarIds.includes(tasksId)) return [];
      const color = this.host.calendarColorSync(tasksId);
      return this.host.sharedTaskLists(color).filter((l) => l.date !== null && l.date >= from && l.date < to);
    };
    const [events, ...rest] = await Promise.all([Promise.all(eventLists), taskLists]);
    return [...dedupeBirthdays(events.flat() as CalendarEvent[]), ...rest.flat(), ...sharedLists()];
  }

  private sortKey(i: CalendarItem): [string, number, number, string] {
    if (i.kind === 'tasklist') {
      const date = i.date!; // ranges hold dated lists only
      return i.time === null ? [date, 0, 0, i.title] : [date, 1, zonedToUtc(date, i.time, this.tz), i.title];
    }
    if (i.allDay) return [i.start, 0, 0, i.title];
    const ms = Date.parse(i.start);
    return [localDateOf(ms, this.tz), 1, ms, i.title];
  }

  /** Items of `[from, to)`, plus those of the optional `also` range (deduplicated by id; API.md `GET /api/items`). */
  async items(
    from: string, to: string, calendarIds?: string[], also?: { from: string; to: string },
  ): Promise<{ items: CalendarItem[]; from: string; to: string; also?: { from: string; to: string }; syncedAt: string; stale?: true }> {
    const lists = await Promise.all([this.fetchRange(from, to, calendarIds), ...(also ? [this.fetchRange(also.from, also.to, calendarIds)] : [])]);
    const items = [...new Map(lists.flat().map((i) => [i.id, i])).values()];
    const keyed = items.map((i) => ({ i, k: this.sortKey(i) }));
    keyed.sort((a, b) => a.k[0].localeCompare(b.k[0]) || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3].localeCompare(b.k[3]));
    return { items: keyed.map((x) => x.i), from, to, ...(also ? { also } : {}), syncedAt: formatInZone(this.clock.real(), this.tz), ...(this.host.stale() ? { stale: true as const } : {}) };
  }

  /** Open lists and lists finished today, both dated in `[today - days, today]`, in tray order (API.md). */
  async openTaskLists(today: string, days: number): Promise<{ items: TaskList[]; finishedToday: TaskList[] }> {
    const all = await this.fetchRange(addDays(today, -days), addDays(today, 1), undefined, true);
    const lists = all.filter((i): i is TaskList => i.kind === 'tasklist' && i.date !== null && i.date >= addDays(today, -days) && i.date <= today);
    lists.sort((a, b) => a.date!.localeCompare(b.date!) || Number(a.time !== null) - Number(b.time !== null) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
    return {
      items: lists.filter((l) => l.doneCount < l.totalCount),
      finishedToday: lists.filter((l) => l.completedOn === today && l.totalCount > 0 && l.doneCount === l.totalCount),
    };
  }

  /** Every open task list for the Tasks view: undated ones plus those dated within a year of `today` (API.md). */
  async allOpenTaskLists(today: string): Promise<{ items: TaskList[] }> {
    const tasksId = await this.tasks.id();
    const [dated, undated] = await Promise.all([
      this.fetchRange(addDays(today, -365), addDays(today, 366), undefined, true),
      // by their property alone: they sit on the anchor date, far outside any range
      this.provider.listEvents({ calendarId: tasksId, privateExtendedProperty: ['kind=tasklist', 'undated=1'] }),
    ]);
    const color = await this.host.calendarColor(tasksId);
    const cats = this.settings.categories(this.sub);
    // keyed by id: a dated shared list is in the range read and in the full list of shared lists
    const lists = [...new Map([
      ...dated.filter((i): i is TaskList => i.kind === 'tasklist'),
      ...undated.items.filter((e) => e.status !== 'cancelled').map((e) => this.host.toTaskList(e, color, cats)),
      ...this.host.sharedTaskLists(color),
    ].map((l) => [l.id, l])).values()];
    // a list is open until all of its items are ticked (a list without items is still open)
    return { items: lists.filter((l) => l.totalCount === 0 || l.doneCount < l.totalCount) };
  }

  /**
   * Every finished task list for the Archive: the lists carrying the `done=1` marker (any age, undated ones too) plus
   * the finished lists dated within a year of `today`, which covers lists written before the marker existed (API.md).
   */
  async archivedTaskLists(today: string): Promise<{ items: TaskList[] }> {
    const tasksId = await this.tasks.id();
    const [dated, marked] = await Promise.all([
      this.fetchRange(addDays(today, -365), addDays(today, 366), undefined, true),
      this.provider.listEvents({ calendarId: tasksId, privateExtendedProperty: ['kind=tasklist', 'done=1'] }),
    ]);
    const color = await this.host.calendarColor(tasksId);
    const cats = this.settings.categories(this.sub);
    // keyed by id so a list found twice (marker and range) is returned once
    const byId = new Map<string, TaskList>();
    for (const i of dated) if (i.kind === 'tasklist') byId.set(i.id, i);
    for (const e of marked.items) if (e.status !== 'cancelled') byId.set(e.id, this.host.toTaskList(e, color, cats));
    for (const l of this.host.sharedTaskLists(color)) byId.set(l.id, l);
    return { items: [...byId.values()].filter((l) => l.totalCount > 0 && l.doneCount >= l.totalCount) };
  }

  async summary(from: string, to: string): Promise<Record<string, SummaryDay>> {
    const days: Record<string, SummaryDay> = {};
    for (let a = from; a < to; a = addDays(a, 100)) {
      const b = addDays(a, 100) < to ? addDays(a, 100) : to;
      for (const it of await this.fetchRange(a, b)) {
        let first: string, last: string;
        if (it.kind === 'tasklist') first = last = it.date!;
        else if (it.allDay) { first = it.start; last = addDays(it.end, -1); }
        else {
          first = localDateOf(Date.parse(it.start), this.tz);
          const endMs = Date.parse(it.end);
          last = localDateOf(endMs - 1, this.tz);
          if (last < first) last = first;
        }
        for (let d = first < a ? a : first; d <= last && d < b; d = addDays(d, 1)) {
          const row = (days[d] ??= { events: 0, tasklists: 0, openTasklists: 0, density: 0 });
          if (it.kind === 'tasklist') { row.tasklists++; if (it.doneCount < it.totalCount) row.openTasklists++; } else row.events++;
        }
      }
    }
    for (const r of Object.values(days)) {
      const n = r.events + r.tasklists;
      r.density = n >= 4 ? 3 : n >= 2 ? 2 : 1;
    }
    return days;
  }
}
