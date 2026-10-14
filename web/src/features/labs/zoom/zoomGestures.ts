/**
 * Gestures of the Labs zoom surfaces (zoom month, horizontal view): one finger or the mouse pans, two fingers pinch, Ctrl
 * (or Cmd) with the wheel (and a trackpad pinch, which browsers send as Ctrl+wheel) zooms at the cursor, the plain wheel
 * pans. The zoom has one value per axis, so a view may zoom its axes independently; a {@link ZoomModel} says which axes the
 * wheel zooms, how far, and how big the world is. While a gesture runs only a CSS transform changes (`live`); the surface is
 * laid out again once, when the gesture ends (`commit`), so nothing re-measures per frame. The controller owns the state
 * (committed zoom, pan, live scale) and reports through {@link ZoomHooks}.
 */
import { isGestureClaimed } from '@/motion';
import { wheelZoomFactor } from '@/composables/useHourHeight';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { clampPanTo, panAfterZoom2, type Pan, type Zoom2, type ZoomModel } from './zoom';

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
  /** Shows the pan (px) and the live scale per axis relative to the committed zoom, without laying out again. */
  live(x: number, y: number, kx: number, ky: number): void;
  /** The gesture is over: lay out at zoom `z` with pan (`x`, `y`) (live scale back to 1). */
  commit(z: Zoom2, x: number, y: number): void;
}

export interface ZoomController {
  /** Binds the gestures to `el`. */
  bind(el: HTMLElement): Disposer;
  /** Zooms to `z` about the viewport point (ax, ay) and commits at once (buttons). */
  zoomTo(z: Zoom2, ax: number, ay: number): void;
  /** Sets zoom and pan from outside (restore, new month) and commits. */
  set(z: Zoom2, x: number, y: number): void;
  state(): { z: Zoom2; x: number; y: number };
}

/** Creates the controller with the starting zoom and pan. */
export function createZoomController(start: { z: Zoom2; x: number; y: number }, h: ZoomHooks, model: ZoomModel): ZoomController {
  let z = start.z, x = start.x, y = start.y, k: Zoom2 = { x: 1, y: 1 };
  const pointers = new Map<number, Pan>();
  let pan: { id: number; from: Pan; at: Pan; moved: boolean } | null = null;
  let pinch: { d0: number; mid0: Pan; z0: Zoom2; pan0: Pan } | null = null;
  let stopWindow: Disposer[] = [];
  let stopSettle: Disposer | null = null;
  let stopClick: Disposer | null = null;

  const origin = (): Pan => h.origin();
  const rel = (p: Pan): Pan => { const o = origin(); return { x: p.x - o.x, y: p.y - o.y }; };
  const scaled = (): Zoom2 => ({ x: z.x * k.x, y: z.y * k.y });
  const limit = (zz: Zoom2, p: Pan): Pan => { const { w, h: vh } = h.size(); return clampPanTo(p, w, vh, model.world(zz, w, vh)); };
  const show = (): void => {
    const c = limit(scaled(), { x, y });
    x = c.x; y = c.y;
    h.live(x, y, k.x, k.y);
  };
  /** Lays the surface out at the zoom the live scale reached. */
  function commit(): void {
    stopSettle?.();
    stopSettle = null;
    const nz = model.clamp(scaled());
    const c = limit(nz, { x, y });
    z = nz; x = c.x; y = c.y; k = { x: 1, y: 1 };
    h.commit(z, x, y);
  }
  /** Sets the live scale so the zoom is `target` (within the range), keeping the point (ax, ay) in place. */
  function scaleLiveTo(target: Zoom2, ax: number, ay: number): void {
    const nz = model.clamp(target);
    const nk = { x: nz.x / z.x, y: nz.y / z.y };
    const p = panAfterZoom2({ x, y }, k, nk, ax, ay);
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
    if (k.x !== 1 || k.y !== 1) commit();
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
      // both axes follow the finger distance ratio
      const r = pinch.d0 > 0 ? Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0 : 1;
      const nz = model.clamp({ x: pinch.z0.x * r, y: pinch.z0.y * r });
      const m = rel(mid(a, b));
      // the world point under the starting midpoint follows the current midpoint
      const p = panAfterZoom2(pinch.pan0, pinch.z0, nz, pinch.mid0.x, pinch.mid0.y);
      k = { x: nz.x / z.x, y: nz.y / z.y };
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
      if (k.x !== 1 || k.y !== 1) commit();
      reset();
      if (moved) swallowClick();
    }
  }
  function onWheel(e: WheelEvent): void {
    // never let the browser zoom the page (Ctrl+wheel, trackpad pinch) or scroll behind the surface
    e.preventDefault();
    const axes = model.wheel(e);
    if (axes) {
      const o = origin();
      const f = wheelZoomFactor(e.deltaY);
      const cur = scaled();
      scaleLiveTo({ x: axes === 'y' ? cur.x : cur.x * f, y: axes === 'x' ? cur.y : cur.y * f }, e.clientX - o.x, e.clientY - o.y);
    } else {
      const f = e.deltaMode === 1 ? LINE_PX : 1;
      // Shift turns a vertical wheel into a sideways pan, as in browsers' own scrolling
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      x -= dx * f;
      y -= dy * f;
      show();
    }
    // a zoom or pan changes what is near and how things lay out: report it as a (cheap) commit when it settles
    stopSettle?.();
    stopSettle = appTimeout(commit, WHEEL_SETTLE_MS);
  }

  return {
    bind(el) {
      const stops = [listen(el, 'pointerdown', (e) => onDown(e as PointerEvent)), listen(el, 'wheel', (e) => onWheel(e as WheelEvent), { passive: false })];
      return () => { reset(); stopSettle?.(); stopClick?.(); for (const s of stops) s(); };
    },
    zoomTo(nz, ax, ay) {
      if (k.x !== 1 || k.y !== 1) commit();
      const target = model.clamp(nz);
      const p = panAfterZoom2({ x, y }, z, target, ax, ay);
      k = { x: target.x / z.x, y: target.y / z.y };
      x = p.x; y = p.y;
      commit();
    },
    set(nz, nx, ny) {
      z = model.clamp(nz); x = nx; y = ny; k = { x: 1, y: 1 };
      const c = limit(z, { x, y });
      x = c.x; y = c.y;
      h.commit(z, x, y);
    },
    state: () => ({ z, x, y }),
  };
}

const mid = (a: Pan, b: Pan): Pan => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
