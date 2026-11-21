/**
 * Sharing actions of one task list (feature shared-lists), used by the task list view and dialog. Moving a list
 * into or out of the shared store gives it a new id, so the items cache swaps the old entry for the new one.
 */
import { api } from '@/api/client';
import type { Person, TaskList } from '@/api/types';
import { useDeviceStore } from '@/stores/device';
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
  if (next.id !== oldId) { items.remove(oldId); useDeviceStore().drop(oldId); }
  items.upsert(next);
  void useTaskListsStore().refresh().catch(() => undefined);
}

/** Sends an invitation to share the list: it stays as it is until the other person accepts. */
export async function shareList(id: string, email: string): Promise<void> {
  swap(id, await api.shareTaskList(id, email.trim()));
}

/** Owner removes one person from the list; the list stays shared with the others (the last one moves it back). */
export async function removeMember(id: string, sub: string): Promise<void> {
  swap(id, await api.removeListMember(id, sub));
}

/** "Leave" (member): the list disappears for this person only. */
export async function leaveList(id: string): Promise<void> {
  await api.leaveTaskList(id);
  useItemsStore().remove(id);
  useDeviceStore().drop(id);
  void useTaskListsStore().refresh().catch(() => undefined);
}
