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

/** Nearest ancestor that scrolls vertically (sheet body, tray, Tasks view): it auto-scrolls during a drag. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

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
    let seenScroll: number | null = null;
    const onDown = (e: Event) => { fromGrip = !!(e.target as Element | null)?.closest?.(ITEM_GRIP); };
    row.addEventListener('pointerdown', onDown, true);
    const ctl = createDragController<number>(row, {
      hitTest: (_x, y, ctx) => {
        const rows = rowsOf();
        const from = rows.indexOf(row);
        const sp = scrollParent(row);
        if (seenScroll === null) seenScroll = sp?.scrollTop ?? 0;
        const shift = (sp?.scrollTop ?? 0) - seenScroll;
        const live = rows.map((r) => r.getBoundingClientRect());
        // the dragged row's own slot is where it was picked up, moved up by the scroll since; the others are live
        const own = { top: ctx.originRect.top - shift, bottom: ctx.originRect.bottom - shift };
        const to = dropIndex(live.map((r, i) => (i === from ? own : r)), y);
        // the controller adds the scroll shift itself: offsets are from the pick-up rect
        const fromPickup = live.map((r, i) => (i === from ? ctx.originRect : r));
        return { key: to, dx: 0, dy: slotOffset(fromPickup, from, to) };
      },
      onDrop: (t) => {
        if (t.key !== rowsOf().indexOf(row) && row.dataset.itemId) o.onMove(row.dataset.itemId, t.key);
      },
      disabled: () => o.disabled() || (o.gripOnly() && !fromGrip),
      scrollEl: () => scrollParent(row),
      onStateChange: (st) => { if (st === 'idle') seenScroll = null; },
      scale: () => (row.offsetWidth ? row.getBoundingClientRect().width / row.offsetWidth : 1),
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
