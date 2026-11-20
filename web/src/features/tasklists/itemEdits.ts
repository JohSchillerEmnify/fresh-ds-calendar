/** The item lines of the task list form: changed lines become the item operations the expanded list sends, so a kept or renamed item keeps its tick. */
import type { TaskItem } from '@/api/types';
import { blockIds, indentOf, levelOf } from '@calendar/shared/subtasks';

export interface ItemLine { title: string; level: number }

/** The text lines of the form for a list's items; a handwritten item has no text and stays out of them. */
export const linesOfItems = (items: readonly TaskItem[]): string => items.filter((i) => !i.ink).map((i) => indentOf(i) + i.title).join('\n');

export interface ItemPlan {
  /** Items whose line has another text. */
  renames: { id: string; title: string }[];
  /** Items whose line is gone. */
  deletes: { id: string; title: string }[];
  /** Lines without an item, by index in the lines. */
  adds: number[];
  /** Subtasks of a deleted item that stay: a delete takes its subtasks along, so the levels are flattened first. */
  flatten: boolean;
  /** For each line, the index (among the list's text items) of the item it keeps, -1 = a new item. */
  keptBy: number[];
}

/** Longest common run of titles between the old items and the new lines: the pairs (item index, line index) that keep their item. */
function matches(old: string[], now: string[]): [number, number][] {
  const best: number[][] = Array.from({ length: old.length + 1 }, () => new Array<number>(now.length + 1).fill(0));
  for (let i = old.length - 1; i >= 0; i--) for (let j = now.length - 1; j >= 0; j--) best[i]![j] = old[i] === now[j] ? best[i + 1]![j + 1]! + 1 : Math.max(best[i + 1]![j]!, best[i]![j + 1]!);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < old.length && j < now.length;) {
    if (old[i] === now[j]) { out.push([i, j]); i++; j++; } else if (best[i + 1]![j]! >= best[i]![j + 1]!) i++; else j++;
  }
  return out;
}

/** Which item each line belongs to: equal titles stay together; in a gap between them the lines and the items that are left pair up in order as renames. */
export function planItemEdits(existing: readonly TaskItem[], lines: readonly ItemLine[]): ItemPlan {
  const text = existing.filter((i) => !i.ink);
  const keptBy = new Array<number>(lines.length).fill(-1);
  const renames: ItemPlan['renames'] = [];
  const same = matches(text.map((i) => i.title), lines.map((l) => l.title));
  const gone: number[] = [];
  let [oi, li] = [0, 0];
  const gap = (toOld: number, toLine: number) => {
    const olds = Array.from({ length: toOld - oi }, (_, k) => oi + k);
    const news = Array.from({ length: toLine - li }, (_, k) => li + k);
    olds.slice(0, news.length).forEach((o, k) => { keptBy[news[k]!] = o; renames.push({ id: text[o]!.id, title: lines[news[k]!]!.title }); });
    gone.push(...olds.slice(news.length));
  };
  for (const [o, l] of [...same, [text.length, lines.length] as [number, number]]) {
    gap(o, l);
    if (o < text.length) keptBy[l] = o;
    [oi, li] = [o + 1, l + 1];
  }
  const dropped = new Set(gone.map((o) => text[o]!.id));
  const flatten = gone.some((o) => blockIds(existing, text[o]!.id).some((id) => id !== text[o]!.id && !dropped.has(id)));
  return {
    renames, deletes: gone.map((o) => ({ id: text[o]!.id, title: text[o]!.title })), flatten, keptBy,
    adds: keptBy.flatMap((k, l) => (k < 0 ? [l] : [])),
  };
}

/** The ids and levels the list ends with (`extra`: handwritten items added last); null when it already is that, so no order is sent. */
export function finalOrder(existing: readonly TaskItem[], lines: readonly ItemLine[], plan: ItemPlan, addedId: (line: number) => string, extra: readonly string[] = []): { ids: string[]; levels: number[] } | null {
  const text = existing.filter((i) => !i.ink);
  const inkAfter = new Map<string | null, TaskItem[]>();
  let anchor: string | null = null;
  for (const i of existing) { if (i.ink) inkAfter.set(anchor, [...(inkAfter.get(anchor) ?? []), i]); else anchor = i.id; }
  const ids: string[] = [];
  const levels: number[] = [];
  const push = (id: string, level: number) => { ids.push(id); levels.push(level); };
  const inkOf = (a: string | null) => (inkAfter.get(a) ?? []).forEach((i) => push(i.id, levelOf(i)));
  inkOf(null);
  const kept = new Set<string>();
  lines.forEach((l, n) => {
    const o = plan.keptBy[n]!;
    if (o < 0) { push(addedId(n), l.level); return; }
    push(text[o]!.id, l.level);
    kept.add(text[o]!.id);
    inkOf(text[o]!.id);
  });
  // handwriting that followed a removed item goes to the end
  for (const [a, list] of inkAfter) if (a !== null && !kept.has(a)) list.forEach((i) => push(i.id, levelOf(i)));
  extra.forEach((id) => push(id, 0));
  const before = existing.filter((i) => !plan.deletes.some((d) => d.id === i.id));
  const tail = [...plan.adds.map(addedId), ...extra];
  const unchanged = ids.length === before.length + tail.length
    && ids.every((id, n) => id === (n < before.length ? before[n]!.id : tail[n - before.length]))
    && levels.every((lv, n) => n >= before.length || lv === levelOf(before[n]!));
  return unchanged && !plan.flatten ? null : { ids, levels };
}
