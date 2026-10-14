import type {
  Calendar, CalendarEvent, CalendarItem, Category, CategoryInfo, CreateEventInput, CreateTaskListInput, SummaryDay, TaskItem, TaskList, Person,
  UpdateEventInput, UpdateTaskListInput,
} from '../api/types.js';
import type { AppConfig } from '../config.js';
import type { Clock } from '../lib/clock.js';
import { GOOGLE_COLORS } from '../lib/colors.js';
import { ApiException, forbidden, notFound, preconditionFailed, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { addDays, dayNumber, formatInZone, isDateTime, isLocalDate, localDateOf, localTimeOf, startOfLocalDay, zonedToUtc } from '../lib/time.js';
import {
  NotFoundError, PreconditionFailedError, type CalendarProvider, type GoogleEvent, type GoogleEventInput, type GoogleEventPatch,
  type ProviderCalendar,
} from '../providers/CalendarProvider.js';
import type { MotivationService } from './motivation.js';
import type { PrefsStore } from './prefsStore.js';
import type { SettingsStore } from './settingsStore.js';
import {
  categoryColorId, dateOnCompletion, decodeTaskList, encodePrivate, encodeTaskList, encodeTaskListPatch, isTaskListEvent, isUndatedEvent, MAX_PRIVATE_BYTES,
  nextCompletedOn, privateSize,
  type TaskListData,
} from './taskCodec.js';
import { TasksCalendar } from './tasksCalendar.js';
import { isSharedId, SHARED_CALENDAR, SHARED_PREFIX, type SharedListDoc, type SharedListService } from './sharedLists.js';

const DAY = 86_400_000;
const CAL_TTL_MS = 30_000;
/** Calendar id prefix of Google's contacts "Birthdays" calendar (`addressbook#contacts@group.v.calendar.google.com`). */
const BIRTHDAY_CALENDAR_PREFIX = 'addressbook#contacts@';

/** Birthday kind of a Google event: by `eventType`, or by living in the contacts Birthdays calendar; `undefined` for ordinary events. */
function specialOf(ev: GoogleEvent): CalendarEvent['special'] {
  if (ev.eventType !== 'birthday' && !ev.calendarId.startsWith(BIRTHDAY_CALENDAR_PREFIX)) return undefined;
  return ev.birthdayProperties?.type === 'anniversary' ? 'anniversary' : 'birthday';
}

const readOnlyBirthday = () => validation('Birthdays are read-only');

export class CalendarService {
  private calCache: { at: number; cals: ProviderCalendar[] } | null = null;
  /** Test/seed hook: insert with a caller-chosen event id (mock only). */
  rawInsert?: (calendarId: string, ev: GoogleEventInput & { id: string }) => Promise<GoogleEvent>;
  /** The person's hidden "Calendar app: tasks" calendar: the only place task lists are read and written. */
  readonly tasks: TasksCalendar;

  constructor(
    private readonly provider: CalendarProvider,
    private readonly settings: SettingsStore,
    private readonly motivation: MotivationService,
    private readonly clock: Clock,
    private readonly config: Pick<AppConfig, 'tz'>,
    private readonly prefs: PrefsStore,
    private readonly sub: string,
    /** Shared lists (ARCHITECTURE "Shared lists"); null where sharing is not wired (some unit tests). */
    private readonly shared: SharedListService | null = null,
  ) {
    this.tasks = new TasksCalendar(provider, prefs, sub, () => this.providerCalendars(), () => { this.calCache = null; });
  }

  private get tz() { return this.config.tz; }
  invalidate(): void {
    this.calCache = null;
    this.tasks.forget();
  }

  // ---------- calendars ----------
  private async providerCalendars(): Promise<ProviderCalendar[]> {
    const now = this.clock.real();
    if (this.calCache && now - this.calCache.at < CAL_TTL_MS) return this.calCache.cals;
    const cals = await this.provider.listCalendars();
    this.calCache = { at: now, cals };
    return cals;
  }

  /** Calendars that hold events: not switched off in Google's list and not the tasks calendar. */
  private async eventCalendars(): Promise<ProviderCalendar[]> {
    const tasksId = this.tasks.knownId();
    return (await this.providerCalendars()).filter((c) => !c.hidden && c.id !== tasksId);
  }

  async calendars(): Promise<Calendar[]> {
    this.calCache = null; // the endpoint always hits the provider (outages must surface)
    return (await this.eventCalendars()).map((c) => ({
      id: c.id, name: c.summary, color: c.backgroundColor, primary: c.primary, writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }));
  }

  private async primaryId(): Promise<string> {
    const cals = await this.eventCalendars();
    return (cals.find((c) => c.primary) ?? cals[0])?.id ?? 'primary';
  }

  private async calendarColor(id: string): Promise<string> {
    return (await this.providerCalendars()).find((c) => c.id === id)?.backgroundColor ?? '#039be5';
  }

  /** The colour of a calendar from the cached list (the lookup that precedes it filled the cache). */
  private calendarColorSync(id: string): string {
    return this.calCache?.cals.find((c) => c.id === id)?.backgroundColor ?? '#039be5';
  }

  private async requireCalendar(id: string): Promise<void> {
    if (!(await this.eventCalendars()).some((c) => c.id === id)) throw validation('Unknown calendar', 'calendarId');
  }

  // ---------- mapping ----------
  private norm(dt: { date?: string; dateTime?: string }): string {
    return dt.date ?? formatInZone(Date.parse(dt.dateTime!), this.tz);
  }

  private toEvent(ev: GoogleEvent, calColor: string): CalendarEvent {
    const special = specialOf(ev);
    // birthdays always use the colour of their calendar (a stray event colour would hide where they come from)
    const colorId = !special && ev.colorId && GOOGLE_COLORS[ev.colorId] ? ev.colorId : null;
    return {
      kind: 'event', id: ev.id, calendarId: ev.calendarId, title: ev.summary ?? '', description: ev.description ?? '', location: ev.location ?? '',
      allDay: !!ev.start.date, start: this.norm(ev.start), end: this.norm(ev.end), colorId,
      color: colorId ? GOOGLE_COLORS[colorId]!.hex : calColor, ...(special ? { special } : {}), etag: ev.etag, updated: ev.updated,
    };
  }

  private toTaskList(ev: GoogleEvent, calColor: string, cats: Category[]): TaskList {
    const d = decodeTaskList(ev, this.tz);
    const cat = cats.find((c) => c.id === d.categoryId);
    const done = d.items.filter((i) => i.done).length;
    return {
      kind: 'tasklist', id: ev.id, calendarId: ev.calendarId, title: d.title, date: d.date, time: d.time, items: d.items, doneCount: done,
      totalCount: d.items.length, estimateMinutes: d.estimateMinutes, recurrence: d.recurrence, categoryId: cat ? cat.id : null,
      tags: d.tags, color: cat ? cat.color : calColor, calendarColor: calColor, completedOn: d.completedOn, canvas: d.canvas, etag: ev.etag, updated: ev.updated,
    };
  }

  /** A shared list as the API shows it to this person: the owner's category look comes from the list. */
  private toSharedTaskList(doc: SharedListDoc, fallbackColor: string): TaskList {
    const d = doc.data;
    const live = doc.owner === this.sub ? this.settings.categories().find((c) => c.id === d.categoryId) : undefined;
    const info: CategoryInfo | null = live ? { name: live.name, color: live.color, icon: live.icon } : doc.category;
    const done = d.items.filter((i) => i.done).length;
    return {
      kind: 'tasklist', id: SHARED_PREFIX + doc.id, calendarId: SHARED_CALENDAR, title: d.title, date: d.date, time: d.time, items: d.items,
      doneCount: done, totalCount: d.items.length, estimateMinutes: d.estimateMinutes, recurrence: null, categoryId: d.categoryId, tags: d.tags,
      color: info?.color ?? fallbackColor, calendarColor: fallbackColor, completedOn: d.completedOn, canvas: d.canvas, etag: `"${doc.rev}"`, updated: doc.updated,
      shared: this.shared!.info(doc, this.sub), categoryInfo: info,
    };
  }

  /** Every shared list this person owns or is a member of. */
  private sharedTaskLists(fallbackColor: string): TaskList[] {
    return this.shared ? this.shared.visibleTo(this.sub).map((d) => this.toSharedTaskList(d, fallbackColor)) : [];
  }

  /** Today on the app clock (honours the test clock), for `completedOn`. */
  private today(): string {
    return localDateOf(this.clock.nowMs(), this.tz);
  }

  private async mapOne(ev: GoogleEvent): Promise<CalendarItem> {
    const col = await this.calendarColor(ev.calendarId);
    return isTaskListEvent(ev) ? this.toTaskList(ev, col, this.settings.categories()) : this.toEvent(ev, col);
  }

  // ---------- lookup ----------
  private async locate(id: string, tasklist: boolean): Promise<GoogleEvent> {
    // task lists live only in the tasks calendar, events only in the event calendars
    const ids = tasklist ? [await this.tasks.id()] : (await this.eventCalendars()).map((c) => c.id);
    for (const calId of ids) {
      try {
        const ev = await this.provider.getEvent(calId, id);
        if (ev.status !== 'cancelled') return ev;
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
      }
    }
    throw notFound('Not found');
  }

  private async locateKind(id: string, tasklist: boolean): Promise<GoogleEvent> {
    const ev = await this.locate(id, tasklist);
    if (isTaskListEvent(ev) !== tasklist) throw notFound(tasklist ? 'Task list not found' : 'Event not found');
    return ev;
  }

  // ---------- items ----------
  /** Events of the event calendars plus the task lists of the tasks calendar (`calendarIds` narrows both). */
  private async fetchRange(from: string, to: string, calendarIds?: string[], tasklistsOnly = false): Promise<CalendarItem[]> {
    const tasksId = await this.tasks.id();
    const cals = tasklistsOnly ? [] : (await this.eventCalendars()).filter((c) => !calendarIds || calendarIds.includes(c.id));
    const timeMin = formatInZone(startOfLocalDay(from, this.tz), this.tz);
    const timeMax = formatInZone(startOfLocalDay(to, this.tz), this.tz);
    const cats = this.settings.categories();
    const eventLists = cals.map(async (c) => {
      const r = await this.provider.listEvents({ calendarId: c.id, timeMin, timeMax });
      // task-list-shaped events outside the tasks calendar are not task lists (ARCHITECTURE §3)
      return r.items.filter((e) => e.status !== 'cancelled' && !isTaskListEvent(e)).map((e): CalendarItem => this.toEvent(e, c.backgroundColor));
    });
    const taskLists = (async (): Promise<CalendarItem[]> => {
      if (calendarIds && !calendarIds.includes(tasksId)) return [];
      const r = await this.provider.listEvents({ calendarId: tasksId, timeMin, timeMax, privateExtendedProperty: ['kind=tasklist'] });
      const color = await this.calendarColor(tasksId);
      // undated lists sit on the anchor date: a range that reaches it must not show them
      return r.items.filter((e) => e.status !== 'cancelled' && isTaskListEvent(e) && !isUndatedEvent(e)).map((e): CalendarItem => this.toTaskList(e, color, cats));
    })();
    const sharedLists = (): CalendarItem[] => {
      if (calendarIds && !calendarIds.includes(tasksId)) return [];
      const color = this.calendarColorSync(tasksId);
      return this.sharedTaskLists(color).filter((l) => l.date !== null && l.date >= from && l.date < to);
    };
    return [...(await Promise.all([...eventLists, taskLists])).flat(), ...sharedLists()];
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
  ): Promise<{ items: CalendarItem[]; from: string; to: string; also?: { from: string; to: string }; syncedAt: string }> {
    const lists = await Promise.all([this.fetchRange(from, to, calendarIds), ...(also ? [this.fetchRange(also.from, also.to, calendarIds)] : [])]);
    const items = [...new Map(lists.flat().map((i) => [i.id, i])).values()];
    const keyed = items.map((i) => ({ i, k: this.sortKey(i) }));
    keyed.sort((a, b) => a.k[0].localeCompare(b.k[0]) || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3].localeCompare(b.k[3]));
    return { items: keyed.map((x) => x.i), from, to, ...(also ? { also } : {}), syncedAt: formatInZone(this.clock.real(), this.tz) };
  }

  // ---------- events ----------
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
    const calendarId = input.calendarId ?? (await this.primaryId());
    await this.requireCalendar(calendarId);
    this.checkEventShape(input);
    const g: GoogleEventInput = { summary: input.title, ...this.gTimes(input) };
    if (input.description) g.description = input.description;
    if (input.location) g.location = input.location;
    if (input.colorId) g.colorId = input.colorId;
    const ev = extra?.id && this.rawInsert ? await this.rawInsert(calendarId, { ...g, id: extra.id }) : await this.provider.insertEvent(calendarId, g);
    this.motivation.award('create');
    return this.toEvent(ev, await this.calendarColor(calendarId));
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    return (await this.mapOne(await this.locateKind(id, false))) as CalendarEvent;
  }

  async updateEvent(id: string, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> {
    const cur = await this.locateKind(id, false);
    if (specialOf(cur)) throw readOnlyBirthday();
    const curApi = this.toEvent(cur, '');
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
    if (m.calendarId !== cur.calendarId) await this.requireCalendar(m.calendarId);
    this.checkEventShape(m);
    const patch: GoogleEventPatch = {
      summary: m.title, description: m.description || null as unknown as string, location: m.location || null as unknown as string,
      colorId: m.colorId, ...this.gTimes(m),
    };
    let ev = await this.provider.patchEvent(cur.calendarId, id, patch, { ifMatch: ifMatch ?? cur.etag });
    if (m.calendarId !== cur.calendarId) ev = await this.provider.moveEvent(cur.calendarId, id, m.calendarId);
    return this.toEvent(ev, await this.calendarColor(ev.calendarId));
  }

  async deleteEvent(id: string, ifMatch?: string): Promise<void> {
    const cur = await this.locateKind(id, false);
    if (specialOf(cur)) throw readOnlyBirthday();
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    await this.provider.deleteEvent(cur.calendarId, id, ifMatch ? { ifMatch } : undefined);
  }

  // ---------- task lists ----------
  private checkTaskData(d: TaskListData, keepCategory?: string | null): void {
    if (!d.title.trim() && d.items.length === 0) throw validation('Add a title or an item', 'title', 'tasklist.titleOrItem');
    if (d.items.length > 200) throw validation('A task list can have at most 200 items', 'items', 'tasklist.tooManyItems');
    if (new Set(d.tags.map((t) => t.toLowerCase())).size !== d.tags.length) throw validation('Tags must be unique', 'tags', 'tasklist.tagsUnique');
    if (d.date !== null && !isLocalDate(d.date)) throw validation('Date must be YYYY-MM-DD', 'date');
    if (d.date === null && d.recurrence) throw validation('An undated task list cannot repeat', 'date');
    if (d.categoryId !== null && d.categoryId !== keepCategory && !this.settings.categories().some((c) => c.id === d.categoryId)) throw validation('Unknown category', 'categoryId');
    if (privateSize(encodePrivate(d)) > MAX_PRIVATE_BYTES) throw validation('Task list is too large', 'items');
  }

  private colorFor(d: TaskListData): string | null {
    return categoryColorId(this.settings.categories(), d.categoryId);
  }

  async createTaskList(input: CreateTaskListInput, extra?: { id?: string }): Promise<TaskList> {
    const calendarId = await this.tasks.id();
    const d: TaskListData = {
      title: input.title, date: input.date, time: input.date === null ? null : input.time ?? null,
      items: (input.items ?? []).filter((i) => i.title.trim()).map((i) => ({ id: nanoid(), title: i.title.trim(), done: !!i.done })),
      categoryId: input.categoryId ?? null, tags: input.tags ?? [], estimateMinutes: input.estimateMinutes ?? null, recurrence: input.recurrence ?? null,
      canvas: null,
      completedOn: null, // created complete is not "finished": only a later write that ticks the last open item sets it
    };
    this.checkTaskData(d);
    // a list created in a shared category is created shared (a repeating one cannot be: A-166/A-167)
    const member = d.categoryId && !d.recurrence && this.shared ? this.shared.ruleFor(this.sub, d.categoryId) : null;
    if (member) {
      const doc = this.shared!.create(this.sub, [member], d, this.categoryInfo(d.categoryId));
      this.motivation.award('create');
      return this.toSharedTaskList(doc, '#039be5');
    }
    const g = encodeTaskList(d, this.tz, this.colorFor(d));
    const ev = extra?.id && this.rawInsert ? await this.rawInsert(calendarId, { ...g, id: extra.id }) : await this.provider.insertEvent(calendarId, g);
    this.motivation.award('create');
    return this.toTaskList(ev, await this.calendarColor(calendarId), this.settings.categories());
  }

  async getTaskList(id: string): Promise<TaskList> {
    if (isSharedId(id)) return this.toSharedTaskList(this.shared!.access(this.sub, id), '#039be5');
    return (await this.mapOne(await this.locateKind(id, true))) as TaskList;
  }

  /** The rules every write of a list ends with: `completedOn`, the date of a finished undated list, validation. */
  private finalize(before: TaskListData, d: TaskListData): void {
    d.completedOn = nextCompletedOn(before, d, this.today());
    // an undated list finished by this write is dated to today, so it shows where it was finished
    const finishedOn = dateOnCompletion(before, d, this.today(), this.prefs.labsPrefs(this.sub).undatedDone);
    if (finishedOn) { d.date = finishedOn; d.time = null; }
    this.checkTaskData(d, before.categoryId);
  }

  /** Read-modify-write of a shared list: synchronous, so no other write can slip in; a pinned stale `If-Match` is a 412. */
  private modifyShared(id: string, fn: (d: TaskListData) => TaskListData, ifMatch?: string): TaskList {
    const doc = this.shared!.access(this.sub, id);
    if (ifMatch && !etagEq(ifMatch, `"${doc.rev}"`)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
    const before = doc.data;
    const d = { ...fn(before) };
    this.finalize(before, d);
    const moved = d.categoryId !== before.categoryId;
    // only the owner's categories are meaningful on the list (A-164)
    if (moved && doc.owner !== this.sub) throw validation('Only the owner can change the category of a shared list', 'categoryId', 'sharing.categoryOwnerOnly');
    this.shared!.save(doc, d, moved ? this.categoryInfo(d.categoryId) : undefined);
    return this.toSharedTaskList(doc, '#039be5');
  }

  /** The look of one of this person's categories, as carried on a shared list. */
  private categoryInfo(categoryId: string | null): CategoryInfo | null {
    const c = this.settings.categories().find((x) => x.id === categoryId);
    return c ? { name: c.name, color: c.color, icon: c.icon } : null;
  }

  /** Read-modify-write; on a provider-side 412 re-reads and retries (up to 3 attempts) unless `ifMatch` is pinned. */
  private async modify(id: string, fn: (d: TaskListData) => TaskListData, ifMatch?: string): Promise<TaskList> {
    if (isSharedId(id)) return this.modifyShared(id, fn, ifMatch);
    for (let attempt = 1; ; attempt++) {
      const cur = await this.locateKind(id, true);
      if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
      const before = decodeTaskList(cur, this.tz);
      const d = { ...fn(before) };
      this.finalize(before, d);
      try {
        const ev = await this.provider.patchEvent(cur.calendarId, id, encodeTaskListPatch(d, this.tz, this.colorFor(d), cur), { ifMatch: cur.etag });
        return this.toTaskList(ev, await this.calendarColor(ev.calendarId), this.settings.categories());
      } catch (e) {
        if (e instanceof PreconditionFailedError) {
          if (ifMatch) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
          if (attempt < 3) continue;
        }
        throw e;
      }
    }
  }

  async updateTaskList(id: string, input: UpdateTaskListInput, ifMatch?: string): Promise<TaskList> {
    return this.modify(id, (d) => {
      const next = { ...d };
      if (input.title !== undefined) next.title = input.title;
      if (input.date !== undefined) next.date = input.date;
      if (input.time !== undefined) next.time = input.time;
      if (next.date === null) next.time = null;
      if (input.categoryId !== undefined) next.categoryId = input.categoryId;
      if (input.tags !== undefined) next.tags = input.tags;
      if (input.estimateMinutes !== undefined) next.estimateMinutes = input.estimateMinutes;
      if (input.canvas !== undefined) next.canvas = input.canvas;
      if (input.items !== undefined) {
        next.items = input.items.filter((i) => i.title.trim()).map((i) => ({ id: i.id ?? nanoid(), title: i.title.trim(), done: i.done }));
      }
      return next;
    }, ifMatch);
  }

  async deleteTaskList(id: string, ifMatch?: string): Promise<void> {
    if (isSharedId(id)) {
      // only the owner deletes a shared list for everyone; a member leaves it instead
      const doc = this.shared!.accessOwned(this.sub, id);
      if (ifMatch && !etagEq(ifMatch, `"${doc.rev}"`)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
      this.shared!.remove(doc);
      return;
    }
    const cur = await this.locateKind(id, true);
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
    await this.provider.deleteEvent(cur.calendarId, id, ifMatch ? { ifMatch } : undefined);
  }

  async addItem(id: string, input: { title: string; done?: boolean; index?: number }): Promise<TaskList> {
    return this.modify(id, (d) => {
      const items = [...d.items];
      const item: TaskItem = { id: nanoid(), title: input.title, done: !!input.done };
      const at = input.index === undefined ? items.length : Math.min(input.index, items.length);
      items.splice(at, 0, item);
      return { ...d, items };
    });
  }

  async patchItem(id: string, itemId: string, input: { title?: string; done?: boolean }): Promise<TaskList> {
    let ticked = false;
    const list = await this.modify(id, (d) => {
      ticked = false;
      const idx = d.items.findIndex((i) => i.id === itemId);
      if (idx < 0) throw notFound('Item not found');
      const cur = d.items[idx]!;
      if (input.done === true && !cur.done) ticked = true;
      const items = [...d.items];
      items[idx] = { ...cur, title: input.title ?? cur.title, done: input.done ?? cur.done };
      return { ...d, items };
    });
    if (ticked) this.motivation.award('tick', itemId);
    return list;
  }

  async deleteItem(id: string, itemId: string): Promise<TaskList> {
    return this.modify(id, (d) => {
      if (!d.items.some((i) => i.id === itemId)) throw notFound('Item not found');
      return { ...d, items: d.items.filter((i) => i.id !== itemId) };
    });
  }

  async reorder(id: string, itemIds: string[]): Promise<TaskList> {
    return this.modify(id, (d) => {
      const ids = new Set(d.items.map((i) => i.id));
      if (itemIds.length !== ids.size || new Set(itemIds).size !== itemIds.length || itemIds.some((x) => !ids.has(x))) {
        throw validation('itemIds must contain every item id exactly once', 'itemIds');
      }
      const byId = new Map(d.items.map((i) => [i.id, i]));
      return { ...d, items: itemIds.map((x) => byId.get(x)!) };
    });
  }

  // ---------- sharing ----------
  /**
   * Shares a list with a person. A list of the tasks calendar MOVES into the shared store (same items and state, the
   * Google event is deleted once the shared copy is written); on a list this person already shares, the person is added.
   */
  async shareTaskList(id: string, personSub: string): Promise<TaskList> {
    const shared = this.shared!;
    // access first: a stranger learns nothing about the list, not even that the person was refused
    const doc = isSharedId(id) ? shared.accessOwned(this.sub, id) : null;
    shared.requireMember(this.sub, personSub);
    if (doc) {
      shared.setMembers(doc, [...doc.members, personSub]);
      return this.toSharedTaskList(doc, '#039be5');
    }
    const moved = await this.moveIn(await this.locateKind(id, true), [personSub]);
    return this.toSharedTaskList(moved, '#039be5');
  }

  /** Moves one task list event into the shared store; the event is deleted only after the shared copy exists. */
  private async moveIn(ev: GoogleEvent, members: string[]): Promise<SharedListDoc> {
    const d = decodeTaskList(ev, this.tz);
    if (d.recurrence || ev.recurringEventId) throw validation('A repeating task list cannot be shared', 'recurrence', 'sharing.repeating');
    const doc = this.shared!.create(this.sub, members, d, this.categoryInfo(d.categoryId));
    try {
      await this.provider.deleteEvent(ev.calendarId, ev.id);
    } catch (e) {
      this.shared!.remove(doc);
      throw e;
    }
    return doc;
  }

  /** "Stop sharing" (owner): the list moves back into the owner's tasks calendar; everybody else loses it. */
  async unshareTaskList(id: string): Promise<TaskList> {
    return this.moveOut(this.shared!.accessOwned(this.sub, id));
  }

  /** Creates the Google event first, then removes the shared copy, so a failure never loses the list. */
  private async moveOut(doc: SharedListDoc): Promise<TaskList> {
    const d: TaskListData = { ...doc.data, recurrence: null };
    // a category this person no longer has cannot be kept
    if (d.categoryId !== null && !this.settings.categories().some((c) => c.id === d.categoryId)) d.categoryId = null;
    const calendarId = await this.tasks.id();
    const ev = await this.provider.insertEvent(calendarId, encodeTaskList(d, this.tz, this.colorFor(d)));
    this.shared!.remove(doc);
    return this.toTaskList(ev, await this.calendarColor(calendarId), this.settings.categories());
  }

  /** "Leave" (member): the list disappears for this person only. */
  leaveTaskList(id: string): void {
    const doc = this.shared!.access(this.sub, id);
    if (doc.owner === this.sub) throw forbidden('The owner deletes the list or stops sharing it', 'sharing.ownerCannotLeave');
    this.shared!.setMembers(doc, doc.members.filter((m) => m !== this.sub));
  }

  /**
   * Shares a category with a person (or, with `null`, stops): every list of the category moves into (out of) the shared
   * store, and lists created in it later are created shared (A-167). Returns the person's category rules.
   */
  async shareCategory(categoryId: string, personSub: string | null): Promise<Record<string, Person>> {
    const shared = this.shared!;
    if (!this.settings.categories().some((c) => c.id === categoryId)) throw notFound('Category not found');
    const previous = shared.ruleFor(this.sub, categoryId);
    if (personSub !== null) shared.requireMember(this.sub, personSub);
    shared.setRule(this.sub, categoryId, personSub);
    if (personSub === null) {
      // members of lists that were shared through this rule lose them; a list left without anybody moves back
      for (const doc of shared.ownedInCategory(this.sub, categoryId)) {
        if (!previous || !doc.members.includes(previous)) continue;
        const rest = doc.members.filter((m) => m !== previous);
        if (rest.length) shared.setMembers(doc, rest);
        else await this.moveOut(doc);
      }
    } else {
      for (const doc of shared.ownedInCategory(this.sub, categoryId)) shared.setMembers(doc, [...doc.members.filter((m) => m !== previous), personSub]);
      const calendarId = await this.tasks.id();
      const found = await this.provider.listEvents({ calendarId, privateExtendedProperty: ['kind=tasklist', `categoryId=${categoryId}`] });
      for (const ev of found.items) {
        // repeating lists stay where they are: their rule cannot move into the shared store
        if (ev.status === 'cancelled' || !isTaskListEvent(ev) || ev.recurrence?.length || ev.recurringEventId) continue;
        await this.moveIn(ev, [personSub]);
      }
    }
    return shared.rulesOf(this.sub);
  }

  // ---------- open lists and summary ----------
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
    const color = await this.calendarColor(tasksId);
    const cats = this.settings.categories();
    // keyed by id: a dated shared list is in the range read and in the full list of shared lists
    const lists = [...new Map([
      ...dated.filter((i): i is TaskList => i.kind === 'tasklist'),
      ...undated.items.filter((e) => e.status !== 'cancelled').map((e) => this.toTaskList(e, color, cats)),
      ...this.sharedTaskLists(color),
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
    const color = await this.calendarColor(tasksId);
    const cats = this.settings.categories();
    // keyed by id so a list found twice (marker and range) is returned once
    const byId = new Map<string, TaskList>();
    for (const i of dated) if (i.kind === 'tasklist') byId.set(i.id, i);
    for (const e of marked.items) if (e.status !== 'cancelled') byId.set(e.id, this.toTaskList(e, color, cats));
    for (const l of this.sharedTaskLists(color)) byId.set(l.id, l);
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

  /** Cheap helper for tests/clients: local time label of an instant. */
  localTime(ms: number): string { return localTimeOf(ms, this.tz); }
}

const etagEq = (a: string, b: string) => a.replace(/^W\//, '').replaceAll('"', '') === b.replace(/^W\//, '').replaceAll('"', '');
export { ApiException };
