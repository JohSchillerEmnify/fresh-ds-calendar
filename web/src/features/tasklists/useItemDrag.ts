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
import { dropIndex, placeBlock, rowShifts, slotBox, slotOffset, type RowParts } from './reorder';

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

/** Pins the list's sheet in place while a row is held: a closing keyboard never slides it, and folding the held task's subtasks does not shrink a bottom sheet (which would move every row under the finger). */
function freezeSheet(row: HTMLElement): () => void {
  let panel: HTMLElement | null = null;
  for (let n = row.parentElement; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position !== 'fixed') { panel = n; continue; }
    const r = n.getBoundingClientRect();
    const { top, bottom, height } = n.style;
    Object.assign(n.style, { top: `${r.top}px`, bottom: 'auto', height: `${r.height}px` });
    // the panel is the layer's child that holds the list: it keeps its height (its own height was set by its content)
    const kept = panel?.style.height ?? '';
    if (panel) panel.style.height = `${panel.getBoundingClientRect().height}px`;
    const pinned = panel;
    return () => { Object.assign(n.style, { top, bottom, height }); if (pinned) pinned.style.height = kept; };
  }
  return () => {};
}

/** A drop target's key holds the place and the level, so a new level alone re-draws the gap. */
const KEY_LEVELS = 4;

/** Sideways distance (px) of one level: a row is moved one level by dragging it this far (the indent in `TaskListView`). */
const LEVEL_PX = 28;
/** How far (px) the finger sits inside the right end of the held card at pick-up. */
const CARD_TAIL = 24;
/** The row of a task's subtasks that travel with it while it is held: folded to nothing. */
const HELD_SUB = 'data-sub-held';

