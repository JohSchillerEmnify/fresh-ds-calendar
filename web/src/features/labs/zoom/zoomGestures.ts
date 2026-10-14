/**
 * Gestures of the Labs zoom month: one finger or the mouse pans, two fingers pinch, Ctrl+wheel (and a trackpad pinch,
 * which browsers send as Ctrl+wheel) zooms at the cursor, the plain wheel pans. While a gesture runs only a CSS transform
 * changes (`live`); the grid is laid out again once, when the gesture ends (`commit`), so nothing re-measures per frame.
 * The controller owns the state (committed zoom, pan, live scale) and reports through {@link ZoomHooks}.
 */
import { isGestureClaimed } from '@/motion';
import { wheelZoomFactor } from '@/composables/useHourHeight';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { clampPan, clampZoom, panAfterZoom, pinchZoom, type Pan } from './zoom';

/** A press that moves this far (px) is a pan, not a tap. */
const SLOP = 6;
/** The wheel zoom commits (re-layout) this long after the last event. */
const WHEEL_SETTLE_MS = 140;
/** Plain-wheel lines are about this many px. */
const LINE_PX = 16;

export interface ZoomHooks {
  /** Viewport size in px. */
  size(): { w: number; h: number };
  /** The viewport's top-left corner on screen. */
  origin(): Pan;
  /** Shows the pan (px) and the live scale relative to the committed zoom, without laying out again. */
  live(x: number, y: number, k: number): void;
  /** The gesture is over: lay out at zoom `z` with pan (`x`, `y`) (live scale back to 1). */
  commit(z: number, x: number, y: number): void;
}

export interface ZoomController {
  /** Binds the gestures to `el`. */
  bind(el: HTMLElement): Disposer;
  /** Zooms to `z` about the viewport point (ax, ay) and commits at once (buttons). */
  zoomTo(z: number, ax: number, ay: number): void;
  /** Sets zoom and pan from outside (restore, new month) and commits. */
  set(z: number, x: number, y: number): void;
  state(): { z: number; x: number; y: number };
}

