import type { CalendarProvider, ProviderCalendar } from '../providers/CalendarProvider.js';
import type { TasksState } from '@calendar/shared/tasks-state';
import { ApiException } from '../lib/errors.js';
import type { PrefsStore } from './prefsStore.js';

/** Summary of the secondary calendar that holds one person's task lists (feature tasklists-own-calendar). */
export const TASKS_CALENDAR_SUMMARY = 'Calendar app: tasks';

const tasksOff = () => new ApiException('CONFLICT', 409, 'Task lists are off: turn them on first', undefined, 'tasks.off');


/**
 * One person's tasks calendar: the id stored in their prefs, else an owned calendar with {@link TASKS_CALENDAR_SUMMARY}
 * in the calendar list. Reads only {@link find} it; it is created only by {@link enable} (the person's confirmation) or
 * by a write after that. Parallel callers share one in-flight lookup, so two calendars are never created.
 */
export class TasksCalendar {
  private pending: Promise<string | null> | null = null;
  private known: string | null = null;

  constructor(
    private readonly provider: CalendarProvider,
    private readonly prefs: PrefsStore,
    private readonly sub: string,
    /** The person's calendar list (the caller's cached copy). */
    private readonly calendars: () => Promise<ProviderCalendar[]> = () => provider.listCalendars(),
    /** Called after a calendar was created or changed, so cached calendar lists are dropped. */
    private readonly changed: () => void = () => {},
  ) {}

  /** The tasks calendar id when it is known without asking Google (stored or resolved earlier). */
  knownId(): string | null {
    return this.known ?? this.prefs.tasksCalendarId(this.sub);
  }

  /** The tasks calendar id when the calendar exists; never creates it. */
  find(): Promise<string | null> {
    if (this.known) return Promise.resolve(this.known);
    this.pending ??= this.lookup().finally(() => { this.pending = null; });
    return this.pending;
  }

  /** The tasks calendar id for a write; creates the calendar when the person confirmed task lists, else task lists are off. */
  async id(): Promise<string> {
    const found = await this.find();
    if (found) return found;
    if (this.prefs.tasksChoice(this.sub) !== 'on') throw tasksOff();
    return this.create();
  }

  /** An existing calendar means the person had task lists before this was asked: they stay on without a question. */
  async state(): Promise<TasksState> {
    if (await this.find()) return 'on';
    return this.prefs.tasksChoice(this.sub) ?? 'ask';
  }

  /** The person's confirmation: remembers it and creates the calendar once. */
  async enable(): Promise<string> {
    this.prefs.setTasksChoice(this.sub, 'on');
    return this.id();
  }

  /** "Not now": nothing is created; task lists stay off until {@link enable}. */
  async decline(): Promise<void> {
    if (!(await this.find())) this.prefs.setTasksChoice(this.sub, 'off');
  }

  /** Forgets the resolved id (the stored one is checked against Google again on next use). */
  forget(): void {
    this.known = null;
  }

  private async lookup(): Promise<string | null> {
    const cals = await this.calendars();
    // a stored id whose calendar was deleted in Google falls through to the lookup by name
    const stored = this.prefs.tasksCalendarId(this.sub);
    let id = stored && cals.some((c) => c.id === stored) ? stored : null;
    id ??= cals.find((c) => c.summary === TASKS_CALENDAR_SUMMARY && c.accessRole === 'owner')?.id ?? null;
    if (id && id !== stored) this.prefs.setTasksCalendarId(this.sub, id);
    this.known = id;
    return id;
  }

  private async create(): Promise<string> {
    // two writers right after the confirmation share one creation
    this.pending ??= (async () => {
      const cal = await this.provider.insertCalendar(TASKS_CALENDAR_SUMMARY);
      // the API call only asks Google's list to leave the calendar out; whether Google's apps show it is Google's choice
      await this.provider.setCalendarHidden(cal.id, true);
      this.changed();
      this.prefs.setTasksCalendarId(this.sub, cal.id);
      this.known = cal.id;
      return cal.id;
    })().finally(() => { this.pending = null; });
    return (await this.pending)!;
  }
}
