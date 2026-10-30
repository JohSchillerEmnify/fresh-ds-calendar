/**
 * Resize handles for timed entries in the week and day time grid: pure planning (`resizeEdges`, `planResize`), the live
 * preview the grid draws while a handle is dragged (`resizePreview`) and the optimistic save (`commitResize`).
 *
 * A dragged edge "covers" the pointer: the end rounds up and the start rounds down to the 15-minute grid (with 2 minutes of
 * leniency, so a drag that lands a pixel or two past a slot line does not jump a whole slot). Keeps at least 15 minutes
 * between start and end; a task list stops at 720 minutes (the server's `estimateMinutes` range), events at the day's end.
 */
import { ESTIMATE_MAX } from '@calendar/shared/limits';
import { shallowRef } from 'vue';
import type { CalendarEvent, CalendarItem, UpdateEventInput, UpdateTaskListInput } from '@/api/types';
import type { Segment } from '@/lib/items';
import { minutesToTime } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import type { ResizingEntry } from '@/stores/ui';
import { fromWallMinutes, localToIso, wallMinutes } from './zone';

export type ResizeEdge = 'top' | 'bottom';

export const RESIZE_STEP = 15;
export const RESIZE_MIN = 15;
export const TASKLIST_MAX_MINUTES = ESTIMATE_MAX;
/** Minutes a drag may fall short of a slot line and still snap to it. */
const LENIENCY = 2;

/** Block geometry the grid draws instead of the stored one while a handle is dragged (or springing back). */
export const resizePreview = shallowRef<{ id: string; date: string; startMin: number; endMin: number; settle?: boolean } | null>(null);

/**
 * Whether a renderer draws its resize handles: the entry was released without moving (`ui.resizing`), and only on its
 * time grid block of that day. The one rule for events and task lists alike.
 */
export function showsHandles(r: ResizingEntry | null, seg: Segment, variant: string): boolean {
  return variant === 'block' && !!r && r.kind === seg.item.kind && r.id === seg.item.id && r.date === seg.date;
}

export interface ResizePlan {
  startMin: number;
  endMin: number;
  next: CalendarItem;
  patch: UpdateEventInput | UpdateTaskListInput;
}

/** Pure: the segment's new start and end minute of day when `edge` is dragged by `deltaMin` minutes. */
export function resizeEdges(seg: Segment, edge: ResizeEdge, deltaMin: number): { startMin: number; endMin: number } {
  const { startMin, endMin } = seg;
  const list = seg.item.kind === 'tasklist';
  if (edge === 'top') {
    const snapped = Math.floor((startMin + deltaMin + LENIENCY) / RESIZE_STEP) * RESIZE_STEP;
    const lo = list ? Math.max(0, endMin - TASKLIST_MAX_MINUTES) : 0;
    return { startMin: Math.min(Math.max(snapped, lo), endMin - RESIZE_MIN), endMin };
  }
  const snapped = Math.ceil((endMin + deltaMin - LENIENCY) / RESIZE_STEP) * RESIZE_STEP;
  const hi = list ? Math.min(1440, startMin + TASKLIST_MAX_MINUTES) : 1440;
  return { startMin, endMin: Math.max(Math.min(snapped, hi), startMin + RESIZE_MIN) };
}

/** Pure: what dragging `edge` of `seg` by `deltaMin` changes. Null when the edge lands where it was. */
export function planResize(seg: Segment, edge: ResizeEdge, deltaMin: number, tz: string): ResizePlan | null {
  const { startMin, endMin } = resizeEdges(seg, edge, deltaMin);
  if (startMin === seg.startMin && endMin === seg.endMin) return null;
  const item = seg.item;
  if (item.kind === 'tasklist') {
    const estimateMinutes = endMin - startMin;
    const patch: UpdateTaskListInput = edge === 'top' ? { time: minutesToTime(startMin), estimateMinutes } : { estimateMinutes };
    return { startMin, endMin, next: { ...item, time: minutesToTime(startMin), estimateMinutes }, patch };
  }
  const ev: CalendarEvent = item;
  // wall-clock arithmetic from the segment's midnight: 24:00 rolls over to the next day's 00:00
  const base = wallMinutes(seg.date, '00:00');
  const iso = (min: number) => {
    const w = fromWallMinutes(base + min);
    return localToIso(w.date, w.time, tz);
  };
  const start = edge === 'top' ? iso(startMin) : ev.start;
  const end = edge === 'bottom' ? iso(endMin) : ev.end;
  return { startMin, endMin, next: { ...ev, start, end }, patch: { start, end } };
}

/**
 * Queues a finished handle drag in the outbox, like `applyMove`: the block keeps the dragged size.
 */
export async function commitResize(seg: Segment, plan: ResizePlan): Promise<void> {
  const items = useItemsStore();
  const { item } = seg;
  const etag = items.get(item.id)?.etag ?? item.etag;
  useOutboxStore().changeItem(item, plan.next, plan.patch, etag);
  resizePreview.value = null;
}

/** Plans and saves a finished drag; the caller keeps `resizePreview` at the dragged geometry until this settles. */
export function finishResize(seg: Segment, edge: ResizeEdge, deltaMin: number): Promise<void> {
  const plan = planResize(seg, edge, deltaMin, useClockStore().timeZone);
  if (!plan) {
    resizePreview.value = null;
    return Promise.resolve();
  }
  return commitResize(seg, plan);
}
