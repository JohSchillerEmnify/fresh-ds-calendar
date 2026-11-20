/** Sends what the item lines of the task list form changed, through the item operations the expanded list uses (device first, in order). */
import type { ChangeScope, InkStroke, TaskItem, TaskList } from '@/api/types';
import { TITLE_MAX } from '@calendar/shared/limits';
import { levelOf } from '@calendar/shared/subtasks';
import { useOutboxStore } from '@/stores/outbox';
import { finalOrder, type ItemLine, type ItemPlan } from './itemEdits';
import { addItem, patchItem, removeItem } from './ops';

/** `plan` was made against `seen` (the items when the form opened): only those are removed or renamed, newer items stay after the others; order and levels go last. */
export function saveItemEdits(list: TaskList, seen: readonly TaskItem[], lines: readonly ItemLine[], plan: ItemPlan, ink: readonly InkStroke[][], scope?: ChangeScope): void {
  const outbox = useOutboxStore();
  const live = new Set(list.items.map((i) => i.id));
  const newer = list.items.filter((i) => !seen.some((s) => s.id === i.id));
  plan.deletes.filter((d) => live.has(d.id)).forEach((d) => removeItem(list.id, d.id, d.title, undefined, scope, true));
  plan.renames.filter((r) => live.has(r.id)).forEach((r) => patchItem(list.id, r.id, { title: r.title.slice(0, TITLE_MAX) }, scope));
  const added = new Map(plan.adds.map((n) => [n, addItem(list.id, lines[n]!.title.slice(0, TITLE_MAX), scope, undefined, lines[n]!.level)] as const));
  const inked = ink.map((strokes) => outbox.addInkItem(list.id, strokes));
  const order = finalOrder(seen, lines, plan, (n) => added.get(n)!, inked, newer.length > 0 && plan.adds.length + inked.length > 0);
  if (!order) return;
  const [ids, levels] = [[...order.ids], [...order.levels]];
  const keep = ids.map((id) => live.has(id) || [...added.values(), ...inked].includes(id));
  newer.forEach((i) => { ids.push(i.id); levels.push(levelOf(i)); keep.push(true); });
  outbox.orderItems(list.id, ids.filter((_, n) => keep[n]), levels.filter((_, n) => keep[n]), scope);
}