/** Creates the controller with the starting zoom and pan. */
export function createZoomController(start: { z: number; x: number; y: number }, h: ZoomHooks): ZoomController {
  let z = start.z, x = start.x, y = start.y, k = 1;
  const pointers = new Map<number, Pan>();
  let pan: { id: number; from: Pan; at: Pan; moved: boolean } | null = null;
  let pinch: { d0: number; mid0: Pan; z0: number; pan0: Pan } | null = null;
  let stopWindow: Disposer[] = [];
  let stopSettle: Disposer | null = null;
  let stopClick: Disposer | null = null;

  const origin = (): Pan => h.origin();
  const rel = (p: Pan): Pan => { const o = origin(); return { x: p.x - o.x, y: p.y - o.y }; };
  const show = (): void => {
    const { w, h: vh } = h.size();
    const c = clampPan({ x, y }, w, vh, z * k);
    x = c.x; y = c.y;
    h.live(x, y, k);
  };
  /** Lays the grid out at the zoom the live scale reached. */
  function commit(): void {
    stopSettle?.();
    stopSettle = null;
    const { w, h: vh } = h.size();
    const nz = clampZoom(z * k);
    const c = clampPan({ x, y }, w, vh, nz);
    z = nz; x = c.x; y = c.y; k = 1;
    h.commit(z, x, y);
  }
  /** Multiplies the live scale by `f` about (ax, ay), within the zoom range. */
  function scaleLive(f: number, ax: number, ay: number): void {
    const nz = clampZoom(z * k * f);
    const nk = nz / z;
    const p = panAfterZoom({ x, y }, k, nk, ax, ay);
    x = p.x; y = p.y; k = nk;
    show();
  }

  function swallowClick(): void {
    stopClick?.();
    const off = listen(window, 'click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
    stopClick = appTimeout(off, 400);
  }
  function unbindWindow(): void { for (const s of stopWindow) s(); stopWindow = []; }
  function reset(): void { unbindWindow(); pointers.clear(); pan = null; pinch = null; }
  function startPan(id: number, p: Pan): void {
    pan = { id, from: p, at: { x, y }, moved: false };
    pinch = null;
  }

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;
    // a mouse drag on an entry belongs to the calendar's own drag and drop
    if (pointers.size === 0 && e.pointerType === 'mouse' && target.closest('[data-zoom-nopan]')) return;
    if (k !== 1) commit();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!stopWindow.length) {
      stopWindow = [listen(window, 'pointermove', onMove), listen(window, 'pointerup', onUp), listen(window, 'pointercancel', onUp)];
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Pan, Pan];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: rel(mid(a, b)), z0: z, pan0: { x, y } };
      if (pan) pan.moved = true;
      pan = null;
    } else if (pointers.size === 1) {
      startPan(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }
  function onMove(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Pan, Pan];
      const nz = pinchZoom(pinch.z0, pinch.d0, Math.hypot(a.x - b.x, a.y - b.y));
      const m = rel(mid(a, b));
      // the world point under the starting midpoint follows the current midpoint
      const p = panAfterZoom(pinch.pan0, pinch.z0, nz, pinch.mid0.x, pinch.mid0.y);
      k = nz / z;
      x = p.x + (m.x - pinch.mid0.x);
      y = p.y + (m.y - pinch.mid0.y);
      show();
      return;
    }
    if (pan && e.pointerId === pan.id) {
      if (isGestureClaimed()) return;
      const dx = e.clientX - pan.from.x, dy = e.clientY - pan.from.y;
      if (!pan.moved && Math.hypot(dx, dy) < SLOP) return;
      pan.moved = true;
      x = pan.at.x + dx;
      y = pan.at.y + dy;
      show();
    }
  }
  function onUp(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    const moved = pan?.moved ?? pinch !== null;
    pointers.delete(e.pointerId);
    if (pinch && pointers.size === 1) {
      // one finger stays down: it keeps panning from where it is, at the new zoom
      commit();
      const [id, p] = [...pointers.entries()][0]!;
      startPan(id, p);
      if (pan) pan.moved = true;
      return;
    }
    if (pointers.size === 0) {
      if (k !== 1) commit();
      reset();
      if (moved) swallowClick();
    }
  }
  function onWheel(e: WheelEvent): void {
    // never let the browser zoom the page (Ctrl+wheel, trackpad pinch) or scroll behind the grid
    e.preventDefault();
    if (e.ctrlKey) {
      const o = origin();
      scaleLive(wheelZoomFactor(e.deltaY), e.clientX - o.x, e.clientY - o.y);
      stopSettle?.();
      stopSettle = appTimeout(commit, WHEEL_SETTLE_MS);
    } else {
      const f = e.deltaMode === 1 ? LINE_PX : 1;
      x -= e.deltaX * f;
      y -= e.deltaY * f;
      show();
      // a pan changes which cells are near: report it as a (cheap) commit when it settles
      stopSettle?.();
      stopSettle = appTimeout(commit, WHEEL_SETTLE_MS);
    }
  }

  return {
    bind(el) {
      const stops = [listen(el, 'pointerdown', (e) => onDown(e as PointerEvent)), listen(el, 'wheel', (e) => onWheel(e as WheelEvent), { passive: false })];
      return () => { reset(); stopSettle?.(); stopClick?.(); for (const s of stops) s(); };
    },
    zoomTo(nz, ax, ay) {
      if (k !== 1) commit();
      const target = clampZoom(nz);
      const p = panAfterZoom({ x, y }, z, target, ax, ay);
      k = target / z;
      x = p.x; y = p.y;
      commit();
    },
    set(nz, nx, ny) {
      z = clampZoom(nz); x = nx; y = ny; k = 1;
      const { w, h: vh } = h.size();
      const c = clampPan({ x, y }, w, vh, z);
      x = c.x; y = c.y;
      h.commit(z, x, y);
    },
    state: () => ({ z, x, y }),
  };
}

const mid = (a: Pan, b: Pan): Pan => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
