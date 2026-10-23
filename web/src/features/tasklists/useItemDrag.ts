/**
 * Drag and drop of the item rows of one `TaskListView` (feature tasklist-items). Every row gets the calendar's own drag
 * controller (`motion/drag.ts`), so the pick-up tick, the lift, wobble and drop motion, the drag helper cat and the
 * reduced-motion handling are exactly the calendar's. Only the hit test differs: the places are the rows of this list.
 * On the Canvas (`compact`) a press anywhere on a note moves the note, so an item is picked up by its grip only.
 */
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { createDragController, type DragController } from '@/motion/drag';
import { dropIndex, slotOffset } from './reorder';

/** Selector of the drag handle (`data-item-grip` in `TaskListView`); the Canvas leaves a press on it to the item. */
export const ITEM_GRIP = '[data-item-grip]';
const ROW = '[data-testid="tasklist-item"]';

export interface ItemDragOptions {
  /** The list's root element, which holds the rows. */
  root: Ref<HTMLElement | null>;
  /** Changes whenever rows appear, go or change order, so new rows get a controller. */
  signature: () => string;
  /** Items are picked up by their grip only (a note on the Canvas). */
  gripOnly: () => boolean;
  /** No drag now (an item title is being edited). */
  disabled: () => boolean;
  /** A row was dropped on place `to` (never called for the place it came from). */
  onMove: (itemId: string, to: number) => void;
}

/** Binds a drag controller to every item row of the list and keeps them in step with the rows. */
export function useItemDrag(o: ItemDragOptions): void {
  const bound = new Map<HTMLElement, { ctl: DragController; unlisten: () => void }>();

  const rowsOf = (): HTMLElement[] => Array.from(o.root.value?.querySelectorAll<HTMLElement>(ROW) ?? []);

  function bind(row: HTMLElement): void {
    let fromGrip = false;
    const onDown = (e: Event) => { fromGrip = !!(e.target as Element | null)?.closest?.(ITEM_GRIP); };
    row.addEventListener('pointerdown', onDown, true);
    const ctl = createDragController<number>(row, {
      hitTest: (_x, y, ctx) => {
        const rows = rowsOf();
        const from = rows.indexOf(row);
        // the dragged row's own slot is where it was picked up; the others have not moved
        const spans = rows.map((r, i) => (i === from ? ctx.originRect : r.getBoundingClientRect()));
        const to = dropIndex(spans, y);
        return { key: to, dx: 0, dy: slotOffset(spans, from, to) };
      },
      onDrop: (t) => {
        if (t.key !== rowsOf().indexOf(row) && row.dataset.itemId) o.onMove(row.dataset.itemId, t.key);
      },
      disabled: () => o.disabled() || (o.gripOnly() && !fromGrip),
    });
    bound.set(row, { ctl, unlisten: () => row.removeEventListener('pointerdown', onDown, true) });
  }

  function sync(): void {
    const rows = new Set(rowsOf());
    for (const [row, b] of bound) {
      if (!rows.has(row)) { b.ctl.destroy(); b.unlisten(); bound.delete(row); }
    }
    for (const row of rows) if (!bound.has(row)) bind(row);
  }

  onMounted(sync);
  watch(o.signature, sync, { flush: 'post' });
  onBeforeUnmount(() => {
    for (const b of bound.values()) { b.ctl.destroy(); b.unlisten(); }
    bound.clear();
  });
}
