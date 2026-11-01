/**
 * Drag and drop of the item rows of one `TaskListView` (feature tasklist-items). Every row gets the calendar's own drag
 * controller (`motion/drag.ts`), so the pick-up tick, the lift, wobble and drop motion, the drag helper cat and the
 * reduced-motion handling are exactly the calendar's. Only the hit test differs: the places are the rows of this list.
 * On the Canvas (`compact`) a press anywhere on a note moves the note, so an item is picked up by its grip only.
 */
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { createDragController, type DragController } from '@/motion/drag';
import { getMotionLevel } from '@/motion/level';
import { dropIndex, rowShifts, slotOffset } from './reorder';

/** Selector of the drag handle (`data-item-grip` in `TaskListView`); the Canvas leaves a press on it to the item. */
export const ITEM_GRIP = '[data-item-grip]';
/** The writing area of an ink item (`InkLine`). */
const INK_LINE = '[data-testid="ink-line"]';
const ROW = '[data-testid="tasklist-item"]';

/** Nearest ancestor that scrolls vertically (sheet body, tray, Tasks view): it auto-scrolls during a drag. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Duration of the other rows' move out of the way (ms); none under reduced motion. */
const MAKE_ROOM_MS = 150;

export interface ItemDragOptions {
  /** The list's root element, which holds the rows. */
  root: Ref<HTMLElement | null>;
  /** Changes whenever rows appear, go or change order, so new rows get a controller. */
  signature: () => string;
  /** Items are picked up by their grip only (a note on the Canvas). */
  gripOnly: () => boolean;
  /** Handwriting is on: a pen anywhere but on the grip writes instead of moving the row (decision R3). */
  penWrites?: () => boolean;
  /** Handwriting is on with "Draw with finger": a finger on the ink line writes too, so a long press there must not lift the row under the stroke. */
  fingerWrites?: () => boolean;
  /** No drag now (an item title is being edited). */
  disabled: () => boolean;
  /** A row was dropped on place `to` (never called for the place it came from). */
  onMove: (itemId: string, to: number) => void;
}

