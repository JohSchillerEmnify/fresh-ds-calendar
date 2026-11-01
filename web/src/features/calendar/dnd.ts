/**
 * Shared drag and drop for calendar items (events and task lists), used by the event renderer and available to
 * the task list renderer:
 *
 *   const root = ref<HTMLElement | null>(null);               // the card's root element
 *   useCalendarDrag(root, () => props.segment, () => props.variant);
 *
 * What it does: picks the hit test from where the card lives (time grid block -> 15 min slots x day columns, chip in
 * the all-day row -> all-day cells, chip in the month -> month cells), shows a drop preview (grid layer
 * `DropIndicator`, `data-drop-target` on cells), and on drop moves the item with `applyMove`: optimistic store
 * update, PATCH with If-Match, rollback + spring back + snackbar on failure. Duration is preserved, timed stays
 * timed, all-day stays all-day (feature drag-to-reschedule), multi-day items move by the dragged day's delta.
 */
import { inject, nextTick, shallowRef, type Ref } from 'vue';
import { routerKey } from 'vue-router';
import type { CalendarEvent, CalendarItem, UpdateEventInput, UpdateTaskListInput } from '@/api/types';
import type { ItemVariant } from '@/extensions/registry';
import type { Segment } from '@/lib/items';
import { minutesToTime, routePath, shiftPeriod } from '@/lib/dates';
import { isPhone } from '@/composables/useViewport';
import { createCellGrid, createSlotGrid, haptic, useDraggable, type DragContext, type DropTarget } from '@/motion';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { useUiStore } from '@/stores/ui';
import { EDGE_HOLD_MS, edgeLabel, edgeSide } from './edgeTurn';
import { fromWallMinutes, localToIso, wallMinutes } from './zone';

/** Where the dragged card would land now (drives the `DropIndicator` grid layer). Null when not dragging. */
export const dragPreview = shallowRef<{ date: string; minutes: number; durationMin: number } | null>(null);

/**
 * The edge band while a dragged entry rests in an edge zone of the day or week view (feature drag-to-reschedule): which
 * side, the day or week a turn leads to, and where to draw it (client px). Null otherwise.
 */
export const edgeBand = shallowRef<{ side: 'left' | 'right'; label: string; left: number; right: number; top: number; bottom: number; y: number } | null>(null);
/** The time grid (`.tg`) a drag that turned the view is carried over: it keeps the all-day row open for the drop. */
export const carriedGrid = shallowRef<Element | null>(null);
/** The grid whose dragged entry may be dropped into the all-day row (a task list, or an entry that is not a timed block): its empty row shows as a drop target. */
export const alldayDropGrid = shallowRef<Element | null>(null);

export interface MoveTarget {
  date: string;
  /** Start minute of day (time grid); null = keep the time of day (month, all-day row). */
  minutes: number | null;
  /** Dropped on an all-day cell (not the month): task lists lose their time. */
  allDay?: boolean;
}

export interface MovePlan {
  next: CalendarItem;
  patch: UpdateEventInput | UpdateTaskListInput;
}

/** Pure: what dropping `seg` on `target` changes. Null when nothing changes. */
export function planMove(seg: Segment, target: MoveTarget, tz: string): MovePlan | null {
  const item = seg.item;
  if (item.kind === 'tasklist') {
    // time grid -> gets that time (snapped); all-day row -> loses it; month -> keeps whatever it had
    const time = target.minutes !== null ? minutesToTime(target.minutes) : target.allDay ? null : item.time;
    if (target.date === item.date && time === item.time) return null;
    const patch: UpdateTaskListInput = { date: target.date };
    if (time !== item.time) patch.time = time;
    return { next: { ...item, date: target.date, time }, patch };
  }
  const ev: CalendarEvent = item;
  if (ev.allDay) {
    const delta = wallMinutes(target.date, '00:00') - wallMinutes(seg.date, '00:00');
    if (delta === 0) return null;
    const shift = (d: string) => fromWallMinutes(wallMinutes(d, '00:00') + delta).date;
    const start = shift(ev.start), end = shift(ev.end);
    return { next: { ...ev, start, end }, patch: { start, end, allDay: true } };
  }
  const originTime = minutesToTime(seg.startMin);
  const targetTime = target.minutes !== null ? minutesToTime(target.minutes) : originTime;
  const delta = wallMinutes(target.date, targetTime) - wallMinutes(seg.date, originTime);
  if (delta === 0) return null;
  const move = (iso: string) => {
    const w = fromWallMinutes(wallMinutes(iso.slice(0, 10), iso.slice(11, 16)) + delta);
    return localToIso(w.date, w.time, tz);
  };
  const start = move(ev.start), end = move(ev.end);
  return { next: { ...ev, start, end }, patch: { start, end, allDay: false } };
}

