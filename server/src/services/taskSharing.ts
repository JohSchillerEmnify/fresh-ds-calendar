import { forbidden, notFound, validation } from '../lib/errors.js';
import type { CategoryInfo, Person, TaskList } from '../api/types.js';
import { type CalendarProvider, type GoogleEvent } from '../providers/CalendarProvider.js';
import type { SettingsStore } from './settingsStore.js';
import { isSharedId, type SharedListDoc, type SharedListService } from './sharedLists.js';
import { decodeTaskList, encodeTaskList, isTaskListEvent, type TaskListData } from './taskCodec.js';
import type { TasksCalendar } from './tasksCalendar.js';

/** What sharing needs from {@link CalendarService}: lookups and mapping it shares with ordinary list reads. */
export interface SharingHost {
  locateKind(id: string, tasklist: boolean): Promise<GoogleEvent>;
  toSharedTaskList(doc: SharedListDoc, fallbackColor: string): TaskList;
  toTaskList(ev: GoogleEvent, calColor: string, cats: ReturnType<SettingsStore['categories']>): TaskList;
  categoryInfo(categoryId: string | null): CategoryInfo | null;
  colorFor(d: TaskListData): string | null;
  calendarColor(id: string): Promise<string>;
}

/** Sharing of task lists and categories: moves lists between the tasks calendar and the shared store, and handles membership. */
export class TaskSharing {
  constructor(
    private readonly provider: CalendarProvider, private readonly settings: SettingsStore, private readonly tasks: TasksCalendar,
    private readonly shared: SharedListService, private readonly sub: string, private readonly tz: string, private readonly host: SharingHost,
  ) {}

  /**
   * Shares a list with a person. A list of the tasks calendar MOVES into the shared store (same items and state, the
   * Google event is deleted once the shared copy is written); on a list this person already shares, the person is added.
   */
  async shareTaskList(id: string, personSub: string): Promise<TaskList> {
    const shared = this.shared;
    // access first: a stranger learns nothing about the list, not even that the person was refused
    const doc = isSharedId(id) ? shared.accessOwned(this.sub, id) : null;
    shared.requireMember(this.sub, personSub);
    if (doc) {
      shared.setMembers(doc, [...doc.members, personSub]);
      return this.host.toSharedTaskList(doc, '#039be5');
    }
    const moved = await this.moveIn(await this.host.locateKind(id, true), [personSub]);
    return this.host.toSharedTaskList(moved, '#039be5');
  }

  /** Moves one task list event into the shared store; the event is deleted only after the shared copy exists. */
  private async moveIn(ev: GoogleEvent, members: string[]): Promise<SharedListDoc> {
    const d = decodeTaskList(ev, this.tz);
    if (d.recurrence || ev.recurringEventId) throw validation('A repeating task list cannot be shared', 'recurrence', 'sharing.repeating');
    const doc = this.shared.create(this.sub, members, d, this.host.categoryInfo(d.categoryId));
    try {
      await this.provider.deleteEvent(ev.calendarId, ev.id);
    } catch (e) {
      this.shared.remove(doc);
      throw e;
    }
    return doc;
  }

  /** "Stop sharing" (owner): the list moves back into the owner's tasks calendar; everybody else loses it. */
  async unshareTaskList(id: string): Promise<TaskList> {
    return this.moveOut(this.shared.accessOwned(this.sub, id));
  }

  /** Creates the Google event first, then removes the shared copy, so a failure never loses the list. */
  private async moveOut(doc: SharedListDoc): Promise<TaskList> {
    const d: TaskListData = { ...doc.data, recurrence: null };
    // a category this person no longer has cannot be kept
    if (d.categoryId !== null && !this.settings.categories(this.sub).some((c) => c.id === d.categoryId)) d.categoryId = null;
    const calendarId = await this.tasks.id();
    const ev = await this.provider.insertEvent(calendarId, encodeTaskList(d, this.tz, this.host.colorFor(d)));
    this.shared.releaseInk(doc);
    this.shared.remove(doc);
    return this.host.toTaskList(ev, await this.host.calendarColor(calendarId), this.settings.categories(this.sub));
  }

  /** "Leave" (member): the list disappears for this person only. */
  leaveTaskList(id: string): void {
    const doc = this.shared.access(this.sub, id);
    if (doc.owner === this.sub) throw forbidden('The owner deletes the list or stops sharing it', 'sharing.ownerCannotLeave');
    this.shared.setMembers(doc, doc.members.filter((m) => m !== this.sub));
  }

  /**
   * Shares a category with a person (or, with `null`, stops): every list of the category moves into (out of) the shared
   * store, and lists created in it later are created shared (feature shared-lists). Returns the person's category rules.
   */
  async shareCategory(categoryId: string, personSub: string | null): Promise<Record<string, Person>> {
    const shared = this.shared;
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
}
