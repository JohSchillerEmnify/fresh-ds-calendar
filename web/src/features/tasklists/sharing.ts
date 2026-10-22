/**
 * Sharing actions of one task list (feature shared-lists), used by the task list view and dialog. Moving a list
 * into or out of the shared store gives it a new id, so the items cache swaps the old entry for the new one.
 */
import { api } from '@/api/client';
import type { Person, TaskList } from '@/api/types';
import { useItemsStore } from '@/stores/items';
import { useTaskListsStore } from './store';

/** Whether the list is shared with somebody else and the requester is only a member (no delete, no category change). */
export const isMemberOnly = (tl: TaskList | null | undefined): boolean => !!tl?.shared && !tl.shared.owned;

/** The badge's letter: the initial of the other person on a shared list, or null when nobody else is on it. */
export function badgeInitial(tl: TaskList): string | null {
  return tl.shared?.with[0]?.initial ?? null;
}

/** The names of the other people on the list, for tooltips and the dialog. */
export const withNames = (people: Person[]): string => people.map((p) => p.name).join(', ');

function swap(oldId: string, next: TaskList): void {
  const items = useItemsStore();
  if (next.id !== oldId) items.remove(oldId);
  items.upsert(next);
  void useTaskListsStore().refresh().catch(() => undefined);
}

/** Shares the list with a person (the list moves into the shared store). */
export async function shareList(id: string, personSub: string): Promise<void> {
  swap(id, await api.shareTaskList(id, personSub));
}

/** "Stop sharing" (owner): the list moves back into the owner's Google tasks calendar. */
export async function unshareList(id: string): Promise<void> {
  swap(id, await api.unshareTaskList(id));
}

/** "Leave" (member): the list disappears for this person only. */
export async function leaveList(id: string): Promise<void> {
  await api.leaveTaskList(id);
  useItemsStore().remove(id);
  void useTaskListsStore().refresh().catch(() => undefined);
}
