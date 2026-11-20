/** Sends what the item lines of the task list form changed, through the item operations the expanded list uses (device first, in order). */
import type { ChangeScope, InkStroke, TaskList } from '@/api/types';
import { TITLE_MAX } from '@calendar/shared/limits';
import { useOutboxStore } from '@/stores/outbox';
import { finalOrder, type ItemLine, type ItemPlan } from './itemEdits';
import { addItem, patchItem, removeItem } from './ops';

/** A removed task takes its subtasks along, so levels are flattened first; the order and levels go last, in one operation. */
export function saveItemEdits(list: TaskList, lines: readonly ItemLine[], plan: ItemPlan, ink: readonly InkStroke[][], scope?: ChangeScope): void {
  const outbox = useOutboxStore();
  if (plan.flatten) outbox.orderItems(list.id, list.items.map((i) => i.id), list.items.map(() => 0));
  plan.deletes.forEach((d) => removeItem(list.id, d.id, d.title, undefined, scope));
  plan.renames.forEach((r) => patchItem(list.id, r.id, { title: r.title.slice(0, TITLE_MAX) }, scope));
  const added = new Map(plan.adds.map((n) => [n, addItem(list.id, lines[n]!.title.slice(0, TITLE_MAX), scope, undefined, lines[n]!.level)] as const));
  const inked = ink.map((strokes) => outbox.addInkItem(list.id, strokes));
  const order = finalOrder(list.items, lines, plan, (n) => added.get(n)!, inked);
  if (order) outbox.orderItems(list.id, order.ids, order.levels);
}
