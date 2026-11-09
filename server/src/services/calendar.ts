import { createHash } from 'node:crypto';
import { LIST_ITEMS_MAX } from '@calendar/shared/limits';
import type {
  Calendar, CalendarEvent, CalendarItem, Category, CategoryInfo, CreateBirthdayInput, CreateEventInput, CreateTaskListInput, Reminders, SummaryDay, TaskItem, TaskList, Person,
  UpdateEventInput, UpdateTaskListInput,
} from '../api/types.js';
import type { AppConfig } from '../config.js';
import type { Clock } from '../lib/clock.js';
import { GOOGLE_CALENDAR_COLORS, GOOGLE_COLORS, onColor, type CalendarColor } from '@calendar/shared/colors';
import { ApiException, forbidden, notFound, preconditionFailed, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { addDays, dayNumber, formatInZone, isDateTime, isLocalDate, localDateOf, localTimeOf, startOfLocalDay, zonedToUtc } from '../lib/time.js';
import {
  NotFoundError, PreconditionFailedError, type CalendarProvider, type GoogleEvent, type GoogleEventInput, type GoogleEventPatch, type GoogleReminder,
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
import { birthdayCreateBody, birthdayDateLocked, birthdayPatch } from './birthday.js';
import { placeLeads, placeOf, placeProps } from './place.js';
import { calHash, logEvent } from '../lib/diag.js';
import { hasWriteRole, readOnlyReason } from './ownership.js';
import { CalendarChanges, type CalendarHealth, type EventChanges, type FeedState, type TaskListChanges } from './changeFeed.js';
import { isSharedId, SHARED_CALENDAR, SHARED_PREFIX, type SharedListDoc, type SharedListService } from './sharedLists.js';

const DAY = 86_400_000;
const CAL_TTL_MS = 30_000;
/** Google's calendar palette is the same for everyone; kept for the process once Google has answered. */
let palette: CalendarColor[] | null = null;
/** When Google last failed to give the palette: the built-in copy serves for a while instead of asking on every poll. */
let paletteFailedAt = 0;
/** Calendar id prefix of Google's contacts "Birthdays" calendar (`addressbook#contacts@group.v.calendar.google.com`). */
const BIRTHDAY_CALENDAR_PREFIX = 'addressbook#contacts@';

/** Birthday kind of a Google event: by `eventType`, or by living in the contacts Birthdays calendar; `undefined` for ordinary events. */
function specialOf(ev: GoogleEvent): CalendarEvent['special'] {
  if (ev.eventType !== 'birthday' && !ev.calendarId.startsWith(BIRTHDAY_CALENDAR_PREFIX)) return undefined;
  return ev.birthdayProperties?.type === 'anniversary' ? 'anniversary' : 'birthday';
}

/** Google allows at most 5 reminders per event and 5 defaults per calendar (popup and email together). */
const MAX_REMINDERS = 5;
const popups = (list: GoogleReminder[] | undefined): number[] => (list ?? []).filter((r) => r.method === 'popup').map((r) => r.minutes);

const readOnlyBirthday = () => validation('Birthdays are read-only');
const notOwn = () => forbidden('Only your own events can be changed', 'calendar.event.notOwn');
/** An event of Google's contacts "Birthdays" calendar: made from contacts, never edited here. */
const inContactsCalendar = (ev: GoogleEvent) => ev.calendarId.startsWith(BIRTHDAY_CALENDAR_PREFIX);

export class CalendarService {
  private calCache: { at: number; cals: ProviderCalendar[] } | null = null;
  private calGen = 0;
  /** Calendars too large to walk for a sync token, and until when they are left alone (see {@link CalendarChanges}). */
  private readonly noTokenUntil = new Map<string, number>();
  /** Calendars Google keeps refusing, and their back-off (see {@link CalendarChanges}). */
  private readonly calendarHealth = new Map<string, CalendarHealth>();
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
    readonly sub: string,
    /** Shared lists (feature shared-lists); null where sharing is not wired (some unit tests). */
    private readonly shared: SharedListService | null = null,
  ) {
    this.tasks = new TasksCalendar(provider, prefs, sub, () => this.providerCalendars(), () => { this.dropCalendars(); });
  }

  private get tz() { return this.config.tz; }

  /** True while Google's rate limit is in force: what a read returns may be older than the last poll (API.md "Stale data"). */
  stale(): boolean {
    return (this.provider.cooldownMs?.() ?? 0) > 0;
  }
  invalidate(): void {
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

  /** Calendars that hold events: not switched off in Google's list and not the tasks calendar. */
  private async eventCalendars(): Promise<ProviderCalendar[]> {
    const tasksId = this.tasks.knownId();
    return (await this.providerCalendars()).filter((c) => !c.hidden && c.id !== tasksId);
  }

  async calendars(): Promise<Calendar[]> {
    this.dropCalendars(); // the endpoint always hits the provider (outages must surface)
    return (await this.eventCalendars()).map((c) => ({
      id: c.id, name: c.summary, color: c.backgroundColor, primary: c.primary, writable: hasWriteRole(c),
      defaultReminders: popups(c.defaultReminders),
    }));
  }

  /**
   * Replaces the popup default list of a calendar (`calendarList.patch`); email defaults stay. `tasksCalendar` addresses the
   * person's tasks calendar, which is not in {@link calendars}. A calendar the person can only read goes
   * to Google as well (the list entry is per person). Returns the list as stored.
   */
  async setDefaultReminders(id: string, minutes: number[], tasksCalendar = false): Promise<number[]> {
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
      kind: 'event', id: ev.id, calendarId: ev.calendarId, title: ev.summary ?? '', description: ev.description ?? '', location: ev.location ?? '', ...(place ? { place } : {}),
      allDay: !!ev.start.date, start: this.norm(ev.start), end: this.norm(ev.end), colorId,
      color: colorId ? GOOGLE_COLORS[colorId]!.hex : calColor, ...(special ? { special } : {}),
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

  // ---------- items ----------
  /** Events of the event calendars plus the task lists of the tasks calendar (`calendarIds` narrows both). */
  private async fetchRange(from: string, to: string, calendarIds?: string[], tasklistsOnly = false): Promise<CalendarItem[]> {
    const tasksId = await this.tasks.id();
    const cals = tasklistsOnly ? [] : (await this.eventCalendars()).filter((c) => !calendarIds || calendarIds.includes(c.id));
    const timeMin = formatInZone(startOfLocalDay(from, this.tz), this.tz);
    const timeMax = formatInZone(startOfLocalDay(to, this.tz), this.tz);
    const cats = this.settings.categories(this.sub);
    const eventLists = cals.map(async (c) => {
      const r = await this.provider.listEvents({ calendarId: c.id, timeMin, timeMax });
      // task-list-shaped events outside the tasks calendar are not task lists (ADR 0006)
      return r.items.filter((e) => e.status !== 'cancelled' && !isTaskListEvent(e)).map((e): CalendarItem => this.toEvent(e, c.backgroundColor, c.defaultReminders));
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
  ): Promise<{ items: CalendarItem[]; from: string; to: string; also?: { from: string; to: string }; syncedAt: string; stale?: true }> {
    const lists = await Promise.all([this.fetchRange(from, to, calendarIds), ...(also ? [this.fetchRange(also.from, also.to, calendarIds)] : [])]);
    const items = [...new Map(lists.flat().map((i) => [i.id, i])).values()];
    const keyed = items.map((i) => ({ i, k: this.sortKey(i) }));
    keyed.sort((a, b) => a.k[0].localeCompare(b.k[0]) || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3].localeCompare(b.k[3]));
    return { items: keyed.map((x) => x.i), from, to, ...(also ? { also } : {}), syncedAt: formatInZone(this.clock.real(), this.tz), ...(this.stale() ? { stale: true as const } : {}) };
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
    await this.requireOwnCalendar(calendarId);
    this.checkEventShape(input);
    const g: GoogleEventInput = { summary: input.title, ...this.gTimes(input) };
    if (input.description) g.description = input.description;
    if (input.location) g.location = input.location;
    if (input.place && placeLeads(input.location ?? '', input.place.name)) g.extendedProperties = { private: placeProps(input.place) as Record<string, string> };
    if (input.colorId) g.colorId = input.colorId;
    if (input.reminders && !input.reminders.useDefault) g.reminders = this.remindersOf(input.reminders);
    const ev = extra?.id && this.rawInsert ? await this.rawInsert(calendarId, { ...g, id: extra.id }) : await this.provider.insertEvent(calendarId, g);
    this.motivation.award(this.sub, 'create');
    return this.toEvent(ev, await this.calendarColor(calendarId));
  }

  /** A yearly birthday in the primary calendar, with exactly the fields Google accepts (`birthdayCreateBody`). */
  async createBirthday(input: CreateBirthdayInput): Promise<CalendarEvent> {
    const calendarId = await this.primaryId();
    const cal = (await this.eventCalendars()).find((c) => c.id === calendarId);
    if (cal && !hasWriteRole(cal)) throw forbidden('The primary calendar is read-only', 'calendar.birthday.readOnly');
    const ev = await this.provider.insertEvent(calendarId, birthdayCreateBody(input.title, input.date, input.colorId));
    this.motivation.award(this.sub, 'create');
    return this.toEvent(ev, await this.calendarColor(calendarId));
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    return (await this.mapOne(await this.locateKind(id, false))) as CalendarEvent;
  }

  async updateEvent(id: string, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> {
    const cur = await this.locateKind(id, false);
    if (specialOf(cur)) return this.updateBirthday(cur, input, ifMatch);
    const reason = onlyReminders(input) ? readOnlyReason(cur, await this.providerCalendars()) : null;
    if (reason) return this.updateReadOnlyReminders(cur, input.reminders!, reason.kind === 'calendar');
    await this.requireOwnEvent(cur);
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
    if (m.calendarId !== cur.calendarId) { await this.requireCalendar(m.calendarId); await this.requireOwnCalendar(m.calendarId); }
    this.checkEventShape(m);
    const patch: GoogleEventPatch = {
      summary: m.title, description: m.description || null as unknown as string, location: m.location || null as unknown as string,
      colorId: m.colorId, ...this.gTimes(m),
    };
    if (input.reminders) patch.reminders = this.remindersOf(input.reminders, cur.reminders);
    // the place is kept only while it still leads the location; a changed location without one clears stale properties
    if (input.place !== undefined || input.location !== undefined) {
      const place = input.place === undefined ? placeOf(cur) ?? null : input.place;
      patch.extendedProperties = { private: placeProps(place && placeLeads(m.location, place.name) ? place : null) };
    }
    let ev = await this.provider.patchEvent(cur.calendarId, id, patch, { ifMatch: ifMatch ?? cur.etag });
    if (m.calendarId !== cur.calendarId) ev = await this.provider.moveEvent(cur.calendarId, id, m.calendarId);
    return this.toEvent(ev, await this.calendarColor(ev.calendarId));
  }

  /**
   * The person's reminders for an event they can only read (feature reminders). In a calendar shared read-only Google has no
   * per-event reminders (its UI only offers notifications for the whole calendar), so the app keeps them itself and Google is
   * never asked. An invitation in the person's own calendar is different: Google stores its `reminders` (per person), so only
   * that field is sent.
   */
  private async updateReadOnlyReminders(cur: GoogleEvent, input: Reminders, sharedCalendar: boolean): Promise<CalendarEvent> {
    const color = await this.calendarColor(cur.calendarId);
    if (!sharedCalendar) return this.toEvent(await this.provider.patchEvent(cur.calendarId, cur.id, { reminders: this.remindersOf(input, cur.reminders) }), color);
    this.prefs.reminderOverrides.set(this.sub, cur.calendarId, cur.id, { useDefault: input.useDefault, minutes: input.useDefault ? [] : input.minutes });
    return this.toEvent(cur, color);
  }

  async deleteEvent(id: string, ifMatch?: string): Promise<void> {
    const cur = await this.locateKind(id, false);
    if (specialOf(cur)) {
      await this.requireEditableBirthday(cur);
      if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
      // the whole yearly birthday goes, not one year of it (Google leaves Contacts alone)
      await this.provider.deleteEvent(cur.calendarId, cur.recurringEventId ?? id);
      return;
    }
    await this.requireOwnEvent(cur);
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    await this.provider.deleteEvent(cur.calendarId, id, ifMatch ? { ifMatch } : undefined);
  }

  /** Birthdays of the contacts calendar and of calendars the person cannot write stay read-only. */
  private async requireEditableBirthday(cur: GoogleEvent): Promise<void> {
    const cal = (await this.providerCalendars()).find((c) => c.id === cur.calendarId);
    if (inContactsCalendar(cur) || !hasWriteRole(cal)) throw readOnlyBirthday();
  }

  /** Start and end of the opened instance after the series moved to the month and day of `masterDate`. */
  private movedInstance(cur: GoogleEvent, masterDate: string): Pick<GoogleEvent, 'start' | 'end'> {
    const date = `${(cur.start.date ?? this.norm(cur.start)).slice(0, 4)}-${masterDate.slice(5)}`;
    return { start: { date }, end: { date: addDays(date, 1) } };
  }

  /**
   * Edits a birthday: the series (`recurringEventId` of the instance the person opened) is patched, never one year, and only
   * with the fields Google allows on a birthday. The answer is the opened instance with the change applied.
   */
  private async updateBirthday(cur: GoogleEvent, input: UpdateEventInput, ifMatch?: string): Promise<CalendarEvent> {
    await this.requireEditableBirthday(cur);
    if (ifMatch && !etagEq(ifMatch, cur.etag)) throw preconditionFailed('This event was changed elsewhere. Reload it and try again.');
    const master = cur.recurringEventId ? await this.provider.getEvent(cur.calendarId, cur.recurringEventId) : cur;
    const patch = birthdayPatch(master, cur.start.date ?? this.norm(cur.start), input);
    const color = await this.calendarColor(cur.calendarId);
    if (Object.keys(patch).length === 0) return this.toEvent(cur, color);
    const ev = await this.provider.patchEvent(cur.calendarId, master.id, patch, { ifMatch: master.etag });
    // show the instance that was opened: its id and day, with the new name, colour and (when moved) day
    const shown: GoogleEvent = { ...ev, id: cur.id, recurringEventId: cur.recurringEventId, ...(patch.start ? this.movedInstance(cur, patch.start.date!) : {}) };
    return this.toEvent(shown, color);
  }

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
    const shown = d.recurrence ? await this.firstOccurrence(ev) : ev;
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
   * The first occurrence of a repeating list (the instance on the master's own start day, as a range read lists it). An
   * item change addressed to the series lands here, so it becomes an exception of its own (feature adhd-support).
   */
  private async firstOccurrence(master: GoogleEvent): Promise<GoogleEvent> {
    const first = await this.occurrenceOn(master, decodeTaskList(master, this.tz).date!); // a repeating list always has a date
    // the first occurrence was deleted (or moved off its day): there is nothing of that week left to change
    if (!first) throw notFound('Task list not found');
    return first;
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
      if (occurrence && cur.recurrence?.length && !cur.recurringEventId) cur = await this.firstOccurrence(cur);
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

  /** The local date (and instant, when timed) of an occurrence by its series' rule (`originalStartTime`, else its start). */
  private ruleStart(ev: GoogleEvent): { date: string; ms: number | null } {
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
    await this.modify(master.id, change);
    for (const e of exceptions) if (e.status !== 'cancelled') await this.modify(e.id, change);
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
  private async forFollowing(id: string, change: (d: TaskListData) => TaskListData, check?: (d: TaskListData) => void): Promise<TaskList> {
    const cur = isSharedId(id) ? null : await this.locateKind(id, true);
    const seriesId = cur?.recurringEventId ?? (cur?.recurrence?.length ? cur.id : null);
    if (!cur || !seriesId) throw validation('This list does not repeat', 'scope');
    check?.(decodeTaskList(cur, this.tz));
    const master = cur.id === seriesId ? cur : await this.locateKind(seriesId, true);
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
      return this.getTaskList(id);
    }
    // the shown occurrence: an exception of the old series from now on
    await this.modify(cur.id, change);
    await this.splitAt(master, shown, change, parts);
    return this.getTaskList(id);
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
      const cur = await this.locateKind(master.id, true);
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
    this.checkTaskData(d, base);
    const g = encodeTaskList(d, this.tz, this.colorFor(d));
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
    dd.completedOn = nextCompletedOn(data, dd, this.today());
    const patch = encodeTaskListPatch(dd, this.tz, this.colorFor(dd), inst);
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

  async updateTaskList(id: string, input: UpdateTaskListInput, ifMatch?: string, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') {
      const { title, ...rest } = input;
      if (title === undefined || Object.keys(rest).length) throw validation('Only the title changes for the following lists', 'scope');
      return this.forFollowing(id, (d) => ({ ...d, title }));
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
    if (cur.recurrence?.length && !cur.recurringEventId) {
      const root = cur.extendedProperties?.private?.series ?? cur.id;
      const r = await this.provider.listEvents({ calendarId: cur.calendarId, privateExtendedProperty: ['kind=tasklist', `series=${root}`], singleEvents: false });
      const from = this.ruleStart(cur).date;
      for (const e of r.items) {
        if (e.recurrence?.length && !e.recurringEventId && e.status !== 'cancelled' && e.id !== cur.id && this.ruleStart(e).date > from) await this.provider.deleteEvent(e.calendarId, e.id);
      }
    }
  }

  /** `input.id` (optional, from the client) makes a repeated add idempotent: a list that holds that id already stays as it is. */
  async addItem(id: string, input: { id?: string; title: string; ink?: boolean; done?: boolean; index?: number }, scope?: Scope): Promise<TaskList> {
    if (scope === 'following') {
      // one id in every list, unticked; a list that has it already (a repeated write) is left as it is
      const item: TaskItem = { id: input.id ?? nanoid(), title: input.title, done: false, ...(input.ink ? { ink: true as const } : {}) };
      return this.forFollowing(id, (d) => {
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
      return this.forFollowing(id, (d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, title } : i)) }), requireItem(itemId));
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
    if (scope === 'following') return this.forFollowing(id, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }), requireItem(itemId));
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
    if (d.categoryId !== null && !this.settings.categories(this.sub).some((c) => c.id === d.categoryId)) d.categoryId = null;
    const calendarId = await this.tasks.id();
    const ev = await this.provider.insertEvent(calendarId, encodeTaskList(d, this.tz, this.colorFor(d)));
    this.shared!.releaseInk(doc);
    this.shared!.remove(doc);
    return this.toTaskList(ev, await this.calendarColor(calendarId), this.settings.categories(this.sub));
  }

  /** "Leave" (member): the list disappears for this person only. */
  leaveTaskList(id: string): void {
    const doc = this.shared!.access(this.sub, id);
    if (doc.owner === this.sub) throw forbidden('The owner deletes the list or stops sharing it', 'sharing.ownerCannotLeave');
    this.shared!.setMembers(doc, doc.members.filter((m) => m !== this.sub));
  }

  /**
   * Shares a category with a person (or, with `null`, stops): every list of the category moves into (out of) the shared
   * store, and lists created in it later are created shared (feature shared-lists). Returns the person's category rules.
   */
  async shareCategory(categoryId: string, personSub: string | null): Promise<Record<string, Person>> {
    const shared = this.shared!;
    if (!this.settings.categories(this.sub).some((c) => c.id === categoryId)) throw notFound('Category not found');
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
      noTokenUntil: this.noTokenUntil, health: this.calendarHealth, nowMs: () => this.clock.real(),
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
    const cats = this.settings.categories(this.sub);
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
    const cats = this.settings.categories(this.sub);
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

/** What the cursor keeps of the calendar side: Google's tokens and the version stamp of every shared list the device holds. */
export interface ChangeState extends FeedState { shared: Record<string, string> }

/** A version stamp of a shared list as shown to this person: it also moves when a member or the owner's category look changes. */
const changeStamp = (l: TaskList): string => createHash('sha1').update(JSON.stringify(l)).digest('base64url').slice(0, 16);

/** True when an update changes nothing but the reminders. */
const onlyReminders = (input: UpdateEventInput): boolean => {
  const keys = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  return keys.length === 1 && keys[0] === 'reminders';
};
const etagEq = (a: string, b: string) => a.replace(/^W\//, '').replaceAll('"', '') === b.replace(/^W\//, '').replaceAll('"', '');

/** The RRULE line of a series (other lines, e.g. EXDATE, may come first). */
const ruleLine = (m: GoogleEvent): string => m.recurrence?.find((l) => l.startsWith('RRULE:')) ?? '';

/** The recurrence lines with the RRULE ended at `until` (any UNTIL / COUNT replaced, other lines and parts kept). */
const withUntil = (lines: string[], until: string): string[] => lines.map((l) => (l.startsWith('RRULE:')
  ? `RRULE:${[...l.slice(6).split(';').filter((x) => x && !/^(UNTIL|COUNT)=/.test(x)), `UNTIL=${until}`].join(';')}` : l));

/** RFC 5545 UNTIL of an occurrence's rule start: a date for an all-day series, the UTC instant for a timed one. */
const untilValue = (at: { date: string; ms: number | null }): string => (at.ms === null
  ? at.date.replaceAll('-', '') : new Date(at.ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));

/** Which occurrences of a repeating list a change is for: `following` = this and all later ones (feature tasklist-repeating); absent = the given id only. */
export type Scope = 'following' | undefined;

/** A check for {@link CalendarService} `forFollowing`: the shown occurrence must hold the item (else 404, as for one list). */
const requireItem = (itemId: string) => (d: TaskListData): void => {
  if (!d.items.some((i) => i.id === itemId)) throw notFound('Item not found');
};
