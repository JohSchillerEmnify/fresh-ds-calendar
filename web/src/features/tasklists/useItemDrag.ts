/**
 * Drag and drop of the item rows of one `TaskListView` (feature tasklist-items). Every row gets the calendar's own drag
 * controller (`motion/drag.ts`), so the pick-up tick, the lift, wobble and drop motion, the drag helper cat and the
 * reduced-motion handling are exactly the calendar's. Only the hit test differs: the places are the rows of this list.
 * On the Canvas (`compact`) a press anywhere on a note moves the note, so an item is picked up by its grip only.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { blockEnd, levelOf } from '@calendar/shared/subtasks';
import { createDragController, type DragContext, type DragController } from '@/motion/drag';
import { getMotionLevel } from '@/motion/level';
import { dropIndex, placeBlock, rowShifts, slotOffset } from './reorder';

/** Selector of the drag handle (`data-item-grip` in `TaskListView`); the Canvas leaves a press on it to the item. */
const ITEM_GRIP = '[data-item-grip]';
/** The writing area of an ink item (`InkLine`). */
const ROW = '[data-testid="tasklist-item"]';

/** Nearest ancestor that scrolls vertically (sheet body, tray, Tasks view): it auto-scrolls during a drag. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Pins the list's sheet (nearest fixed ancestor) in place while a row is held: a closing keyboard never slides it. */
function freezeSheet(row: HTMLElement): () => void {
  for (let n = row.parentElement; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position !== 'fixed') continue;
    const r = n.getBoundingClientRect();
    const { top, bottom, height } = n.style;
    Object.assign(n.style, { top: `${r.top}px`, bottom: 'auto', height: `${r.height}px` });
    return () => Object.assign(n.style, { top, bottom, height });
  }
  return () => {};
}

/** Sideways distance (px) of one level: a row is moved one level by dragging it this far (the indent in `TaskListView`). */
const LEVEL_PX = 28;
/** The row of a task's subtasks that travel with it while it is held: folded to nothing. */
const HELD_SUB = 'data-sub-held';

/** Where the dragged item will land: the gap (top and height in px from the top of the list) and the level it will get. */
export interface DropAim { top: number; height: number; level: number }

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
  /** No drag now (an item title is being edited). */
  disabled: () => boolean;
  /** The items of the list in row order (the levels decide which rows a held task takes along). */
  items: () => readonly { id: string; level?: number }[];
  /** A row was dropped on place `to` with the level `wanted` (also when only the level changed). */
  onMove: (itemId: string, to: number, wanted: number) => void;
}

/** Binds a drag controller to every item row of the list and keeps them in step with the rows; returns where the dragged item will land. */
export function useItemDrag(o: ItemDragOptions): Ref<DropAim | null> {
  const aim = ref<DropAim | null>(null);
  /** What the last hit test chose: the hovered row and the level the finger wanted (a drop replays both, so it lands in the shown gap) and the level the block gets. */
  let chosen = { to: 0, wanted: 0, level: 0 };
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
  /** The subtasks of the held task travel with it: their rows fold away for the drag. */
  function foldSubtasks(held: HTMLElement): void {
    const items = o.items();
    const at = items.findIndex((i) => i.id === held.dataset.itemId);
    if (at < 0) return;
    const rows = rowsOf();
    for (let i = at + 1; i < blockEnd(items, at); i++) rows[i]?.setAttribute(HELD_SUB, '');
  }
  function unfoldSubtasks(): void {
    o.root.value?.querySelectorAll(`[${HELD_SUB}]`).forEach((r) => r.removeAttribute(HELD_SUB));
  }
  /** Drops every shift at once (the rows are laid out in their final order, or the drag is over). */
  function clearRoom(): void {
    for (const r of rowsOf()) { r.style.transition = ''; r.style.transform = ''; }
  }

  function bind(row: HTMLElement): void {
    let fromGrip = false;
    let pickup: DragContext | null = null;
    /** The row's own place: where it was picked up, moved with the list since (a scroll, the keyboard closing). */
    const ownSpan = () => {
      const m = pickup!.moved().y;
      return { top: pickup!.originRect.top + m, bottom: pickup!.originRect.bottom + m };
    };
    let pen = false;
    let thaw: (() => void) | null = null;
    const onDown = (e: Event) => {
      fromGrip = !!(e.target as Element | null)?.closest?.(ITEM_GRIP);
      pen = (e as PointerEvent).pointerType === 'pen';
    };
    row.addEventListener('pointerdown', onDown, true);
    const ctl = createDragController<number>(row, {
      hitTest: (x, y, ctx) => {
        const rows = rowsOf();
        const from = rows.indexOf(row);
        const id = row.dataset.itemId ?? '';
        // rows that made room are measured at their layout place, so the drop index never depends on the shift
        const live = layoutSpans(rows);
        // the dragged row's own slot is where it was picked up, moved with the list since; the others are live
        pickup = ctx;
        const hovered = dropIndex(live.map((r, i) => (i === from ? ownSpan() : r)), y);
        // the sideways move decides the level; the item above and the three levels limit it
        const step = LEVEL_PX * scaleOf(row);
        const own = levelOf(o.items().find((i) => i.id === id) ?? {});
        const wanted = own + Math.round((x - ctx.originRect.left - ctx.grab.x) / step);
        const p = placeBlock(o.items(), id, hovered, wanted);
        if (!p) return null;
        chosen = { to: hovered, wanted, level: p.level };
        // the gap opens where the block lands: after row `p.after`
        const to = p.after < from ? p.after + 1 : p.after;
        // the controller adds the list's move itself: offsets are from the pick-up rect
        const fromPickup = live.map((r, i) => (i === from ? ctx.originRect : r));
        return { key: to, dx: (p.level - own) * step, dy: slotOffset(fromPickup, from, to) };
      },
      onDrop: () => {
        const id = row.dataset.itemId;
        const unchanged = chosen.to === rowsOf().indexOf(row) && chosen.level === levelOf(o.items().find((i) => i.id === id) ?? {});
        if (id && !unchanged) o.onMove(id, chosen.to, chosen.wanted);
      },
      disabled: () => o.disabled() || (o.gripOnly() && !fromGrip) || (!!o.penWrites?.() && pen && !fromGrip),
      scrollEl: () => scrollParent(row),
      onTarget: (t) => {
        held = t ? { row, to: t.key, own: ownSpan } : null;
        if (t) makeRoom(row, t.key, ownSpan); else if (ctl.state === 'dragging') makeRoom(row, null);
        const ul = o.root.value?.querySelector<HTMLElement>('ul');
        aim.value = t && pickup && ul ? { top: pickup.originRect.top + pickup.moved().y + (t.dy ?? 0) - ul.getBoundingClientRect().top, height: pickup.originRect.height, level: chosen.level } : null;
      },
      onStateChange: (st) => {
        if (st === 'dragging') { thaw ??= freezeSheet(row); foldSubtasks(row); }
        else if (st === 'idle') { thaw?.(); thaw = null; }
        if (st !== 'dragging') { held = null; aim.value = null; unfoldSubtasks(); }
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
  return aim;
}
