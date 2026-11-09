/** Hit-test factories for the drag controller: 15-minute time slots and day cells. */
import { clamp } from './spring';
import type { DragContext, DropTarget } from './dragTypes';

const snap = (v: number, step: number) => Math.round(v / step) * step;

export interface SlotGridOptions {
  /** Bounding rect of the whole grid (all day columns, from 00:00 at the top). Read live (scroll!). */
  rect: () => DOMRect | null;
  /** Number of day columns (1 for the day view, 7 for the week). */
  columns: number;
  /** Pixels per minute (hour height / 60). */
  pxPerMinute: number;
  /** Width of a leading gutter (time labels) inside rect. */
  gutter?: number;
  /** Snap step in minutes (default 15). */
  step?: number;
  /** Minutes-of-day at the top of rect (default 0), e.g. 480 when the grid starts at 08:00. Added to key.minutes. */
  startMinutes?: number;
}
export interface SlotKey { column: number; minutes: number }

/**
 * Hit-test for time grids. The card's top edge snaps to the slot; dx/dy move it there. Sideways it moves by whole
 * columns only: a card drawn in the right part of its column (side by side, cascaded) keeps that place and stays under
 * the finger instead of jumping to the column's left edge.
 */
export function createSlotGrid(o: SlotGridOptions): (x: number, y: number, ctx: DragContext) => DropTarget<SlotKey> | null {
  const step = o.step ?? 15;
  const gutter = o.gutter ?? 0;
  return (x, y, ctx) => {
    const r = o.rect();
    if (!r) return null;
    const colW = (r.width - gutter) / o.columns;
    const columnAt = (px: number) => clamp(Math.floor((px - r.left - gutter) / colW), 0, o.columns - 1);
    const column = columnAt(x);
    const maxMin = r.height / o.pxPerMinute - step;
    const topY = y - ctx.grab.y - r.top;
    const minutes = clamp(snap(topY / o.pxPerMinute, step), 0, Math.max(0, Math.round(maxMin / step) * step));
    return {
      key: { column, minutes: minutes + (o.startMinutes ?? 0) },
      dx: (column - columnAt(ctx.originRect.left + ctx.grab.x)) * colW,
      dy: r.top + minutes * o.pxPerMinute - ctx.originRect.top,
    };
  };
}

export interface CellGridOptions<K> {
  /** Current cells: rect + key. Called per move; keep it cheap (e.g. NodeList mapping). */
  cells: () => { el: Element; key: K }[];
}

/** Hit-test for day cells (month view, all-day row): the cell under the pointer. */
export function createCellGrid<K>(o: CellGridOptions<K>): (x: number, y: number, ctx: DragContext) => DropTarget<K> | null {
  return (x, y, ctx) => {
    for (const c of o.cells()) {
      const r = c.el.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        return { key: c.key, dx: r.left - ctx.originRect.left + (r.width - ctx.originRect.width) / 2, dy: r.top - ctx.originRect.top + 2 };
      }
    }
    return null;
  };
}
