/**
 * Pointer handling of the Canvas (ARCHITECTURE "Canvas"): one finger or the mouse pans the empty background; a plain mouse
 * drag, or a touch long press, picks up a note or an area header and moves it; two fingers pinch-zoom; Ctrl+wheel zooms
 * and the plain wheel pans. It only reports what happened through {@link CanvasPointerHooks}; the component owns the
 * state. The existing drag controller (`motion/drag.ts`) is built for slot grids and ghost cards, so this keeps its
 * conventions (350 ms long press, a haptic tick on pick-up, Escape cancels) in a small module of its own.
 */
import { haptic } from '@/motion/haptics';
import { wheelZoomFactor } from '@/composables/useHourHeight';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { clampZoom, pinchView, zoomAt, type Point, type View } from './canvas';

/** What a pointer can pick up: a note, an area's header (moves it) or an area's resize handle. */
export type DragKind = 'note' | 'area-head' | 'area-resize';

/** Touch long-press delay, the calendar's (`motion/drag.ts`). */
export const LONG_PRESS_MS = 350;
/** A mouse picks up after this much movement (px). */
const MOUSE_SLOP = 4;
/** A touch that moves this far (px) before the long press is a pan. */
const TOUCH_SLOP = 8;
/** Plain-wheel lines are about this many px. */
const LINE_PX = 16;

export interface CanvasPointerHooks {
  /** The current view. */
  getView(): View;
  /** Shows a new view (the component clamps it to the board). */
  setView(v: View): void;
  /** The viewport's position on screen, for converting client coordinates (read once per gesture). */
  viewportOrigin(): Point;
  /** A note or area was picked up; `dx`, `dy` are board units from where the pointer went down. */
  dragStart(kind: DragKind, id: string): void;
  dragMove(kind: DragKind, id: string, dx: number, dy: number): void;
  dragEnd(kind: DragKind, id: string, dx: number, dy: number): void;
  dragCancel(kind: DragKind, id: string): void;
  /** A short press on an area's header (it was not picked up). */
  tap(kind: DragKind, id: string): void;
}

/** Elements inside a note that keep their own pointer behaviour (the title opens the dialog, boxes tick). */
const OWN_POINTER = 'button, input, textarea, select, a, label, [role="checkbox"]';

interface Press { kind: DragKind; id: string; pointerId: number; start: Point; touch: boolean }

/**
 * Binds the gestures to `el` and returns the disposer. Listeners for move and release go on `window` only while a
 * pointer is down, so nothing is bound while the canvas is idle.
 */
