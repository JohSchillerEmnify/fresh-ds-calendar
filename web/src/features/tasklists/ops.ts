/**
 * Task list item operations. Each one is shown on the device at once and goes to the outbox (ADR 0031), which sends it in
 * order whenever there is a connection; a refused one is undone and reported there.
 */
import type { ChangeScope, TaskList } from '@/api/types';
import { moveTo } from './reorder';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';

/** Set or merge a patch for one item (tick / rename); `scope` `following` renames it in this and all later occurrences of a repeating list. */
export function patchItem(listId: string, itemId: string, patch: { title?: string; done?: boolean }, scope?: ChangeScope): void {
  useOutboxStore().patchItem(listId, itemId, patch, scope === 'following' ? scope : undefined);
}

/** Add an item at the end (`done`: already ticked); the add names the item's id, so a resend never adds it twice. */
export function addItem(listId: string, title: string, scope?: ChangeScope, done?: boolean): void {
  useOutboxStore().addItem(listId, title, scope === 'following' ? scope : undefined, done);
}

/** Remove an item; `done` is called at once (the change is kept in the outbox). */
export function removeItem(listId: string, itemId: string, title: string, done?: () => void, scope?: ChangeScope): void {
  useOutboxStore().deleteItem(listId, itemId, title, scope === 'following' ? scope : undefined);
  done?.();
}

/** Move an item to index `to` (a drag and drop). */
export function moveItemTo(listId: string, itemId: string, to: number): void {
  const tl = useItemsStore().get(listId) as TaskList | undefined;
  if (tl?.kind !== 'tasklist') return;
  const ids = tl.items.map((i) => i.id);
  if (!ids.includes(itemId)) return;
  useOutboxStore().orderItems(listId, moveTo(ids, ids.indexOf(itemId), to));
}
