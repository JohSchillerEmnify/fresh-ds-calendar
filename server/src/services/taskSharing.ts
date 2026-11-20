import { forbidden, notFound, validation } from '../lib/errors.js';
import type { CategoryInfo, Person, TaskList } from '../api/types.js';
import { type CalendarProvider, type GoogleEvent } from '../providers/CalendarProvider.js';
import type { SettingsStore } from './settingsStore.js';
import { isSharedId, SHARED_PREFIX, type SharedListDoc, type SharedListService } from './sharedLists.js';
import { decodeTaskList, encodeTaskList, isTaskListEvent, type TaskListData } from './taskCodec.js';
import type { TasksCalendar } from './tasksCalendar.js';

/** Every answer to a share request takes at least this long (outside tests), so its duration does not tell whether the address names a person. */
export const SHARE_ANSWER_MS = 1000;

/** What sharing needs from {@link CalendarService}: lookups and mapping it shares with ordinary list reads. */
export interface SharingHost {
  locateKind(id: string, tasklist: boolean): Promise<GoogleEvent>;
  toSharedTaskList(doc: SharedListDoc, fallbackColor: string): TaskList;
  toTaskList(ev: GoogleEvent, calColor: string, cats: ReturnType<SettingsStore['categories']>): TaskList;
  categoryInfo(categoryId: string | null): CategoryInfo | null;
  colorFor(d: TaskListData): string | null;
  calendarColor(id: string): Promise<string>;
}

const repeating = () => validation('A repeating task list cannot be shared', 'recurrence', 'sharing.repeating');

/** Sharing of task lists and categories: moves lists between the tasks calendar and the shared store, and handles membership. */
export class TaskSharing {
  constructor(
    private readonly provider: CalendarProvider, private readonly settings: SettingsStore, private readonly tasks: TasksCalendar,
    private readonly shared: SharedListService, private readonly sub: string, private readonly tz: string, private readonly answerMs: () => number,
    private readonly host: SharingHost,
  ) {}

  /** Waits until a share answer has taken `answerMs` since `startedMs` (see {@link SHARE_ANSWER_MS}). */
  private async hold(startedMs: number): Promise<void> {
    const left = this.answerMs() - (Date.now() - startedMs);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
  }

  /**
   * Invites the person a typed address names to share a list (ADR 0047): nothing moves and nothing is looked up. Every
   * address, known or not, gets the same answer (the list as it was) after the same time.
   */
  async inviteToList(id: string, email: string): Promise<TaskList> {
    const started = Date.now();
    const shared = this.shared;
    // access first: a stranger learns nothing about the list, not even that the person was refused
    const doc = isSharedId(id) ? shared.accessOwned(this.sub, id) : null;
    const ev = doc ? null : await this.host.locateKind(id, true);
    const data = doc ? doc.data : decodeTaskList(ev!, this.tz);
    if (!doc && (data.recurrence || ev!.recurringEventId)) throw repeating();
    const address = shared.invitee(this.sub, email);
    const member = shared.personAt(address);
    if (!(doc && member && doc.members.includes(member.sub))) shared.invitations.send({ kind: 'list', target: id, owner: this.sub, title: data.title, address });
    const out = doc ? this.host.toSharedTaskList(doc, '#039be5') : this.host.toTaskList(ev!, await this.host.calendarColor(ev!.calendarId), this.settings.categories(this.sub));
    await this.hold(started);
    return out;
  }

  /** The invited person accepted (called on the owner's service): the list moves into the shared store, or the person joins the shared list. Returns the shared list's id. */
  async grantList(id: string, memberSub: string): Promise<string> {
    let doc = isSharedId(id) ? this.shared.accessOwned(this.sub, id) : null;
    if (doc) this.shared.setMembers(doc, [...doc.members, memberSub]);
    else doc = await this.moveIn(await this.host.locateKind(id, true), [memberSub]);
    this.shared.remember(this.sub, this.shared.person(memberSub));
    return SHARED_PREFIX + doc.id;
  }

  /** Moves one task list event into the shared store; the event is deleted only after the shared copy exists. */
  private async moveIn(ev: GoogleEvent, members: string[]): Promise<SharedListDoc> {
    const d = decodeTaskList(ev, this.tz);
    if (d.recurrence || ev.recurringEventId) throw repeating();
    const doc = this.shared.create(this.sub, members, d, this.host.categoryInfo(d.categoryId));
    this.shared.invitations.retarget(this.sub, ev.id, SHARED_PREFIX + doc.id);
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
    this.shared.invitations.retarget(this.sub, SHARED_PREFIX + doc.id, ev.id);
    return this.host.toTaskList(ev, await this.host.calendarColor(calendarId), this.settings.categories(this.sub));
  }

  /** "Leave" (member): the list disappears for this person only. */
  leaveTaskList(id: string): void {
    const doc = this.shared.access(this.sub, id);
    if (doc.owner === this.sub) throw forbidden('The owner deletes the list or stops sharing it', 'sharing.ownerCannotLeave');
    this.shared.setMembers(doc, doc.members.filter((m) => m !== this.sub));
  }

  /**
   * Invites the person a typed address names to share a category (every list of it, and new ones, once accepted), or with
   * `null` stops sharing it: the lists move back. Like {@link inviteToList} every address gets the same answer. Returns
   * the person's category rules.
   */
  async shareCategory(categoryId: string, email: string | null): Promise<Record<string, Person>> {
    const started = Date.now();
    const shared = this.shared;
    const category = this.settings.categories(this.sub).find((c) => c.id === categoryId);
    if (!category) throw notFound('Category not found');
    if (email === null) await this.applyCategoryShare(categoryId, null);
    else shared.invitations.send({ kind: 'category', target: categoryId, owner: this.sub, title: category.name, address: shared.invitee(this.sub, email) });
    await this.hold(started);
    return shared.rulesOf(this.sub);
  }

  /** The invited person accepted (called on the owner's service): the category's lists move into the shared store and new ones are created shared. */
  async grantCategory(categoryId: string, memberSub: string): Promise<void> {
    if (!this.settings.categories(this.sub).some((c) => c.id === categoryId)) throw notFound('Category not found');
    await this.applyCategoryShare(categoryId, this.shared.person(memberSub));
  }

  private async applyCategoryShare(categoryId: string, person: Person | null): Promise<void> {
    const shared = this.shared;
    const personSub = person?.sub ?? null;
    const previous = shared.ruleFor(this.sub, categoryId);
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
    if (person) shared.remember(this.sub, person);
  }
}
