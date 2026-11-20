/**
 * Task list item operations. Each one is shown on the device at once and goes to the outbox (ADR 0031), which sends it in
 * order whenever there is a connection; a refused one is undone and reported there.
 */
import type { ChangeScope, TaskList } from '@/api/types';
import { TITLE_MAX } from '@calendar/shared/limits';
import { levelOf } from '@calendar/shared/subtasks';
import type { SingleTask } from './format';
import { applyPlacement, placeBlock } from './reorder';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';

/** Set or merge a patch for one item (tick / rename); `scope` `following` renames it in this and all later occurrences of a repeating list. */
export function patchItem(listId: string, itemId: string, patch: { title?: string; done?: boolean }, scope?: ChangeScope): void {
  useOutboxStore().patchItem(listId, itemId, patch, scope === 'this' ? undefined : scope);
}

/** Add an item at the end (`done`: already ticked); the add names the item's id, so a resend never adds it twice. Returns that id. */
export function addItem(listId: string, title: string, scope?: ChangeScope, done?: boolean, level?: number): string {
  return useOutboxStore().addItem(listId, title, scope === 'this' ? undefined : scope, done, level);
}

/** Tick (or untick) the one task of a one-line list; a title-only list moves its title into the one ticked item and has no title after (it is then the same as a list of one item). */
export function toggleSingleTask(listId: string, task: SingleTask): void {
  if (task.item) { patchItem(listId, task.item.id, { done: !task.done }); return; }
  addItem(listId, task.text.slice(0, TITLE_MAX), 'this', true);
  useOutboxStore().updateList(listId, { title: '' });
}

/** Remove an item; `done` is called at once (the change is kept in the outbox). */
export function removeItem(listId: string, itemId: string, title: string, done?: () => void, scope?: ChangeScope, keepSubtasks?: boolean): void {
  useOutboxStore().deleteItem(listId, itemId, title, scope === 'this' ? undefined : scope, keepSubtasks);
  done?.();
}

/** Move an item (with its subtasks) to row `to` at level `wanted` (a drag and drop; a no-op drop sends nothing). */
export function moveItemTo(listId: string, itemId: string, to: number, wanted = 0): void {
  const tl = useItemsStore().get(listId) as TaskList | undefined;
  if (tl?.kind !== 'tasklist') return;
  const p = placeBlock(tl.items, itemId, to, wanted);
  if (!p) return;
  const { ids, levels } = applyPlacement(tl.items, itemId, p);
  if (ids.every((id, n) => id === tl.items[n]!.id && levels[n] === levelOf(tl.items[n]!))) return;
  useOutboxStore().orderItems(listId, ids, levels);
}