/** Queues the move in the outbox; the card shows the new place at once. */
export async function applyMove(seg: Segment, target: MoveTarget): Promise<void> {
  const items = useItemsStore();
  const plan = planMove(seg, target, useClockStore().timeZone);
  if (!plan) return;
  const { item } = seg;
  const etag = items.get(item.id)?.etag ?? item.etag;
  useOutboxStore().changeItem(item, plan.next, plan.patch, etag);
}

type CellKey = string;

function setDropAttr(prev: Element | null, next: Element | null): Element | null {
  if (prev !== next) {
    prev?.removeAttribute('data-drop-target');
    next?.setAttribute('data-drop-target', 'true');
  }
  return next;
}

/** Makes the card draggable (long press on touch, press and move on mouse). Cleans up with the component scope. */
export function useCalendarDrag(el: Ref<HTMLElement | null | undefined>, segment: () => Segment, variant: () => ItemVariant, disabled?: () => boolean) {
  let marked: Element | null = null;
  // taken now, in setup: the drag may turn the view after this card's component is gone (null outside the app, in tests)
  const router = inject(routerKey, null);
  /** The time grid this drag started in; it outlives the card when the view turns. */
  let dragGrid: Element | null = null;
  /** The edge zone the pointer rests in, and the timer that turns the view after the hold. */
  let edge: 'left' | 'right' | null = null;
  let edgeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearEdge() {
    if (edgeTimer) clearTimeout(edgeTimer);
    edgeTimer = null;
    edge = null;
    edgeBand.value = null;
  }

  /** Shows or hides the band and (re)starts the hold timer as the pointer enters or leaves an edge zone of the grid. */
  function watchEdge(x: number, y: number, tg: Element) {
    const view = useCalendarStore().view;
    const cols = tg.classList.contains('fit') || (view !== 'day' && view !== 'week') ? []
      : [...tg.querySelectorAll<HTMLElement>('[data-testid="week-day-column"],[data-testid="day-column"]')];
    const box = tg.getBoundingClientRect();
    const first = cols[0]?.getBoundingClientRect(), last = cols[cols.length - 1]?.getBoundingClientRect();
    const side = first && last && y >= box.top && y <= box.bottom ? edgeSide(x, first.left, last.right) : null;
    if (side && edgeBand.value) edgeBand.value = { ...edgeBand.value, y };
    if (side === edge) return;
    clearEdge();
    if (!side || (view !== 'day' && view !== 'week')) return;
    edge = side;
    const dir = side === 'right' ? 1 : -1;
    const sc = tg.querySelector('[data-scroll-area]')?.getBoundingClientRect() ?? box;
    edgeBand.value = { side, label: edgeLabel(view, useCalendarStore().anchor, dir), left: first!.left, right: last!.right, top: sc.top, bottom: sc.bottom, y };
    edgeTimer = setTimeout(() => void turn(dir), EDGE_HOLD_MS[view]);
  }

  /** Turns the view one day or week while the card stays lifted, then looks again where the pointer rests. */
  async function turn(dir: 1 | -1) {
    edgeTimer = null;
    if (!router || drag.state !== 'dragging') return;
    drag.carry();
    carriedGrid.value = dragGrid;
    const cal = useCalendarStore();
    const view = cal.view;
    await router.push({ path: routePath(view, shiftPeriod(view, cal.anchor, dir)), query: router.currentRoute.value.query });
    await nextTick();
    // the pointer may rest on: look again as if it had just arrived (a new band, a new hold)
    edge = null;
    drag.refresh();
  }

  const slotsMode = () => variant() === 'block';

  function cells(root: Element | null, sel: string): { el: Element; key: CellKey }[] {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(sel)].map((c) => ({ el: c, key: c.dataset.date ?? '' }));
  }

  function hitTest(x: number, y: number, ctx: DragContext): DropTarget<MoveTarget> | null {
    const node = el.value;
    const month = node?.closest('[data-testid="month-view"]');
    if (month) {
      const t = createCellGrid<CellKey>({ cells: () => cells(month, '[data-testid="month-cell"]') })(x, y, ctx);
      return t ? { ...t, key: { date: t.key, minutes: null } } : null;
    }
    // a carried card may be gone from the page: its grid stays
    const tg = (node?.isConnected ? node.closest('.tg') : null) ?? dragGrid;
    if (!tg) return null;
    watchEdge(x, y, tg);
    // task lists may cross between the all-day row and the time grid (gain / lose their time); events keep their kind
    if (!slotsMode() || segment().item.kind === 'tasklist') {
      const t = createCellGrid<CellKey>({ cells: () => cells(tg, '[data-testid="week-allday-cell"],[data-testid="day-allday-area"]') })(x, y, ctx);
      if (t) return { ...t, key: { date: t.key, minutes: null, allDay: true } };
      if (!slotsMode() && segment().item.kind !== 'tasklist') return null;
    }
    const grid = tg.querySelector<HTMLElement>('[data-testid="time-grid"]');
    const cols = [...tg.querySelectorAll<HTMLElement>('[data-testid="week-day-column"],[data-testid="day-column"]')];
    if (!grid || !cols.length) return null;
    const hh = Number(grid.dataset.hourHeight) || 44;
    const gutter = cols[0].getBoundingClientRect().left - grid.getBoundingClientRect().left;
    const t = createSlotGrid({ rect: () => grid.getBoundingClientRect(), columns: cols.length, pxPerMinute: hh / 60, gutter })(x, y, ctx);
    if (!t) return null;
    return { ...t, key: { date: cols[t.key.column].dataset.date!, minutes: t.key.minutes } };
  }

  function onTarget(t: DropTarget<MoveTarget> | null) {
    const seg = segment();
    const timedTarget = !!t && t.key.minutes !== null;
    dragPreview.value = t && timedTarget
      ? { date: t.key.date, minutes: t.key.minutes!, durationMin: Math.max(15, seg.endMin - seg.startMin || 30) }
      : null;
    if (slotsMode() && seg.item.kind !== 'tasklist') return;
    const root = el.value?.closest('[data-testid="month-view"]') ?? (el.value?.isConnected ? el.value.closest('.tg') : null) ?? dragGrid;
    const cell = t && !timedTarget && root ? [...root.querySelectorAll('[data-date]')].find((c) => (c as HTMLElement).dataset.date === t.key.date
      && ['month-cell', 'week-allday-cell', 'day-allday-area'].includes((c as HTMLElement).dataset.testid ?? '')) ?? null : null;
    marked = setDropAttr(marked, cell);
  }

  const drag = useDraggable<MoveTarget>(el, {
    disabled,
    hitTest,
    onTarget,
    scrollEl: () => el.value?.closest<HTMLElement>('[data-scroll-area]') ?? dragGrid?.querySelector<HTMLElement>('[data-scroll-area]') ?? null,
    onStateChange: (s) => {
      if (s === 'dragging') {
        useUiStore().resizing = null;
        dragGrid = el.value?.closest('.tg') ?? null;
        alldayDropGrid.value = !slotsMode() || segment().item.kind === 'tasklist' ? dragGrid : null;
      }
      if (s !== 'dragging') clearEdge();
      if (s === 'idle' || s === 'returning') {
        dragPreview.value = null;
        marked = setDropAttr(marked, null);
        dragGrid = null;
        carriedGrid.value = null;
        alldayDropGrid.value = null;
      }
    },
    onDrop: async (t) => {
      haptic(8);
      dragPreview.value = null;
      marked = setDropAttr(marked, null);
      const seg = segment();
      // released in place on a timed block: show the resize handles instead of doing nothing
      if (slotsMode() && t.key.minutes !== null && !planMove(seg, t.key, useClockStore().timeZone)) {
        useUiStore().resizing = { kind: seg.item.kind, id: seg.item.id, date: seg.date };
        return;
      }
      await applyMove(seg, t.key);
    },
  });
  return drag;
}

/** A card in the phone month: a tap there opens the day, never the card. */
export const monthTapOpensDay = (el: Element | null | undefined): boolean => !!el?.closest('[data-testid="month-view"]') && isPhone.value;

/**
 * Click handler for item cards. In the phone month a tap opens the day (the click bubbles to the cell), elsewhere it opens
 * the item. A click right after a drag is swallowed by the drag controller before it gets here.
 */
export function cardClick(e: MouseEvent, open: () => void): void {
  if (monthTapOpensDay(e.currentTarget as Element | null)) return;
  e.stopPropagation();
  open();
}