/** Binds a drag controller to every item row of the list and keeps them in step with the rows. */
export function useItemDrag(o: ItemDragOptions): void {
  const bound = new Map<HTMLElement, { ctl: DragController; unlisten: () => void }>();

  const rowsOf = (): HTMLElement[] => Array.from(o.root.value?.querySelectorAll<HTMLElement>(ROW) ?? []);

  /** Scale of the list's ancestors (a zoomed Canvas): a translate of 1 px moves a row by this many screen px. */
  const scaleOf = (r: HTMLElement) => (r.offsetWidth ? r.getBoundingClientRect().width / r.offsetWidth : 1);
  /** Screen px a row is shifted by right now, also mid-transition (read from the computed transform). */
  const shiftOf = (r: HTMLElement): number => {
    const t = getComputedStyle(r).transform;
    return !t || t === 'none' ? 0 : new DOMMatrix(t).m42 * scaleOf(r);
  };
  /** Layout places of the rows: their rects without the shift the other rows carry to make room. */
  const layoutSpans = (rows: HTMLElement[]) => rows.map((r) => { const b = r.getBoundingClientRect(), s = shiftOf(r); return { top: b.top - s, bottom: b.bottom - s }; });

  /** The row being dragged, the place it hovers and where it sat at pick-up, so a gap can be reopened after a re-layout. */
  let held: { row: HTMLElement; to: number; own: () => { top: number; bottom: number } } | null = null;

  /** Moves the rows other than `lifted` so that a gap opens at place `to` (null: everything back). */
  function makeRoom(lifted: HTMLElement, to: number | null, own?: () => { top: number; bottom: number }): void {
    const rows = rowsOf();
    const from = rows.indexOf(lifted);
    // the lifted card's live rect is scaled and tilted: its own place is its pick-up rect
    const spans = layoutSpans(rows).map((r, i) => (i === from && own ? own() : r));
    const shifts = to === null ? rows.map(() => 0) : rowShifts(spans, from, to);
    const animated = getMotionLevel() === 'full';
    rows.forEach((r, i) => {
      if (i === from) return;
      r.style.transition = animated ? `transform ${MAKE_ROOM_MS}ms ease-out` : 'none';
      r.style.transform = shifts[i] ? `translateY(${shifts[i] / scaleOf(r)}px)` : '';
    });
  }
  /** Drops every shift at once (the rows are laid out in their final order, or the drag is over). */
  function clearRoom(): void {
    for (const r of rowsOf()) { r.style.transition = ''; r.style.transform = ''; }
  }

  function bind(row: HTMLElement): void {
    let fromGrip = false;
    let seenScroll: number | null = null;
    let pickup: DOMRect | null = null;
    /** The row's own place: where it was picked up, moved up by the scroll since. */
    const ownSpan = () => {
      const sp = scrollParent(row);
      const shift = (sp?.scrollTop ?? 0) - (seenScroll ?? 0);
      return { top: pickup!.top - shift, bottom: pickup!.bottom - shift };
    };
    let pen = false;
    let finger = false;
    const onDown = (e: Event) => {
      fromGrip = !!(e.target as Element | null)?.closest?.(ITEM_GRIP);
      pen = (e as PointerEvent).pointerType === 'pen';
      finger = (e as PointerEvent).pointerType === 'touch' && !!(e.target as Element | null)?.closest?.(INK_LINE);
    };
    row.addEventListener('pointerdown', onDown, true);
    const ctl = createDragController<number>(row, {
      hitTest: (_x, y, ctx) => {
        const rows = rowsOf();
        const from = rows.indexOf(row);
        const sp = scrollParent(row);
        if (seenScroll === null) seenScroll = sp?.scrollTop ?? 0;
        const shift = (sp?.scrollTop ?? 0) - seenScroll;
        // rows that made room are measured at their layout place, so the drop index never depends on the shift
        const live = layoutSpans(rows);
        // the dragged row's own slot is where it was picked up, moved up by the scroll since; the others are live
        pickup = ctx.originRect;
        const own = { top: ctx.originRect.top - shift, bottom: ctx.originRect.bottom - shift };
        const to = dropIndex(live.map((r, i) => (i === from ? own : r)), y);
        // the controller adds the scroll shift itself: offsets are from the pick-up rect
        const fromPickup = live.map((r, i) => (i === from ? ctx.originRect : r));
        return { key: to, dx: 0, dy: slotOffset(fromPickup, from, to) };
      },
      onDrop: (t) => {
        if (t.key !== rowsOf().indexOf(row) && row.dataset.itemId) o.onMove(row.dataset.itemId, t.key);
      },
      disabled: () => o.disabled() || (o.gripOnly() && !fromGrip) || (!!o.penWrites?.() && pen && !fromGrip) || (!!o.fingerWrites?.() && finger && !fromGrip),
      scrollEl: () => scrollParent(row),
      onTarget: (t) => {
        held = t ? { row, to: t.key, own: ownSpan } : null;
        if (t) makeRoom(row, t.key, ownSpan); else if (ctl.state === 'dragging') makeRoom(row, null);
      },
      onStateChange: (st) => {
        if (st === 'idle') seenScroll = null;
        if (st !== 'dragging') held = null;
        // a drop reorders the rows at once; a cancel lets the rows glide back until the card has settled
        if (st === 'dropping' || st === 'idle') clearRoom();
        else if (st === 'returning') makeRoom(row, null);
      },
      scale: () => scaleOf(row),
    });
    bound.set(row, { ctl, unlisten: () => row.removeEventListener('pointerdown', onDown, true) });
  }

  function sync(): void {
    const rows = new Set(rowsOf());
    for (const [row, b] of bound) {
      if (!rows.has(row)) { b.ctl.destroy(); b.unlisten(); bound.delete(row); clearRoom(); }
    }
    // a row that went mid-drag cleared every shift: open the gap again for the current target
    if (held && rows.has(held.row)) makeRoom(held.row, held.to, held.own);
    for (const row of rows) if (!bound.has(row)) bind(row);
  }

  onMounted(sync);
  watch(o.signature, sync, { flush: 'post' });
  onBeforeUnmount(() => {
    for (const b of bound.values()) { b.ctl.destroy(); b.unlisten(); }
    bound.clear();
    clearRoom();
  });
}
