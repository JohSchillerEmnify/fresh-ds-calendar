import type { CalendarProvider, ProviderCalendar } from '../providers/CalendarProvider.js';
import type { PrefsStore } from './prefsStore.js';

/** Summary of the secondary calendar that holds one person's task lists (feature tasklists-own-calendar). */
export const TASKS_CALENDAR_SUMMARY = 'Calendar app: tasks';

/**
 * Finds or creates one person's tasks calendar: the id stored in their prefs, else an owned calendar with
 * {@link TASKS_CALENDAR_SUMMARY} in the calendar list, else a new one (hidden in Google's list). Parallel callers share one in-flight lookup, so two calendars are never created.
 */
export class TasksCalendar {
  private pending: Promise<string> | null = null;
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

  /** The tasks calendar id; finds or creates the calendar on first use. */
  id(): Promise<string> {
    if (this.known) return Promise.resolve(this.known);
    this.pending ??= this.resolve().finally(() => { this.pending = null; });
    return this.pending;
  }

  /** Forgets the resolved id (the stored one is checked against Google again on next use). */
  forget(): void {
    this.known = null;
  }

  private async resolve(): Promise<string> {
    const cals = await this.calendars();
    // a stored id whose calendar was deleted in Google falls through to the lookup by name
    const stored = this.prefs.tasksCalendarId(this.sub);
    let id = stored && cals.some((c) => c.id === stored) ? stored : null;
    id ??= cals.find((c) => c.summary === TASKS_CALENDAR_SUMMARY && c.accessRole === 'owner')?.id ?? null;
    id ??= await this.create();
    if (id !== stored) this.prefs.setTasksCalendarId(this.sub, id);
    this.known = id;
    return id;
  }

  private async create(): Promise<string> {
    const cal = await this.provider.insertCalendar(TASKS_CALENDAR_SUMMARY);
    await this.provider.setCalendarHidden(cal.id, true);
    this.changed();
    return cal.id;
  }
}
