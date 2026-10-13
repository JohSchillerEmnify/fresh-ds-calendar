/**
 * Pointer gestures on the clock dial (ARCHITECTURE "Clock view"). On an arc: a tap opens the entry; a long press (touch,
 * pen, a mouse held still) or a mouse press that moves picks it up, and it turns round the dial with the pointer, keeping
 * its length; a long press released in place selects it, which shows a handle at each end; dragging a handle changes the
 * start or the end. Everything snaps to 15 minutes and stays on the day; Esc cancels. Saving is the time grid's optimistic
 * move and resize (`applyMove`, `finishResize`): on failure the entry springs back and a snackbar says why.
 */
import { onScopeDispose, ref, shallowRef } from 'vue';
import type { Segment } from '@/lib/items';
import { openItem } from '@/extensions/registry';
import { applyMove } from '@/features/calendar/dnd';
import { finishResize, resizeEdges, type ResizeEdge } from '@/features/calendar/resize';
import { claimGesture, haptic } from '@/motion';
import { turnedStart } from './clock';
import { minuteAt, wrapDelta } from './geometry';

/** Hold time that picks an arc up (the time grid's long press). */
export const LONG_PRESS_MS = 350;
const TOUCH_SLOP = 8;
const MOUSE_SLOP = 4;

/** Where an arc is drawn while it is dragged (and until its save settles). */
export interface DialPreview { key: string; startMin: number; endMin: number; mode: 'move' | 'resize' }

interface Gesture {
  seg: Segment;
  key: string;
  pointerId: number;
  target: Element;
  x0: number;
  y0: number;
  touch: boolean;
  mode: 'pending' | 'move' | 'resize';
  edge: ResizeEdge;
  lastMin: number;
  delta: number;
  timer: ReturnType<typeof setTimeout> | null;
  release: (() => void) | null;
}

/**
 * Binds the dial's gestures. `svg` is the dial element (pointer positions are read in its viewBox).
 *
 * @returns The live preview, the selected arc's key and the handlers the template binds to arcs and handles.
 */
