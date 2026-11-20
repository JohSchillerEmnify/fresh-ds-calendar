/** The item lines of the task list form: changed lines become the item operations the expanded list sends, so a kept or renamed item keeps its tick. */
import type { TaskItem } from '@/api/types';
import { indentOf, levelOf } from '@calendar/shared/subtasks';

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

/** How much of the longer text two titles share (their common letters in order), 0 to 1: a rename is closest to the title it extends. */
function likeness(a: string, b: string): number {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  const row = new Array<number>(y.length + 1).fill(0);
  for (let i = 0; i < x.length; i++) {
    let diag = 0;
    for (let j = 0; j < y.length; j++) {
      const up = row[j + 1]!;
      row[j + 1] = x[i] === y[j] ? diag + 1 : Math.max(up, row[j]!);
      diag = up;
    }
  }
  return row[y.length]! / Math.max(x.length, y.length, 1);
}

/**
 * Which item each line belongs to: equal titles stay together, also when a line moved; the lines and items that are left
 * pair up as renames, each line with the most alike item of its gap (in order when none is alike); `replaceAll` keeps nothing.
 */
export function planItemEdits(existing: readonly TaskItem[], lines: readonly ItemLine[], replaceAll = false): ItemPlan {
  const text = existing.filter((i) => !i.ink);
  const keptBy = new Array<number>(lines.length).fill(-1);
  if (replaceAll) return { renames: [], deletes: existing.map((i) => ({ id: i.id, title: i.title })), keptBy, adds: lines.map((_, n) => n) };
  const used = new Set<number>();
  const same = matches(text.map((i) => i.title), lines.map((l) => l.title));
  for (const [o, l] of same) { keptBy[l] = o; used.add(o); }
  // a line that moved keeps its item
  lines.forEach((l, n) => {
    if (keptBy[n]! >= 0) return;
    const o = text.findIndex((i, k) => !used.has(k) && i.title === l.title);
    if (o >= 0) { keptBy[n] = o; used.add(o); }
  });
  const renames: ItemPlan['renames'] = [];
  const gap = (fromOld: number, toOld: number, fromLine: number, toLine: number) => {
    const olds = Array.from({ length: toOld - fromOld }, (_, k) => fromOld + k).filter((o) => !used.has(o));
    for (let n = fromLine; n < toLine; n++) {
      if (keptBy[n]! >= 0 || !olds.length) continue;
      const score = olds.map((o) => likeness(text[o]!.title, lines[n]!.title));
      const pick = Math.max(...score) > 0 ? score.indexOf(Math.max(...score)) : 0;
      const [o] = olds.splice(pick, 1);
      keptBy[n] = o!; used.add(o!);
      renames.push({ id: text[o!]!.id, title: lines[n]!.title });
    }
  };
  let [oi, li] = [0, 0];
  for (const [o, l] of [...same, [text.length, lines.length] as [number, number]]) { gap(oi, o, li, l); [oi, li] = [o + 1, l + 1]; }
  const deletes = text.flatMap((i, o) => (used.has(o) ? [] : [{ id: i.id, title: i.title }]));
  return { renames, deletes, keptBy, adds: keptBy.flatMap((k, l) => (k < 0 ? [l] : [])) };
}

/** The ids and levels the list ends with (`extra`: handwritten items added last); null when it already is that (unless `force`), so no order is sent. */
export function finalOrder(existing: readonly TaskItem[], lines: readonly ItemLine[], plan: ItemPlan, addedId: (line: number) => string, extra: readonly string[] = [], force = false): { ids: string[]; levels: number[] } | null {
  const text = existing.filter((i) => !i.ink);
  const inkAfter = new Map<string | null, TaskItem[]>();
  let anchor: string | null = null;
  const dropped = new Set(plan.deletes.map((d) => d.id));
  for (const i of existing) { if (dropped.has(i.id)) continue; if (i.ink) inkAfter.set(anchor, [...(inkAfter.get(anchor) ?? []), i]); else anchor = i.id; }
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
  const before = existing.filter((i) => !dropped.has(i.id));
  const tail = [...plan.adds.map(addedId), ...extra];
  const unchanged = ids.length === before.length + tail.length
    && ids.every((id, n) => id === (n < before.length ? before[n]!.id : tail[n - before.length]))
    && levels.every((lv, n) => n >= before.length || lv === levelOf(before[n]!));
  return unchanged && !force ? null : { ids, levels };
}