/** A box in px from the top left of the list. */
interface Box { top: number; height: number; left: number; width: number }
/** Where the dragged item will land: the slot (a box in the list) of the dragged item `title` with the level it will get, the left edge of its checkbox relative to the slot (`ghostX`), and the lit tree line of its new parent (none at the first level). */
export interface DropAim extends Box { level: number; title: string; ghostX: number; tree: Box | null }
/** The tree line starts this far (px) below the middle of the parent's checkbox, under the drawn box. */
const STEM_GAP = 12;
/** The width of the bin (px) and the room between the grip's right edge and the list's, for a row that shows no grip to measure. */
const BIN_WIDTH = 48;
const ROW_END = 4;

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
  let chosen = { to: 0, wanted: 0, level: 0, after: -1 };
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
  let held: { row: HTMLElement; to: number; own: () => { top: number; bottom: number }; gap?: number } | null = null;

  /** The shifts that open a gap of `gap` px (default: the lifted row's height) at place `to`; the lifted card's live rect is scaled and tilted, so its own place is its pick-up rect. */
  function roomShifts(rows: HTMLElement[], from: number, to: number, own?: () => { top: number; bottom: number }, gap?: number): number[] {
    const spans = layoutSpans(rows).map((r, i) => (i === from && own ? own() : r));
    return rowShifts(spans, from, to, gap);
  }

  /** Moves the rows other than `lifted` so that a gap opens at place `to` (null: everything back). */
  function makeRoom(lifted: HTMLElement, to: number | null, own?: () => { top: number; bottom: number }, gap?: number): void {
    const rows = rowsOf();
    const from = rows.indexOf(lifted);
    const shifts = to === null ? rows.map(() => 0) : roomShifts(rows, from, to, own, gap);
    const animated = getMotionLevel() === 'full';
    rows.forEach((r, i) => {
      if (i === from) return;
      r.style.transition = animated ? `transform ${MAKE_ROOM_MS}ms ease-out` : 'none';
      r.style.transform = shifts[i] ? `translateY(${shifts[i] / scaleOf(r)}px)` : '';
    });
  }

  /** Height (screen px) the held row will have at `level`: a hidden copy laid out at that indent, so a title that wraps differently there is counted. */
  function heightAt(row: HTMLElement, ul: HTMLElement, level: number): number {
    const copy = row.cloneNode(true) as HTMLElement;
    for (const n of [copy, ...copy.querySelectorAll('[data-testid],[id],[data-item-id]')]) for (const a of ['data-testid', 'id', 'data-item-id']) n.removeAttribute(a);
    copy.removeAttribute('data-dragging');
    copy.dataset.level = String(level);
    copy.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none;';
    copy.style.setProperty('--lvl', String(level));
    ul.appendChild(copy);
    const h = copy.getBoundingClientRect().height;
    copy.remove();
    return h;
  }

  const partsOf = (r: DOMRect, shifted: number, base: DOMRect, s: number) => ({ left: (r.left - shifted - base.left) / s, right: (r.right - shifted - base.left) / s });
  /** The slot of the block that lands at `chosen.level`: its box is measured from a row that stays (the held card itself, level 0, when it is alone), both ends, so a mirrored row works too. */
  function slotBoxes(held: HTMLElement, ul: HTMLElement, rows: HTMLElement[], shifts: number[], top: number): Pick<DropAim, 'left' | 'width' | 'ghostX' | 'tree'> {
    const ref = rows.find((r) => r !== held && !r.hasAttribute(HELD_SUB)) ?? held;
    const cb = ref.querySelector<HTMLElement>('[data-testid="tasklist-item-checkbox"]');
    const s = scaleOf(ul);
    const base = ul.getBoundingClientRect();
    if (!cb) return { left: 0, width: 0, ghostX: 0, tree: null };
    // the held card is shifted under the finger: its own place is the row's
    const shifted = ref === held ? (parseFloat(held.style.translate) || 0) * s : 0;
    const grip = ref === held ? null : ref.querySelector<HTMLElement>('.grip')?.getBoundingClientRect();
    const parts: RowParts = { cb: partsOf(cb.getBoundingClientRect(), shifted, base, s), grip: grip?.width ? partsOf(grip, 0, base, s) : null };
    const box = slotBox(parts, ref === held ? 0 : Number(ref.dataset.level) || 0, chosen.level, LEVEL_PX, base.width / s, o.gripOnly() ? ROW_END : ROW_END + BIN_WIDTH);
    return { left: box.left, width: box.right - box.left, ghostX: box.cbLeft - box.left, tree: treeLine(held, rows, shifts, base, s, top) };
  }
  /** The lit line of the new parent: from under the middle of its checkbox down to the top of the slot. */
  function treeLine(held: HTMLElement, rows: HTMLElement[], shifts: number[], base: DOMRect, s: number, slotTop: number): Box | null {
    const items = o.items();
    const from = items.findIndex((i) => i.id === held.dataset.itemId);
    if (from < 0 || chosen.level < 1) return null;
    const end = blockEnd(items, from);
    let parent = chosen.after;
    while (parent >= 0 && ((parent >= from && parent < end) || levelOf(items[parent]!) >= chosen.level)) parent--;
    const cb = parent < 0 ? null : rows[parent]?.querySelector<HTMLElement>('[data-testid="tasklist-item-checkbox"]')?.getBoundingClientRect();
    if (!cb || parent < 0) return null;
    // the rows move to make room: the line follows the place the parent is moving to (the same shifts as the rows get)
    const y = (cb.top + cb.bottom) / 2 - shiftOf(rows[parent]!) + (shifts[parent] ?? 0);
    const start = (y - base.top) / s + STEM_GAP;
    const x = ((cb.left + cb.right) / 2 - base.left) / s;
    return { top: start, height: slotTop - start, left: x - 1, width: 2 };
  }
  /** The subtasks of the held task travel with it: their rows fold away for the drag. */
  function foldSubtasks(held: HTMLElement): void {
    const items = o.items();
    const at = items.findIndex((i) => i.id === held.dataset.itemId);
    if (at < 0) return;
    const rows = rowsOf();
    // the list keeps its height, or a scrolled sheet clamps its scroll position and every row moves under the finger
    const ul = o.root.value?.querySelector<HTMLElement>('ul');
    if (ul) ul.style.minHeight = `${ul.offsetHeight}px`;
    for (let i = at + 1; i < blockEnd(items, at); i++) rows[i]?.setAttribute(HELD_SUB, '');
  }
  function unfoldSubtasks(): void {
    const ul = o.root.value?.querySelector<HTMLElement>('ul');
    if (ul) ul.style.minHeight = '';
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
    /** Where the press was (client x): the compact card is put under the finger there. */
    let downX = 0;
    let thaw: (() => void) | null = null;
    const onDown = (e: Event) => {
      fromGrip = !!(e.target as Element | null)?.closest?.(ITEM_GRIP);
      pen = (e as PointerEvent).pointerType === 'pen';
      downX = (e as PointerEvent).clientX;
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
        const step = LEVEL_PX * scaleOf(row.parentElement ?? row);
        const own = levelOf(o.items().find((i) => i.id === id) ?? {});
        const wanted = own + Math.round((x - ctx.originRect.left - ctx.grab.x) / step);
        const p = placeBlock(o.items(), id, hovered, wanted);
        if (!p) return null;
        chosen = { to: hovered, wanted, level: p.level, after: p.after };
        // the slot opens where the block lands: after row `p.after`; the card itself follows the finger freely
        const to = p.after < from ? p.after + 1 : p.after;
        // the controller adds the list's move itself: offsets are from the pick-up rect
        const fromPickup = live.map((r, i) => (i === from ? ctx.originRect : r));
        return { key: to * KEY_LEVELS + p.level, dx: 0, dy: slotOffset(fromPickup, from, to) };
      },
      onDrop: () => {
        const id = row.dataset.itemId;
        const unchanged = chosen.to === rowsOf().indexOf(row) && chosen.level === levelOf(o.items().find((i) => i.id === id) ?? {});
        if (id && !unchanged) o.onMove(id, chosen.to, chosen.wanted);
      },
      disabled: () => o.disabled() || (o.gripOnly() && !fromGrip) || (!!o.penWrites?.() && pen && !fromGrip),
      magnet: false,
      cardBox: () => ({ left: (parseFloat(row.style.translate) || 0) * scaleOf(row), width: row.offsetWidth * scaleOf(row) }),
      scrollEl: () => scrollParent(row),
      onTarget: (t) => {
        const ul = o.root.value?.querySelector<HTMLElement>('ul');
        // the gap is as tall as the row will be at the target level
        const gap = t && ul ? heightAt(row, ul, chosen.level) : undefined;
        held = t ? { row, to: Math.floor(t.key / KEY_LEVELS), own: ownSpan, gap } : null;
        if (t) makeRoom(row, held!.to, ownSpan, gap); else if (ctl.state === 'dragging') makeRoom(row, null);
        if (t && pickup && ul && gap !== undefined) {
          const s = scaleOf(ul);
          const top = (pickup.originRect.top + pickup.moved().y + (t.dy ?? 0) - ul.getBoundingClientRect().top) / s;
          const rows = rowsOf();
          const shifts = roomShifts(rows, rows.indexOf(row), held!.to, ownSpan, gap);
          aim.value = { top, height: gap / s, level: chosen.level, title: row.dataset.title ?? '', ...slotBoxes(row, ul, rows, shifts, top) };
        } else aim.value = null;
      },
      onStateChange: (st) => {
        if (st === 'dragging') {
          thaw ??= freezeSheet(row);
          foldSubtasks(row);
          // the row is the compact card now, put under the finger with the finger near its right end: moving right has room
          const grabX = downX - row.getBoundingClientRect().left;
          row.style.translate = `${Math.max(0, grabX / scaleOf(row) - row.offsetWidth + CARD_TAIL)}px 0`;
        } else {
          row.style.translate = '';
          if (st === 'idle') { thaw?.(); thaw = null; }
        }
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
    if (held && rows.has(held.row)) makeRoom(held.row, held.to, held.own, held.gap);
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
