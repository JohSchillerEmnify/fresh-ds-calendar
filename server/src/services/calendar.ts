import { createHash } from 'node:crypto';
import { LIST_ITEMS_MAX } from '@calendar/shared/limits';
import type {
  Calendar, CalendarEvent, CalendarItem, Category, CategoryInfo, CreateBirthdayInput, CreateEventInput, CreateTaskListInput, Reminders, TaskItem, TaskList, Person,
  UpdateEventInput, UpdateTaskListInput,
} from '../api/types.js';
import type { AppConfig } from '../config.js';
import type { Clock } from '../lib/clock.js';
import { GOOGLE_CALENDAR_COLORS, GOOGLE_COLORS, onColor, type CalendarColor } from '@calendar/shared/colors';
import { forbidden, notFound, preconditionFailed, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { formatInZone, isLocalDate, localDateOf, localTimeOf } from '../lib/time.js';
import {
  NotFoundError, PreconditionFailedError, type CalendarProvider, type GoogleEvent, type GoogleEventInput, type GoogleReminder,
  type ProviderCalendar,
} from '../providers/CalendarProvider.js';
import type { MotivationService } from './motivation.js';
import type { PrefsStore } from './prefsStore.js';
import type { SettingsStore } from './settingsStore.js';
import {
  categoryColorId, dateOnCompletion, decodeTaskList, encodePrivate, encodeTaskList, encodeTaskListPatch, isTaskListEvent, MAX_PRIVATE_BYTES,
  nextCompletedOn, privateSize,
  type TaskListData,
} from './taskCodec.js';
import { TasksCalendar } from './tasksCalendar.js';
import { EventWrites } from './eventWrites.js';
import { ItemQueries } from './itemQueries.js';
import { BIRTHDAYS_COLOR, BIRTHDAYS_ID, etagEq, inContactsCalendar, isContactsCalendarId, specialOf } from './eventRules.js';
import { logCalendarShape } from './calendarShape.js';
import { HolidayCalendars } from './holidays.js';
import { isHolidayCalendarId } from '../providers/holidayRegions.js';
import { TaskSeries } from './taskSeries.js';
import { TaskSharing } from './taskSharing.js';
import { birthdayDateKey, birthdayDateLocked } from './birthday.js';
import { ContactsSource } from './contactBirthdays.js';
import { placeOf } from './place.js';
import { calHash, logEvent } from '../lib/diag.js';
import { hasWriteRole, readOnlyReason } from './ownership.js';
import { CalendarChanges, type CalendarHealth, type EventChanges, type FeedState, type TaskListChanges } from './changeFeed.js';
import { isSharedId, SHARED_CALENDAR, SHARED_PREFIX, type SharedListDoc, type SharedListService } from './sharedLists.js';

const CAL_TTL_MS = 30_000;
/** Google's calendar palette is the same for everyone; kept for the process once Google has answered. */
let palette: CalendarColor[] | null = null;
/** When Google last failed to give the palette: the built-in copy serves for a while instead of asking on every poll. */
let paletteFailedAt = 0;


/** Google allows at most 5 reminders per event and 5 defaults per calendar (popup and email together). */
const MAX_REMINDERS = 5;
const popups = (list: GoogleReminder[] | undefined): number[] => (list ?? []).filter((r) => r.method === 'popup').map((r) => r.minutes);

const notOwn = () => forbidden('Only your own events can be changed', 'calendar.event.notOwn');

export class CalendarService {
  private calCache: { at: number; cals: ProviderCalendar[] } | null = null;
  private calGen = 0;
  /** The holiday regions the person can add and the ones they have (ADR 0039). */
  readonly holidays: HolidayCalendars;
  /** Calendars too large to walk for a sync token, and until when they are left alone (see {@link CalendarChanges}). */
  private readonly noTokenUntil = new Map<string, number>();
  /** Calendars Google keeps refusing, and their back-off (see {@link CalendarChanges}). */
  private readonly calendarHealth = new Map<string, CalendarHealth>();
  /** Test/seed hook: insert with a caller-chosen event id (mock only). */
  rawInsert?: (calendarId: string, ev: GoogleEventInput & { id: string }) => Promise<GoogleEvent>;
  /** The person's hidden "Calendar app: tasks" calendar: the only place task lists are read and written. */
  readonly tasks: TasksCalendar;
  /** Changes that reach beyond one occurrence of a repeating list. */
  private readonly series: TaskSeries;
  /** Sharing of lists and categories; null where sharing is not wired. */
  private readonly sharing: TaskSharing | null;
  /** Item ranges, open and archived lists, the day summary. */
  private readonly queries: ItemQueries;
  /** Create, update and delete of events. */
  private readonly events: EventWrites;
  /** The person's Google contacts, whose dates show in the Birthdays calendar. */
  private readonly contacts: ContactsSource;

  constructor(
    private readonly provider: CalendarProvider,
    private readonly settings: SettingsStore,
    private readonly motivation: MotivationService,
    private readonly clock: Clock,
    private readonly config: Pick<AppConfig, 'tz'>,
    private readonly prefs: PrefsStore,
    readonly sub: string,
    /** Shared lists (feature shared-lists); null where sharing is not wired (some unit tests). */
    private readonly shared: SharedListService | null = null,
    /** Whether the person's token has `contacts.readonly` (feature contact-birthdays). */
    contactsGranted: () => boolean = () => false,
  ) {
    this.contacts = new ContactsSource(provider, contactsGranted, () => clock.real());
    this.holidays = new HolidayCalendars(provider, () => this.clock.real(), () => this.providerCalendars(), () => { this.dropCalendars(); });
    this.tasks = new TasksCalendar(provider, prefs, sub, () => this.providerCalendars(), () => { this.dropCalendars(); });
    this.sharing = shared && new TaskSharing(provider, settings, this.tasks, shared, sub, config.tz, {
      locateKind: (id, tasklist) => this.locateKind(id, tasklist), toSharedTaskList: (doc, color) => this.toSharedTaskList(doc, color),
      toTaskList: (ev, color, cats) => this.toTaskList(ev, color, cats), categoryInfo: (c) => this.categoryInfo(c), colorFor: (d) => this.colorFor(d),
      calendarColor: (id) => this.calendarColor(id),
    });
    this.queries = new ItemQueries(provider, settings, this.tasks, clock, sub, config.tz, {
      eventCalendars: () => this.eventCalendars(), toEvent: (e, c, d) => this.toEvent(e, c, d), toTaskList: (e, c, cats) => this.toTaskList(e, c, cats),
      sharedTaskLists: (c) => this.sharedTaskLists(c), calendarColor: (id) => this.calendarColor(id), calendarColorSync: (id) => this.calendarColorSync(id),
      stale: () => this.stale(), contactEvents: (from, to) => this.contactEvents(from, to),
    });
    this.events = new EventWrites(provider, motivation, prefs, sub, config.tz, {
      calendarColor: (id) => this.calendarColor(id), eventCalendars: () => this.eventCalendars(), locateKind: (id, tasklist) => this.locateKind(id, tasklist),
      mapOne: (ev) => this.mapOne(ev), norm: (dt) => this.norm(dt), primaryId: () => this.primaryId(), providerCalendars: () => this.providerCalendars(),
      remindersOf: (input, cur) => this.remindersOf(input, cur), requireCalendar: (id) => this.requireCalendar(id),
      requireOwnCalendar: (id) => this.requireOwnCalendar(id), requireOwnEvent: (ev) => this.requireOwnEvent(ev),
      toEvent: (ev, color, defaults) => this.toEvent(ev, color, defaults), rawInsert: () => this.rawInsert,
    });
    this.series = new TaskSeries(provider, config.tz, {
      locateKind: (id, tasklist) => this.locateKind(id, tasklist), modify: (id, fn) => this.modify(id, fn), getTaskList: (id) => this.getTaskList(id),
      checkTaskData: (d, before) => { this.checkTaskData(d, before); }, colorFor: (d) => this.colorFor(d), today: () => this.today(),
    });
  }

  private get tz() { return this.config.tz; }

  /** True while Google's rate limit is in force: what a read returns may be older than the last poll (API.md "Stale data"). */
  stale(): boolean {
    return (this.provider.cooldownMs?.() ?? 0) > 0;
  }
  invalidate(): void {
    this.contacts.forgetFreshness();
    this.dropCalendars();
    this.tasks.forget();
  }

  /** Forgets the sync back-offs of every calendar (test reset), so a refusal in one scenario cannot silence the change feed in the next. */
  forgetFeedHealth(): void {
    this.noTokenUntil.clear();
    this.calendarHealth.clear();
  }

  // ---------- calendars ----------
  private async providerCalendars(): Promise<ProviderCalendar[]> {
    const now = this.clock.real();
    if (this.calCache && now - this.calCache.at < CAL_TTL_MS) return this.calCache.cals;
    const gen = this.calGen;
    const cals = await this.provider.listCalendars();
    // a list read before a write (a new colour) must not be kept as fresh
    if (gen === this.calGen) this.calCache = { at: now, cals };
    return cals;
  }

  /** Forgets the cached calendar list after a write, including a read still under way. */
  private dropCalendars(): void {
    this.calCache = null;
    this.calGen++;
  }

  /** Calendars that hold events: not switched off in Google's list (the old contacts calendar is read even then) and not the tasks calendar. */
  private async eventCalendars(): Promise<ProviderCalendar[]> {
    const tasksId = this.tasks.knownId();
    return (await this.providerCalendars()).filter((c) => (!c.hidden || isContactsCalendarId(c.id)) && c.id !== tasksId);
  }

  /** The person's colour of the virtual Birthdays calendar. */
  private birthdaysColor(): string {
    return this.prefs.birthdaysColor(this.sub) ?? BIRTHDAYS_COLOR;
  }

  /** The contact dates in `[from, to)` for the range read; none while the permission is missing or Google cannot answer. */
  private async contactEvents(from: string, to: string): Promise<CalendarEvent[]> {
    if (!this.contacts.enabled || !(await this.contacts.refresh())) return [];
    return this.contacts.events(from, to, this.birthdaysColor());
  }

  /** The calendars the person sees: Google's (the old contacts calendar left out) and the app's own Birthdays calendar (ADR 0038). */
  async calendars(): Promise<Calendar[]> {
    this.dropCalendars(); // the endpoint always hits the provider (outages must surface)
    const all = await this.eventCalendars();
    // the diagnostic reads in the background and must never delay or fail the calendar list
    const hidden = this.prefs.hiddenCalendars(this.sub);
    void logCalendarShape(this.provider, this.sub, localDateOf(this.clock.real(), this.tz), all, (id) => !hidden.includes(id)).catch(() => undefined);
    return [
      ...all.filter((c) => !isContactsCalendarId(c.id)).map((c): Calendar => ({
        id: c.id, name: c.summary, color: c.backgroundColor, primary: c.primary, writable: hasWriteRole(c),
        defaultReminders: popups(c.defaultReminders), ...(isHolidayCalendarId(c.id) ? { holiday: true as const } : {}),
      })),
      { id: BIRTHDAYS_ID, name: 'Birthdays', color: this.birthdaysColor(), primary: false, writable: false, defaultReminders: [], virtual: true, contactsPermission: this.contacts.enabled ? 'granted' : 'missing' },
    ];
  }

  /**
   * Replaces the popup default list of a calendar (`calendarList.patch`); email defaults stay. `tasksCalendar` addresses the
   * person's tasks calendar, which is not in {@link calendars}. A calendar the person can only read goes
   * to Google as well (the list entry is per person). Returns the list as stored.
   */
  async setDefaultReminders(id: string, minutes: number[], tasksCalendar = false): Promise<number[]> {
    if (id === BIRTHDAYS_ID && !tasksCalendar) throw validation('The Birthdays calendar has no default reminders', 'defaultReminders');
    const calId = tasksCalendar ? await this.tasks.id() : id;
    const cal = (await this.providerCalendars()).find((c) => c.id === calId && (tasksCalendar || !c.hidden && c.id !== this.tasks.knownId()));
    if (!cal) throw notFound('Calendar not found');
    const next = this.remindersToGoogle(minutes, cal.defaultReminders);
    await this.provider.setCalendarDefaultReminders(calId, next);
    this.dropCalendars();
    return minutes;
  }

  /** Google's calendar colour palette; static per Google, so fetched once per process, the built-in copy when Google cannot answer. */
  async colorPalette(): Promise<CalendarColor[]> {
    if (palette) return palette;
    if (Date.now() - paletteFailedAt < CAL_TTL_MS) return [...GOOGLE_CALENDAR_COLORS];
    try {
      palette = await this.provider.calendarColors();
      return palette;
    } catch {
      paletteFailedAt = Date.now();
      return [...GOOGLE_CALENDAR_COLORS];
    }
  }

  /** Sets the person's list colour of a calendar (per person, also one they only read): a palette `colorId`, or a custom `#rrggbb` with a readable text colour. */
  async setColor(id: string, pick: { color: string } | { colorId: string }): Promise<void> {
    if (id === BIRTHDAYS_ID) return this.setBirthdaysColor(pick);
    const cal = (await this.eventCalendars()).find((c) => c.id === id);
    if (!cal) throw notFound('Calendar not found');
    if ('colorId' in pick) {
      const entry = (await this.colorPalette()).find((c) => c.id === pick.colorId);
      if (!entry) throw validation('colorId is not one of Google\'s calendar colours', 'colorId');
      // Google lets an RGB colour on the list entry supersede colorId, so a palette pick is written as its RGB too;
      // the text colour is black or white: Google refused the palette's own #1d1d1d ("Invalid foreground color.")
      logEvent('calendar_color_write', { calHash: calHash(id), kind: 'palette', background: entry.background, foreground: onColor(entry.background) });
      await this.provider.setCalendarColor(id, { backgroundColor: entry.background, foregroundColor: onColor(entry.background) });
    } else {
      logEvent('calendar_color_write', { calHash: calHash(id), kind: 'custom', background: pick.color, foreground: onColor(pick.color) });
      await this.provider.setCalendarColor(id, { backgroundColor: pick.color, foregroundColor: onColor(pick.color) });
    }
    this.dropCalendars();
  }

  /** Stores the person's colour of the virtual Birthdays calendar in the app: Google has no list entry to hold it. */
  private async setBirthdaysColor(pick: { color: string } | { colorId: string }): Promise<void> {
    if ('color' in pick) return this.prefs.setBirthdaysColor(this.sub, pick.color);
    const entry = (await this.colorPalette()).find((c) => c.id === pick.colorId);
    if (!entry) throw validation('colorId is not one of Google\'s calendar colours', 'colorId');
    this.prefs.setBirthdaysColor(this.sub, entry.background.toLowerCase());
  }

  /** The popup default list of the person's tasks calendar (created on first use like any task list access). */
  async tasksDefaultReminders(): Promise<number[]> {
    const id = await this.tasks.id();
    return popups((await this.providerCalendars()).find((c) => c.id === id)?.defaultReminders);
  }

  /** Google's reminder list for the new popup lead times; the `others` (email ...) already stored are kept in front. */
  private remindersToGoogle(minutes: number[], current: GoogleReminder[] | undefined): GoogleReminder[] {
    const kept = (current ?? []).filter((r) => r.method !== 'popup');
    if (kept.length + minutes.length > MAX_REMINDERS) throw validation('At most 5 reminders', 'reminders', 'reminders.tooMany');
    return [...kept, ...minutes.map((m) => ({ method: 'popup', minutes: m }))];
  }

  /** Google `reminders` for an input; the other methods of the stored list (`cur`) are kept. */
  private remindersOf(input: Reminders, cur?: GoogleEvent['reminders']): NonNullable<GoogleEvent['reminders']> {
    if (input.useDefault) return { useDefault: true };
    return { useDefault: false, overrides: this.remindersToGoogle(input.minutes, cur?.useDefault ? undefined : cur?.overrides) };
  }

  /** The popup lead times in effect for an event: the calendar default while it uses it, else its own list. */
  private remindersView(ev: GoogleEvent, calDefaults: GoogleReminder[] | undefined): Reminders {
    const useDefault = ev.reminders?.useDefault ?? true;
    return { useDefault, minutes: popups(useDefault ? calDefaults : ev.reminders?.overrides) };
  }

  private defaultsSync(calendarId: string): GoogleReminder[] | undefined {
    return this.calCache?.cals.find((c) => c.id === calendarId)?.defaultReminders;
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

  /** Events go only into calendars the person may write in Google (403 `calendar.event.notOwn` otherwise). */
  private async requireOwnCalendar(id: string): Promise<void> {
    if (!hasWriteRole((await this.providerCalendars()).find((c) => c.id === id))) throw notOwn();
  }

  /** An ordinary event can be changed only when its calendar is writable and organised by the person (403 `calendar.event.notOwn`). */
  private async requireOwnEvent(ev: GoogleEvent): Promise<void> {
    if (readOnlyReason(ev, await this.providerCalendars())) throw notOwn();
  }

  // ---------- mapping ----------
  private norm(dt: { date?: string; dateTime?: string }): string {
    return dt.date ?? formatInZone(Date.parse(dt.dateTime!), this.tz);
  }

  private toEvent(ev: GoogleEvent, calColor: string, calDefaults: GoogleReminder[] | undefined = this.defaultsSync(ev.calendarId)): CalendarEvent {
    const special = specialOf(ev);
    // a birthday of the contacts calendar always uses its calendar's colour (a stray colour would hide where it comes from); one made in Google Calendar may have its own
    const colorId = !(special && inContactsCalendar(ev)) && ev.colorId && GOOGLE_COLORS[ev.colorId] ? ev.colorId : null;
    // look-only: not in an own calendar, or (ordinary events) organised by someone else; a birthday's organiser does not matter
    const found = this.calCache ? readOnlyReason(ev, this.calCache.cals) : null;
    const reason = special && found?.kind !== 'calendar' ? null : found;
    const readOnly = special ? inContactsCalendar(ev) || !!reason : !!reason;
    const place = placeOf(ev);
    return {
      kind: 'event', id: ev.id, calendarId: special ? BIRTHDAYS_ID : ev.calendarId, title: ev.summary ?? '', description: ev.description ?? '', location: ev.location ?? '', ...(place ? { place } : {}),
      allDay: !!ev.start.date, start: this.norm(ev.start), end: this.norm(ev.end), colorId,
      color: colorId ? GOOGLE_COLORS[colorId]!.hex : special ? this.birthdaysColor() : calColor, ...(special ? { special, sourceCalendarId: ev.calendarId, dupKey: birthdayDateKey(ev, this.norm(ev.start)) } : {}),
      ...(readOnly ? { readOnly: true as const } : {}), ...(reason && !inContactsCalendar(ev) ? { readOnlyReason: reason } : {}), ...(special && !readOnly && birthdayDateLocked(ev) ? { dateLocked: true as const } : {}),
      reminders: (readOnly && this.ownReminders(ev, calDefaults)) || this.remindersView(ev, calDefaults), etag: ev.etag, updated: ev.updated,
    };
  }

  /** The reminders the app keeps for a read-only event, shown as the event's own list. */
  private ownReminders(ev: GoogleEvent, calDefaults: GoogleReminder[] | undefined): Reminders | undefined {
    const own = this.prefs.reminderOverrides.get(this.sub, ev.calendarId, ev.id);
    return own && { useDefault: own.useDefault, minutes: own.useDefault ? popups(calDefaults) : [...own.minutes] };
  }

  private toTaskList(ev: GoogleEvent, calColor: string, cats: Category[]): TaskList {
    const d = decodeTaskList(ev, this.tz);
    const cat = cats.find((c) => c.id === d.categoryId);
    const done = d.items.filter((i) => i.done).length;
    return {
      kind: 'tasklist', id: ev.id, calendarId: ev.calendarId, title: d.title, date: d.date, time: d.time, items: d.items, doneCount: done,
      totalCount: d.items.length, estimateMinutes: d.estimateMinutes, recurrence: d.recurrence, ...(ev.recurringEventId ? { seriesId: ev.recurringEventId, seriesKey: ev.extendedProperties?.private?.series ?? ev.recurringEventId } : {}),
      categoryId: cat ? cat.id : null,
      tags: d.tags, color: cat ? cat.color : calColor, calendarColor: calColor, completedOn: d.completedOn, ...(d.createdOn ? { createdOn: d.createdOn } : {}), canvas: d.canvas,
      reminders: this.remindersView(ev, this.defaultsSync(ev.calendarId)), etag: ev.etag, updated: ev.updated,
    };
  }

  /** A shared list as the API shows it to this person: the owner's category look comes from the list. */
  private toSharedTaskList(doc: SharedListDoc, fallbackColor: string): TaskList {
    const d = doc.data;
    const live = doc.owner === this.sub ? this.settings.categories(this.sub).find((c) => c.id === d.categoryId) : undefined;
    const info: CategoryInfo | null = live ? { name: live.name, color: live.color, icon: live.icon } : doc.category;
    const done = d.items.filter((i) => i.done).length;
    return {
      kind: 'tasklist', id: SHARED_PREFIX + doc.id, calendarId: SHARED_CALENDAR, title: d.title, date: d.date, time: d.time, items: d.items,
      doneCount: done, totalCount: d.items.length, estimateMinutes: d.estimateMinutes, recurrence: null, categoryId: d.categoryId, tags: d.tags,
      color: info?.color ?? fallbackColor, calendarColor: fallbackColor, completedOn: d.completedOn, ...(d.createdOn ? { createdOn: d.createdOn } : {}), canvas: d.canvas, etag: `"${doc.rev}"`, updated: doc.updated,
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
    return isTaskListEvent(ev) ? this.toTaskList(ev, col, this.settings.categories(this.sub)) : this.toEvent(ev, col);
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

  // ---------- events (see EventWrites) ----------
  createEvent(input: CreateEventInput, extra?: { id?: string }): Promise<CalendarEvent> { return this.events.createEvent(input, extra); }
  createBirthday(input: CreateBirthdayInput): Promise<CalendarEvent> { return this.events.createBirthday(input); }
  getEvent(id: string): Promise<CalendarEvent> { return this.events.getEvent(id); }
  updateEvent(id: string, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> { return this.events.updateEvent(id, input, ifMatch); }
  deleteEvent(id: string, ifMatch?: string): Promise<void> { return this.events.deleteEvent(id, ifMatch); }

  // ---------- task lists ----------
  /** Validates a list before it is written; with `before` (an update) a rule judges only what this write changes, so an older stored field never blocks a tick or a delete. */
  private checkTaskData(d: TaskListData, before?: TaskListData): void {
    const changed = (f: (x: TaskListData) => unknown) => !before || JSON.stringify(f(d)) !== JSON.stringify(f(before));
    if (changed((x) => x.title.trim()) && !d.title.trim() && d.items.length === 0) throw validation('Add a title or an item', 'title', 'tasklist.titleOrItem');
    if (d.items.length > LIST_ITEMS_MAX && d.items.length > (before?.items.length ?? 0)) throw validation(`A task list can have at most ${LIST_ITEMS_MAX} items`, 'items', 'tasklist.tooManyItems');
    if (changed((x) => x.tags) && new Set(d.tags.map((t) => t.toLowerCase())).size !== d.tags.length) throw validation('Tags must be unique', 'tags', 'tasklist.tagsUnique');
    if (changed((x) => x.date) && d.date !== null && !isLocalDate(d.date)) throw validation('Date must be YYYY-MM-DD', 'date');
    if (changed((x) => [x.date, x.recurrence]) && d.date === null && d.recurrence) throw validation('An undated task list cannot repeat', 'date');
    if (changed((x) => x.categoryId) && d.categoryId !== null && !this.settings.categories(this.sub).some((c) => c.id === d.categoryId)) throw validation('Unknown category', 'categoryId');
    const size = privateSize(encodePrivate(d));
    if (size > MAX_PRIVATE_BYTES && (!before || size > privateSize(encodePrivate(before)))) throw validation('Task list is too large', 'items');
  }

  private colorFor(d: TaskListData): string | null {
    return categoryColorId(this.settings.categories(this.sub), d.categoryId);
  }

  async createTaskList(input: CreateTaskListInput, extra?: { id?: string }): Promise<TaskList> {
    const calendarId = await this.tasks.id();
    const d: TaskListData = {
      title: input.title, date: input.date, time: input.date === null ? null : input.time ?? null,
      items: (input.items ?? []).filter((i) => i.title.trim() || i.strokes).map((i) => ({ id: nanoid(), title: i.title.trim(), done: !!i.done, ...(i.strokes ? { ink: true as const } : {}) })),
      categoryId: input.categoryId ?? null, tags: input.tags ?? [], estimateMinutes: input.estimateMinutes ?? null, recurrence: input.recurrence ?? null,
      canvas: null,
      createdOn: input.createdOn ?? localDateOf(this.clock.nowMs(), this.tz), // an offline create keeps the day it was made
      completedOn: null, // created complete is not "finished": only a later write that ticks the last open item sets it
    };
    this.checkTaskData(d);
    // a list created in a shared category is created shared (a repeating one cannot be: feature shared-lists)
    const member = d.categoryId && !d.recurrence && this.shared ? this.shared.ruleFor(this.sub, d.categoryId) : null;
    if (member) {
      const doc = this.shared!.create(this.sub, [member], d, this.categoryInfo(d.categoryId));
      this.motivation.award(this.sub, 'create');
      return this.toSharedTaskList(doc, '#039be5');
    }
    const g = encodeTaskList(d, this.tz, this.colorFor(d));
    if (input.reminders && !input.reminders.useDefault) g.reminders = this.remindersOf(input.reminders);
    const ev = extra?.id && this.rawInsert ? await this.rawInsert(calendarId, { ...g, id: extra.id }) : await this.provider.insertEvent(calendarId, g);
    this.motivation.award(this.sub, 'create');
    // a repeating list answers with its first week, under the id every range read uses (a held series id would show twice)
    const shown = d.recurrence ? await this.series.firstOccurrence(ev) : ev;
    return this.toTaskList(shown, await this.calendarColor(calendarId), this.settings.categories(this.sub));
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
    this.checkTaskData(d, before);
  }

  /** Read-modify-write of a shared list: synchronous, so no other write can slip in; a pinned stale `If-Match` is a 412. */
  private modifyShared(id: string, fn: (d: TaskListData) => TaskListData, ifMatch?: string): TaskList {
    const doc = this.shared!.access(this.sub, id);
    if (ifMatch && !etagEq(ifMatch, `"${doc.rev}"`)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
    const before = doc.data;
    const d = { ...fn(before) };
    this.finalize(before, d);
    const moved = d.categoryId !== before.categoryId;
    // only the owner's categories are meaningful on the list (feature shared-lists)
    if (moved && doc.owner !== this.sub) throw validation('Only the owner can change the category of a shared list', 'categoryId', 'sharing.categoryOwnerOnly');
    this.shared!.save(doc, d, moved ? this.categoryInfo(d.categoryId) : undefined);
    return this.toSharedTaskList(doc, '#039be5');
  }

  /** The look of one of this person's categories, as carried on a shared list. */
  private categoryInfo(categoryId: string | null): CategoryInfo | null {
    const c = this.settings.categories(this.sub).find((x) => x.id === categoryId);
    return c ? { name: c.name, color: c.color, icon: c.icon } : null;
  }

  /**
   * Read-modify-write; on a provider-side 412 re-reads and retries (up to 3 attempts) unless `ifMatch` is pinned. With
   * `occurrence` (item changes) a write addressed to a repeating series goes to its first occurrence instead.
   */
  private async modify(id: string, fn: (d: TaskListData) => TaskListData, ifMatch?: string, reminders?: Reminders, occurrence = false): Promise<TaskList> {
    if (isSharedId(id)) {
      if (reminders) throw validation('Shared lists have no reminders', 'reminders', 'reminders.sharedList');
      return this.modifyShared(id, fn, ifMatch);
    }
    for (let attempt = 1; ; attempt++) {
      let cur = await this.locateKind(id, true);
      // ticking (or any item change) never changes the other weeks of a repeating list: split the first week off
      if (occurrence && cur.recurrence?.length && !cur.recurringEventId) cur = await this.series.firstOccurrence(cur);
      if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
      const before = decodeTaskList(cur, this.tz);
      const d = { ...fn(before) };
      this.finalize(before, d);
      try {
        const patch = encodeTaskListPatch(d, this.tz, this.colorFor(d), cur);
        if (reminders) patch.reminders = this.remindersOf(reminders, cur.reminders);
        const ev = await this.provider.patchEvent(cur.calendarId, cur.id, patch, { ifMatch: cur.etag });
        return this.toTaskList(ev, await this.calendarColor(ev.calendarId), this.settings.categories(this.sub));
      } catch (e) {
        if (e instanceof PreconditionFailedError) {
          if (ifMatch) throw preconditionFailed('This task list was changed elsewhere. Reload it and try again.');
          if (attempt < 3) continue;
        }
        throw e;
      }
    }
  }

  async updateTaskList(id: string, input: UpdateTaskListInput, ifMatch?: string, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') {
      const { title, ...rest } = input;
      if (title === undefined || Object.keys(rest).length) throw validation('Only the title changes for the following lists', 'scope');
      return this.series.forFollowing(id, (d) => ({ ...d, title }));
    }
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
        // an ink item (empty title) sent back with its id stays what it is
        const inked = new Set(d.items.filter((i) => i.ink).map((i) => i.id));
        next.items = input.items.filter((i) => i.title.trim() || (i.id && inked.has(i.id)))
          .map((i) => ({ id: i.id ?? nanoid(), title: i.title.trim(), done: i.done, ...(i.id && inked.has(i.id) ? { ink: true as const } : {}) }));
      }
      return next;
    }, ifMatch, input.reminders);
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
    // a series split by "this and following" goes with its later parts (same `series`, later start)
    if (cur.recurrence?.length && !cur.recurringEventId) await this.series.deleteLaterParts(cur);
  }

  /** `input.id` (optional, from the client) makes a repeated add idempotent: a list that holds that id already stays as it is. */
  async addItem(id: string, input: { id?: string; title: string; ink?: boolean; done?: boolean; index?: number }, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') {
      // one id in every list, unticked; a list that has it already (a repeated write) is left as it is
      const item: TaskItem = { id: input.id ?? nanoid(), title: input.title, done: false, ...(input.ink ? { ink: true as const } : {}) };
      return this.series.forFollowing(id, (d) => {
        if (d.items.some((i) => i.id === item.id)) return d;
        const items = [...d.items];
        items.splice(input.index === undefined ? items.length : Math.min(input.index, items.length), 0, item);
        return { ...d, items };
      });
    }
    return this.modify(id, (d) => {
      if (input.id && d.items.some((i) => i.id === input.id)) return d;
      const items = [...d.items];
      const item: TaskItem = { id: input.id ?? nanoid(), title: input.title, done: !!input.done, ...(input.ink ? { ink: true as const } : {}) };
      const at = input.index === undefined ? items.length : Math.min(input.index, items.length);
      items.splice(at, 0, item);
      return { ...d, items };
    }, undefined, undefined, true);
  }

  async patchItem(id: string, itemId: string, input: { title?: string; done?: boolean }, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') {
      // ticks stay with each list: only the text changes for the following ones
      const title = input.title;
      if (title === undefined || input.done !== undefined) throw validation('Only the item text changes for the following lists', 'scope');
      return this.series.forFollowing(id, (d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, title } : i)) }), requireItem(itemId));
    }
    let ticked = false;
    const list = await this.modify(id, (d) => {
      ticked = false;
      const idx = d.items.findIndex((i) => i.id === itemId);
      if (idx < 0) throw notFound('Item not found');
      const cur = d.items[idx]!;
      if (cur.ink && input.title !== undefined) throw validation('An ink item has no title', 'title');
      if (input.done === true && !cur.done) ticked = true;
      const items = [...d.items];
      items[idx] = { ...cur, title: input.title ?? cur.title, done: input.done ?? cur.done };
      return { ...d, items };
    }, undefined, undefined, true);
    if (ticked) this.motivation.award(this.sub, 'tick', itemId);
    return list;
  }

  async deleteItem(id: string, itemId: string, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') return this.series.forFollowing(id, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }), requireItem(itemId));
    return this.modify(id, (d) => {
      if (!d.items.some((i) => i.id === itemId)) throw notFound('Item not found');
      return { ...d, items: d.items.filter((i) => i.id !== itemId) };
    }, undefined, undefined, true);
  }

  async reorder(id: string, itemIds: string[]): Promise<TaskList> {
    return this.modify(id, (d) => {
      const ids = new Set(d.items.map((i) => i.id));
      if (itemIds.length !== ids.size || new Set(itemIds).size !== itemIds.length || itemIds.some((x) => !ids.has(x))) {
        throw validation('itemIds must contain every item id exactly once', 'itemIds');
      }
      const byId = new Map(d.items.map((i) => [i.id, i]));
      return { ...d, items: itemIds.map((x) => byId.get(x)!) };
    }, undefined, undefined, true);
  }

  // ---------- reads (see ItemQueries) ----------
  items(from: string, to: string, calendarIds?: string[], also?: { from: string; to: string }): ReturnType<ItemQueries['items']> { return this.queries.items(from, to, calendarIds, also); }
  openTaskLists(today: string, days: number): ReturnType<ItemQueries['openTaskLists']> { return this.queries.openTaskLists(today, days); }
  allOpenTaskLists(today: string): ReturnType<ItemQueries['allOpenTaskLists']> { return this.queries.allOpenTaskLists(today); }
  archivedTaskLists(today: string): ReturnType<ItemQueries['archivedTaskLists']> { return this.queries.archivedTaskLists(today); }
  summary(from: string, to: string): ReturnType<ItemQueries['summary']> { return this.queries.summary(from, to); }

  // ---------- sharing (see TaskSharing) ----------
  shareTaskList(id: string, personSub: string): Promise<TaskList> { return this.sharing!.shareTaskList(id, personSub); }
  unshareTaskList(id: string): Promise<TaskList> { return this.sharing!.unshareTaskList(id); }
  leaveTaskList(id: string): void { this.sharing!.leaveTaskList(id); }
  shareCategory(categoryId: string, personSub: string | null): Promise<Record<string, Person>> { return this.sharing!.shareCategory(categoryId, personSub); }

  // ---------- changes since (ADR 0025) ----------
  /**
   * What changed in this person's events and task lists since `prev` (null = nothing known: everything in full), for
   * `GET /api/changes`: Google through sync tokens, shared lists by comparing each list's version stamp with the one the
   * device last got. `forced` names event calendars to answer in full anyway.
   */
  async changesSince(prev: ChangeState | null, today: string, forced: ReadonlySet<string>): Promise<{ events: EventChanges; taskLists: TaskListChanges; state: ChangeState }> {
    const tasksId = await this.tasks.id();
    const color = await this.calendarColor(tasksId);
    const cats = this.settings.categories(this.sub);
    const feed = new CalendarChanges(this.provider, this.tz, {
      eventCalendars: () => this.eventCalendars(), tasksId,
      toEvent: (e, c) => this.toEvent(e, c.backgroundColor, c.defaultReminders), toTaskList: (e) => this.toTaskList(e, color, cats),
      noTokenUntil: this.noTokenUntil, health: this.calendarHealth, nowMs: () => this.clock.real(), contacts: { source: this.contacts, color: this.birthdaysColor() },
    }, today);
    const g = await feed.since(prev, forced);
    const stamps: Record<string, string> = {};
    const upserts: TaskList[] = [];
    for (const l of this.sharedTaskLists(color)) {
      const stamp = changeStamp(l);
      stamps[l.id] = stamp;
      if (prev?.shared[l.id] !== stamp) upserts.push(l);
    }
    const removed = Object.keys(prev?.shared ?? {}).filter((id) => !(id in stamps));
    return {
      events: g.events,
      taskLists: { ...g.taskLists, removed: [...g.taskLists.removed, ...removed], upserts: [...g.taskLists.upserts, ...upserts] },
      state: { ...g.state, shared: stamps },
    };
  }

  /** Cheap helper for tests/clients: local time label of an instant. */
  localTime(ms: number): string { return localTimeOf(ms, this.tz); }
}

/** What the cursor keeps of the calendar side: Google's tokens and the version stamp of every shared list the device holds. */
export interface ChangeState extends FeedState { shared: Record<string, string> }

/** A version stamp of a shared list as shown to this person: it also moves when a member or the owner's category look changes. */
const changeStamp = (l: TaskList): string => createHash('sha1').update(JSON.stringify(l)).digest('base64url').slice(0, 16);


/** Which occurrences of a repeating list a change is for: `following` = this and all later ones (feature tasklist-repeating); absent = the given id only. */
export type Scope = 'following' | undefined;

/** A check for {@link CalendarService} `forFollowing`: the shown occurrence must hold the item (else 404, as for one list). */
const requireItem = (itemId: string) => (d: TaskListData): void => {
  if (!d.items.some((i) => i.id === itemId)) throw notFound('Item not found');
};
