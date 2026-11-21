/**
 * Pure logic of dragging a task list item to another place (feature tasklist-items): the new order after a move and
 * which place the pointer is over. No DOM, no state; `useItemDrag` and `ops.ts` use it.
 */

import { blockEnd, levelOf, MAX_LEVEL } from '@calendar/shared/subtasks';

/** Returns a copy of `list` with the element at `from` moved to index `to` (both clamped; out of range `from` changes nothing). */
export function moveTo<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const target = Math.min(Math.max(to, 0), list.length - 1);
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item);
  return out;
}

/** Vertical extent of a row in viewport px. */
export interface RowSpan { top: number; bottom: number }

/**
 * The place (row index) a dragged row would take when the pointer is at `y`: the row under the pointer, the first above
 * all rows and the last below them. `spans[from]` is the dragged row's own slot (its pick-up place).
 */
export function dropIndex(spans: readonly RowSpan[], y: number): number {
  if (!spans.length) return 0;
  const hit = spans.findIndex((s) => y >= s.top && y < s.bottom);
  if (hit >= 0) return hit;
  return y < spans[0].top ? 0 : spans.length - 1;
}

/**
 * Translation (px) that lands the dragged row `from` exactly in the slot of row `to`: moving up aligns the tops, moving
 * down aligns the bottoms (rows may differ in height), so the magnet snap does not overlap neighbours oddly.
 */
export function slotOffset(spans: readonly RowSpan[], from: number, to: number): number {
  if (to === from) return 0;
  return to < from ? spans[to].top - spans[from].top : spans[to].bottom - spans[from].bottom;
}

/**
 * Vertical shift (px) of every row while row `from` is lifted over place `to`, so the rows open a gap of the lifted
 * row's height (plus the spacing between rows) at `to`: moving down the rows after `from` up to `to` move up, moving up
 * the rows from `to` before `from` move down. `spans` are the rows' layout places (no shift applied); the lifted row's
 * own entry is 0 (it follows the pointer).
 */
export function rowShifts(spans: readonly RowSpan[], from: number, to: number, gap?: number): number[] {
  const out = spans.map(() => 0);
  if (from < 0 || from >= spans.length) return out;
  const own = spans[from];
  const spacing = from > 0 ? own.top - spans[from - 1].bottom : from + 1 < spans.length ? spans[from + 1].top - own.bottom : 0;
  const step = own.bottom - own.top + spacing;
  // the gap is as tall as the row will be at its new level (a title may wrap differently); the rows after it follow
  const grow = gap === undefined ? 0 : gap - (own.bottom - own.top);
  const [first, last] = to > from ? [from + 1, to] : [Math.max(to, 0), from - 1];
  const moved = to > from ? -step : step + grow;
  for (let i = from + 1; i < spans.length; i++) out[i] = grow;
  if (to !== from) for (let i = first; i <= last && i < spans.length; i++) out[i] = moved;
  return out;
}

/** Where a dropped block goes among the other items, and the level its first item gets. */
export interface Placement {
  /** Index among the items without the block. */
  index: number;
  level: number;
  /** The row after which the block lands (-1: the top); where the gap opens. */
  after: number;
}

/** Where the task `id` (with its subtasks) lands when dropped on row `to` at level `wanted`; below a task at its level or higher it goes after that task's subtasks. */
export function placeBlock(items: readonly { id: string; level?: number }[], id: string, to: number, wanted: number): Placement | null {
  const from = items.findIndex((i) => i.id === id);
  if (from < 0) return null;
  const end = blockEnd(items, from);
  const k = end - from;
  const rest = [...items.slice(0, from), ...items.slice(end)];
  const base = levelOf(items[from]!);
  const depth = Math.max(...items.slice(from, end).map(levelOf)) - base;
  let index = from;
  if (to < from) index = Math.max(to, 0);
  else if (to >= end) {
    const t = Math.min(to - k, rest.length - 1);
    index = wanted <= levelOf(rest[t]!) ? blockEnd(rest, t) : t + 1;
  }
  const levelAt = (i: number) => Math.max(0, Math.min(wanted, (i > 0 ? levelOf(rest[i - 1]!) : -1) + 1, MAX_LEVEL - depth));
  // the block must not split another: an item that is too deep to follow it would be re-parented, so the block goes after it
  while (index < rest.length && levelOf(rest[index]!) > levelAt(index) + depth + 1) index++;
  const level = levelAt(index);
  const after = index === 0 ? -1 : index - 1 < from ? index - 1 : index - 1 + k;
  return { index, level, after };
}

/** The ids and levels in the new order after the block of `id` was dropped as `placement` says. */
export function applyPlacement(items: readonly { id: string; level?: number }[], id: string, p: Placement): { ids: string[]; levels: number[] } {
  const from = items.findIndex((i) => i.id === id);
  const end = blockEnd(items, from);
  const shift = p.level - levelOf(items[from]!);
  const rest = [...items.slice(0, from), ...items.slice(end)];
  const moved = items.slice(from, end).map((i) => ({ id: i.id, level: levelOf(i) + shift }));
  const out = [...rest.slice(0, p.index).map((i) => ({ id: i.id, level: levelOf(i) })), ...moved, ...rest.slice(p.index).map((i) => ({ id: i.id, level: levelOf(i) }))];
  return { ids: out.map((i) => i.id), levels: out.map((i) => i.level) };
}

/** The places of a reference row's checkbox and grip (px from the left of the list; each a 48 px target). */
export interface RowParts { cb: { left: number; right: number }; grip: { left: number; right: number } | null }
/** The slot of a row at its target level: its left and right edge, and the left edge of its checkbox (all px from the left of the list). */
export interface SlotBox { left: number; right: number; cbLeft: number }
/** Room (px) between a 48 px target's edge and the drawn box or icon inside it, as the slot's inset: the slot encloses it with 8 px to spare. */
const INSET = { cb: 7, grip: 4 };

/** The dashed slot of a row at `level` from a reference row at `refLevel`: the indent moves the row's start (checkbox, or grip when mirrored); `binRoom` stops it before the bin. */
export function slotBox(ref: RowParts, refLevel: number, level: number, step: number, listWidth: number, binRoom: number): SlotBox {
  const shift = (level - refLevel) * step;
  const cbFirst = !ref.grip || ref.cb.left <= ref.grip.left;
  const cbLeft = ref.cb.left + (cbFirst ? shift : 0);
  if (cbFirst) return { left: cbLeft + INSET.cb, right: ref.grip ? ref.grip.right : listWidth - binRoom, cbLeft };
  return { left: ref.grip!.left + shift + INSET.grip, right: ref.cb.right - INSET.cb, cbLeft };
}
