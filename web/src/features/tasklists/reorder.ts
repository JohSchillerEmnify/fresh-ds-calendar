/**
 * Pure logic of dragging a task list item to another place (feature tasklist-items): the new order after a move and
 * which place the pointer is over. No DOM, no state; `useItemDrag` and `ops.ts` use it.
 */

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
export function rowShifts(spans: readonly RowSpan[], from: number, to: number): number[] {
  const out = spans.map(() => 0);
  if (from < 0 || from >= spans.length || to === from) return out;
  const own = spans[from];
  const spacing = from > 0 ? own.top - spans[from - 1].bottom : from + 1 < spans.length ? spans[from + 1].top - own.bottom : 0;
  const step = own.bottom - own.top + spacing;
  if (to > from) for (let i = from + 1; i <= to && i < spans.length; i++) out[i] = -step;
  else for (let i = Math.max(to, 0); i < from; i++) out[i] = step;
  return out;
}