export function bindCanvasPointer(el: HTMLElement, h: CanvasPointerHooks): Disposer {
  const pointers = new Map<number, Point>();
  let mode: 'idle' | 'press' | 'drag' | 'pan' | 'pinch' = 'idle';
  let press: Press | null = null;
  let pan: { pointerId: number; start: Point; view: View } | null = null;
  let pinch: { view: View; mid: Point; dist: number } | null = null;
  let origin: Point = { x: 0, y: 0 };
  let stopLong: Disposer | null = null;
  let stopWindow: Disposer[] = [];

  const at = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });
  const rel = (p: Point): Point => ({ x: p.x - origin.x, y: p.y - origin.y });

  function clearLong(): void {
    stopLong?.();
    stopLong = null;
  }
  function unbindWindow(): void {
    for (const s of stopWindow) s();
    stopWindow = [];
  }
  function reset(): void {
    clearLong();
    unbindWindow();
    pointers.clear();
    mode = 'idle';
    press = null;
    pan = null;
    pinch = null;
  }
  function bindWindow(): void {
    if (stopWindow.length) return;
    stopWindow = [
      listen(window, 'pointermove', onMove),
      listen(window, 'pointerup', onUp),
      listen(window, 'pointercancel', onCancel),
      listen(window, 'keydown', onKey),
      listen(window, 'contextmenu', (e) => { if (mode !== 'idle') e.preventDefault(); }),
    ];
  }

  function startPan(pointerId: number, p: Point): void {
    clearLong();
    press = null;
    mode = 'pan';
    pan = { pointerId, start: p, view: h.getView() };
  }
  function pickUp(): void {
    clearLong();
    if (mode !== 'press' || !press) return;
    mode = 'drag';
    haptic(10);
    h.dragStart(press.kind, press.id);
  }
  function startPinch(): void {
    clearLong();
    if (mode === 'drag' && press) h.dragCancel(press.kind, press.id);
    press = null;
    pan = null;
    const [a, b] = [...pointers.values()] as [Point, Point];
    mode = 'pinch';
    pinch = { view: h.getView(), mid: rel(mid(a, b)), dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;
    const drag = target.closest<HTMLElement>('[data-canvas-drag]');
    const kind = (drag?.dataset.canvasDrag ?? null) as DragKind | null;
    // a button, box or field inside a note does its own thing (a second finger still pinches)
    if (pointers.size === 0 && kind === 'note' && target.closest(OWN_POINTER)) return;
    pointers.set(e.pointerId, at(e));
    origin = h.viewportOrigin();
    bindWindow();
    if (pointers.size === 2) return startPinch();
    if (pointers.size > 2 || mode !== 'idle') return;
    const touch = e.pointerType !== 'mouse';
    if (kind && drag?.dataset.canvasId) {
      mode = 'press';
      press = { kind, id: drag.dataset.canvasId, pointerId: e.pointerId, start: at(e), touch };
      // a finger lifts the card after a long press; before that it scrolls the canvas
      if (touch) stopLong = appTimeout(pickUp, LONG_PRESS_MS);
    } else {
      startPan(e.pointerId, at(e));
    }
  }

  function onMove(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, at(e));
    if (mode === 'pinch' && pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      h.setView(pinchView(pinch.view, pinch.mid, pinch.dist, rel(mid(a, b)), Math.hypot(a.x - b.x, a.y - b.y)));
      return;
    }
    if (mode === 'press' && press && e.pointerId === press.pointerId) {
      const moved = Math.hypot(e.clientX - press.start.x, e.clientY - press.start.y);
      if (!press.touch && moved > MOUSE_SLOP) pickUp();
      else if (press.touch && moved > TOUCH_SLOP) startPan(e.pointerId, press.start);
    }
    if (mode === 'drag' && press && e.pointerId === press.pointerId) {
      const z = h.getView().zoom;
      h.dragMove(press.kind, press.id, (e.clientX - press.start.x) / z, (e.clientY - press.start.y) / z);
    } else if (mode === 'pan' && pan && e.pointerId === pan.pointerId) {
      h.setView({ ...pan.view, x: pan.view.x + (e.clientX - pan.start.x), y: pan.view.y + (e.clientY - pan.start.y) });
    }
  }

  function onUp(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    const wasPress = mode === 'press' && press?.pointerId === e.pointerId ? press : null;
    if (mode === 'drag' && press && e.pointerId === press.pointerId) {
      const z = h.getView().zoom;
      h.dragEnd(press.kind, press.id, (e.clientX - press.start.x) / z, (e.clientY - press.start.y) / z);
    }
    pointers.delete(e.pointerId);
    if (mode === 'pinch' && pointers.size === 1) {
      // one finger stays down: it keeps panning from where it is
      const [id, p] = [...pointers.entries()][0]!;
      startPan(id, p);
      return;
    }
    if (pointers.size === 0 || mode !== 'pinch') {
      reset();
      if (wasPress && wasPress.kind === 'area-head') h.tap(wasPress.kind, wasPress.id);
    }
  }

  function onCancel(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    if (mode === 'drag' && press) h.dragCancel(press.kind, press.id);
    reset();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || mode !== 'drag' || !press) return;
    h.dragCancel(press.kind, press.id);
    reset();
  }

  function onWheel(e: WheelEvent): void {
    // never let the browser zoom the page (Ctrl+wheel, trackpad pinch) or scroll behind the canvas
    e.preventDefault();
    const v = h.getView();
    if (e.ctrlKey) {
      const o = h.viewportOrigin();
      h.setView(zoomAt(v, clampZoom(v.zoom * wheelZoomFactor(e.deltaY)), e.clientX - o.x, e.clientY - o.y));
    } else {
      const k = e.deltaMode === 1 ? LINE_PX : 1;
      h.setView({ ...v, x: v.x - e.deltaX * k, y: v.y - e.deltaY * k });
    }
  }

  const stops = [
    listen(el, 'pointerdown', (e) => onDown(e as PointerEvent)),
    listen(el, 'wheel', (e) => onWheel(e as WheelEvent), { passive: false }),
  ];
  return () => {
    reset();
    for (const s of stops) s();
  };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