export function useDialGesture(svg: () => SVGSVGElement | null) {
  const preview = shallowRef<DialPreview | null>(null);
  const selected = ref<string | null>(null);
  let g: Gesture | null = null;

  function minuteOf(e: PointerEvent): number {
    const el = svg();
    const m = el?.getScreenCTM();
    if (!el || !m) return 0;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return minuteAt(p.x, p.y);
  }

  const onTouchMove = (e: TouchEvent) => {
    if (g && g.mode !== 'pending' && e.cancelable) e.preventDefault();
  };
  const onContextMenu = (e: Event) => { if (g) e.preventDefault(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (g) { e.stopPropagation(); cancel(); } else if (selected.value) { e.stopPropagation(); selected.value = null; }
  };

  function listen(on: boolean) {
    const pairs: Array<[string, EventListener]> = [
      ['pointermove', onMove as EventListener], ['pointerup', onUp as EventListener], ['pointercancel', onCancel as EventListener],
      ['contextmenu', onContextMenu], ['touchmove', onTouchMove as EventListener],
    ];
    for (const [type, fn] of pairs) {
      if (on) window.addEventListener(type, fn, { capture: true, passive: type !== 'touchmove' && type !== 'contextmenu' });
      else window.removeEventListener(type, fn, true);
    }
  }

  function end() {
    if (!g) return;
    if (g.timer) clearTimeout(g.timer);
    try { if (g.target.hasPointerCapture?.(g.pointerId)) g.target.releasePointerCapture(g.pointerId); } catch { /* already gone */ }
    g.release?.();
    g = null;
    listen(false);
  }

  function cancel() {
    end();
    preview.value = null;
  }

  function show(gs: Gesture) {
    const { seg } = gs;
    if (gs.mode === 'move') {
      const start = turnedStart(seg.startMin, seg.endMin, gs.delta);
      set({ key: gs.key, startMin: start, endMin: start + (seg.endMin - seg.startMin), mode: 'move' });
    } else {
      const r = resizeEdges(seg, gs.edge, gs.delta);
      set({ key: gs.key, startMin: r.startMin, endMin: r.endMin, mode: 'resize' });
    }
  }

  function set(p: DialPreview) {
    const old = preview.value;
    if (old && old.key === p.key && old.startMin === p.startMin && old.endMin === p.endMin && old.mode === p.mode) return;
    if (old && old.key === p.key) haptic(3); // a light tick per 15-minute step
    preview.value = p;
  }

  function pickUp() {
    if (!g || g.mode !== 'pending') return;
    if (g.timer) clearTimeout(g.timer);
    g.timer = null;
    g.mode = 'move';
    g.release = claimGesture();
    try { g.target.setPointerCapture?.(g.pointerId); } catch { /* pointer already up */ }
    selected.value = null;
    haptic(8);
    show(g);
  }

  function onMove(e: PointerEvent) {
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.mode === 'pending') {
      const dist = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
      if (g.touch && dist > TOUCH_SLOP) cancel(); // a swipe or scroll, not a long press
      else if (!g.touch && dist > MOUSE_SLOP) pickUp();
      if (!g || g.mode === 'pending') return;
    }
    const m = minuteOf(e);
    g.delta += wrapDelta(g.lastMin, m);
    g.lastMin = m;
    show(g);
  }

  function onUp(e: PointerEvent) {
    if (!g || e.pointerId !== g.pointerId) return;
    const gs = g;
    if (gs.mode === 'pending') {
      end();
      openItem(gs.seg.item);
      return;
    }
    const p = preview.value;
    end();
    if (!p || (p.startMin === gs.seg.startMin && p.endMin === gs.seg.endMin)) {
      preview.value = null;
      // a long press released in place: select the arc so its handles show
      if (gs.mode === 'move') selected.value = gs.key;
      return;
    }
    haptic(8);
    const save = gs.mode === 'move'
      ? applyMove(gs.seg, { date: gs.seg.date, minutes: p.startMin })
      : finishResize(gs.seg, gs.edge, gs.delta);
    void save.catch(() => undefined).finally(() => { if (preview.value?.key === gs.key) preview.value = null; });
  }

  function onCancel(e: PointerEvent) {
    if (g && e.pointerId === g.pointerId) cancel();
  }

  function begin(e: PointerEvent, seg: Segment, key: string, mode: Gesture['mode'], edge: ResizeEdge = 'bottom') {
    if (g || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return null;
    e.stopPropagation();
    g = {
      seg, key, pointerId: e.pointerId, target: e.currentTarget as Element, x0: e.clientX, y0: e.clientY,
      touch: e.pointerType !== 'mouse', mode, edge, lastMin: minuteOf(e), delta: 0, timer: null, release: null,
    };
    listen(true);
    return g;
  }

  /** pointerdown on an arc: tap, long press or (mouse) press and move. */
  function arcDown(e: PointerEvent, seg: Segment, key: string) {
    const gs = begin(e, seg, key, 'pending');
    if (gs) gs.timer = setTimeout(pickUp, LONG_PRESS_MS);
  }

  /** pointerdown on a handle of the selected arc: drags that end at once. */
  function handleDown(e: PointerEvent, seg: Segment, key: string, edge: ResizeEdge) {
    const gs = begin(e, seg, key, 'resize', edge);
    if (!gs) return;
    gs.release = claimGesture();
    try { gs.target.setPointerCapture?.(gs.pointerId); } catch { /* pointer already up */ }
    show(gs);
  }

  window.addEventListener('keydown', onKey, true);
  onScopeDispose(() => {
    window.removeEventListener('keydown', onKey, true);
    cancel();
  });

  return { preview, selected, arcDown, handleDown, cancel };
}
