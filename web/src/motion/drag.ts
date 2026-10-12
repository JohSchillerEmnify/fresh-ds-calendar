/**
 * Pointer-event drag and drop with spring physics (no library).
 *
 *  createDragController(el, opts)  framework-free state machine (testable)
 *  useDraggable(elRef, opts)       Vue wrapper, cleans up on scope dispose / element change
 *  createSlotGrid / createCellGrid hit-test factories (15-minute slots, day cells)
 *  useDropGrid(opts)               wrapper returning { hitTest }
 *
 * State machine:  idle -> pending (touch long-press / mouse slop) -> dragging -> dropping -> idle
 *                 pending --move>slop (touch)--> idle (scroll wins)     dragging --Escape/cancel--> returning -> idle
 *                 dropping: onDrop rejects -> returning (spring back) -> idle
 */
import { getCurrentScope, isRef, onScopeDispose, watch, type Ref } from 'vue';
import { animate } from './animate';
import { getMotionLevel } from './level';
import { haptic } from './haptics';
import { spawnBling } from './effects';
import { Spring1D, createVelocityTracker, clamp, springs } from './spring';

export type DragState = 'idle' | 'pending' | 'dragging' | 'dropping' | 'returning';

export interface DragContext {
  /** Element rect at pick-up. */
  originRect: DOMRect;
  /** Pointer offset inside the element at pick-up. */
  grab: Point;
}
interface Point { x: number; y: number }

/** Result of a hit test. dx/dy (optional) = translation from the origin that lands the card on the snapped cell/slot. */
export interface DropTarget<K = unknown> {
  key: K;
  dx?: number;
  dy?: number;
}

export interface DragOptions<K = unknown> {
  /** Pointer position (client px) -> snapped target, or null when not over a valid target. */
  hitTest: (x: number, y: number, ctx: DragContext) => DropTarget<K> | null;
  /** Called on drop over a valid target. Reject to spring back. */
  onDrop: (target: DropTarget<K>) => void | Promise<unknown>;
  /** Long-press for touch/pen in ms (default 350). */
  touchDelay?: number;
  /** Touch movement that cancels the long-press (default 8 px). */
  touchSlop?: number;
  /** Mouse movement that starts the drag (default 4 px). */
  mouseSlop?: number;
  /** If true (default) the card follows the snapped slot (magnet) when the target has dx/dy. */
  magnet?: boolean;
  /** true (default): onDrop is called immediately and the transform cleared (the consumer applies an optimistic move). */
  optimistic?: boolean;
  disabled?: () => boolean;
  onStateChange?: (s: DragState) => void;
  onTarget?: (t: DropTarget<K> | null) => void;
  /** Scroll container auto-scrolled near its edges while dragging. */
  scrollEl?: () => HTMLElement | null;
}

/** Module-wide flag: a drag owns the gesture. Swipe navigation checks it (and also sees pointer events stopped). */
let claimed = 0;
export function isGestureClaimed(): boolean {
  return claimed > 0;
}
export const GESTURE_CLAIM_EVENT = 'gesture-claim';

const MAX_TILT = 6;

export interface DragController {
  readonly state: DragState;
  destroy(): void;
  /** Cancel an active drag (springs back). */
  cancel(): void;
}

export function createDragController<K>(el: HTMLElement, opts: DragOptions<K>): DragController {
  const touchDelay = opts.touchDelay ?? 350;
  const touchSlop = opts.touchSlop ?? 8;
  const mouseSlop = opts.mouseSlop ?? 4;
  const magnet = opts.magnet ?? true;
  const optimistic = opts.optimistic ?? true;

  let state: DragState = 'idle';
  let pointerId = -1;
  let isTouch = false;
  let start: Point = { x: 0, y: 0 };
  let cur: Point = { x: 0, y: 0 };
  let ctx: DragContext | null = null;
  let target: DropTarget<K> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;
  let lastT = 0;
  let anims: Animation[] = [];
  let claimedHere = false;
  let listening = false;
  let prevStyle = { transform: '', transition: '', zIndex: '', boxShadow: '', touchAction: '', userSelect: '', willChange: '', position: '' };
  const sx = new Spring1D(springs.follow);
  const sy = new Spring1D(springs.follow);
  const tilt = new Spring1D({ stiffness: 300, damping: 0.7 });
  const vt = createVelocityTracker(90);

  const setState = (s: DragState) => {
    if (state === s) return;
    state = s;
    if (s === 'idle') delete el.dataset.dragging;
    opts.onStateChange?.(s);
  };

  const setTarget = (t: DropTarget<K> | null) => {
    const same = t === target || (t && target && t.key === target.key && t.dx === target.dx && t.dy === target.dy);
    target = t;
    if (!same) opts.onTarget?.(t);
  };

  function claim() {
    if (!claimedHere) {
      claimedHere = true;
      claimed++;
    }
  }
  function release() {
    if (claimedHere) {
      claimedHere = false;
      claimed--;
    }
  }

  // ---- window listeners, only while a pointer is down ----
  const onWinMove = (e: PointerEvent) => handleMove(e);
  const onWinUp = (e: PointerEvent) => handleUp(e);
  const onWinCancel = (e: PointerEvent) => handleCancelEvent(e);
  const onTouchMove = (e: TouchEvent) => {
    if (state === 'dragging' && e.cancelable) e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (state === 'dragging' || state === 'pending')) cancel();
  };
  const onCtx = (e: Event) => {
    if (state !== 'idle') e.preventDefault();
  };
  const onClickCapture = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('pointermove', onWinMove, true);
    window.addEventListener('pointerup', onWinUp, true);
    window.addEventListener('pointercancel', onWinCancel, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('contextmenu', onCtx, true);
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  }
  function unlisten() {
    if (!listening) return;
    listening = false;
    window.removeEventListener('pointermove', onWinMove, true);
    window.removeEventListener('pointerup', onWinUp, true);
    window.removeEventListener('pointercancel', onWinCancel, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('contextmenu', onCtx, true);
    window.removeEventListener('touchmove', onTouchMove, true);
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function stopRaf() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function cancelAnims() {
    anims.forEach((a) => {
      try { a.cancel(); } catch { /* ignore */ }
    });
    anims = [];
  }
  function releaseCapture() {
    try {
      if (pointerId >= 0 && el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
    } catch { /* ignore */ }
  }
  function restoreStyle() {
    el.style.transform = prevStyle.transform;
    el.style.transition = prevStyle.transition;
    el.style.zIndex = prevStyle.zIndex;
    el.style.boxShadow = prevStyle.boxShadow;
    el.style.userSelect = prevStyle.userSelect;
    el.style.willChange = prevStyle.willChange;
    el.style.position = prevStyle.position;
  }

  function reset() {
    clearTimer();
    stopRaf();
    unlisten();
    releaseCapture();
    release();
    pointerId = -1;
    ctx = null;
    setTarget(null);
  }

  // ---- pointer down ----
  function onDown(e: PointerEvent) {
    if (state !== 'idle' || opts.disabled?.() || (e.pointerType === 'mouse' && e.button !== 0) || !e.isPrimary) return;
    const rect = el.getBoundingClientRect();
    isTouch = e.pointerType !== 'mouse';
    pointerId = e.pointerId;
    start = { x: e.clientX, y: e.clientY };
    cur = { ...start };
    ctx = { originRect: rect, grab: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    vt.reset();
    vt.add(e.clientX, e.clientY, e.timeStamp || performance.now());
    listen();
    setState('pending');
    if (isTouch) timer = setTimeout(pickUp, touchDelay);
  }

  function pickUp() {
    timer = null;
    if (state !== 'pending' || !ctx) return;
    claim();
    window.dispatchEvent(new CustomEvent(GESTURE_CLAIM_EVENT));
    try { el.setPointerCapture?.(pointerId); } catch { /* ignore */ }
    prevStyle = {
      transform: el.style.transform, transition: el.style.transition, zIndex: el.style.zIndex, boxShadow: el.style.boxShadow,
      touchAction: el.style.touchAction, userSelect: el.style.userSelect, willChange: el.style.willChange, position: el.style.position,
    };
    el.dataset.dragging = 'true';
    el.style.transition = 'none';
    el.style.zIndex = '60';
    el.style.userSelect = 'none';
    el.style.willChange = 'transform';
    sx.snap(0); sy.snap(0); tilt.snap(0);
    haptic(10);
    setState('dragging');
    if (getMotionLevel() === 'full') {
      // small wiggle on the independent `rotate` property so it composes with the follow transform
      const a = el.animate?.(
        [{ rotate: '0deg' }, { rotate: '-2.2deg' }, { rotate: '1.8deg' }, { rotate: '-1deg' }, { rotate: '0deg' }],
        { duration: 340, easing: 'ease-in-out' },
      );
      if (a) anims.push(a);
    }
    update(cur.x, cur.y);
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function update(x: number, y: number) {
    if (!ctx) return;
    setTarget(opts.hitTest(x, y, ctx));
  }

  function handleMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    cur = { x: e.clientX, y: e.clientY };
    const dist = Math.hypot(cur.x - start.x, cur.y - start.y);
    if (state === 'pending') {
      if (isTouch) {
        if (dist > touchSlop) {
          clearTimer();
          reset();
          setState('idle');
        }
      } else if (dist > mouseSlop) {
        pickUp();
      }
      return;
    }
    if (state === 'dragging') {
      e.stopPropagation(); // claim: swipe navigation underneath never sees this move
      if (e.cancelable) e.preventDefault();
      vt.add(cur.x, cur.y, e.timeStamp || performance.now());
      update(cur.x, cur.y);
    }
  }

  function handleUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (state === 'pending') {
      clearTimer();
      reset();
      setState('idle');
      return;
    }
    if (state !== 'dragging') return;
    e.stopPropagation();
    cur = { x: e.clientX, y: e.clientY };
    update(cur.x, cur.y);
    drop();
  }

  function handleCancelEvent(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (state === 'pending') {
      clearTimer();
      reset();
      setState('idle');
    } else if (state === 'dragging') cancel();
  }

  function offsets(): { x: number; y: number } {
    if (magnet && target && target.dx !== undefined && target.dy !== undefined) return { x: target.dx, y: target.dy };
    return { x: cur.x - start.x, y: cur.y - start.y };
  }

  function paint() {
    const { vx } = vt.velocity();
    tilt.target = clamp(vx / 160, -MAX_TILT, MAX_TILT);
    el.style.transform = `translate3d(${sx.x.toFixed(2)}px, ${sy.x.toFixed(2)}px, 0) rotate(${tilt.x.toFixed(2)}deg) scale(1.05)`;
    el.style.boxShadow = '0 14px 30px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.18)';
  }

  function autoScroll(dt: number) {
    const sc = opts.scrollEl?.();
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    const edge = 56;
    let v = 0;
    if (cur.y < r.top + edge) v = -(1 - clamp((cur.y - r.top) / edge, 0, 1));
    else if (cur.y > r.bottom - edge) v = 1 - clamp((r.bottom - cur.y) / edge, 0, 1);
    if (v) {
      const before = sc.scrollTop;
      sc.scrollTop += v * 600 * dt;
      if (sc.scrollTop !== before) update(cur.x, cur.y);
    }
  }

  function frame(t: number) {
    raf = 0;
    if (state !== 'dragging') return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    const o = offsets();
    const lvl = getMotionLevel();
    if (lvl === 'full') {
      sx.target = o.x;
      sy.target = o.y;
      sx.step(dt); sy.step(dt); tilt.step(dt);
    } else {
      sx.snap(o.x); sy.snap(o.y); tilt.snap(0);
    }
    paint();
    autoScroll(dt);
    raf = requestAnimationFrame(frame);
  }

  function currentOffset() {
    return { x: sx.x, y: sy.x };
  }

  function finishVisual() {
    cancelAnims();
    restoreStyle();
    reset();
    setState('idle');
  }

  function springBack(from: Point, scaleFrom = 1.05) {
    setState('returning');
    stopRaf();
    const a = animate(
      el,
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${scaleFrom})` },
        { transform: 'translate3d(0,0,0) scale(1)' },
      ],
      { spring: springs.wobble, reduced: 'same', duration: 220 },
    );
    el.style.transform = '';
    el.style.boxShadow = prevStyle.boxShadow;
    if (!a) return finishVisual();
    anims.push(a);
    a.finished.then(finishVisual, finishVisual);
  }

  function cancel() {
    if (state === 'pending') {
      clearTimer();
      reset();
      setState('idle');
      return;
    }
    if (state !== 'dragging') return;
    const from = currentOffset();
    setTarget(null);
    el.dataset.dragging = 'false';
    springBack(from);
  }

  function suppressNextClick() {
    el.addEventListener('click', onClickCapture, { capture: true, once: true });
    setTimeout(() => el.removeEventListener('click', onClickCapture, true), 400);
  }

  async function drop() {
    const t = target;
    stopRaf();
    suppressNextClick();
    const from = currentOffset();
    if (!t) {
      el.dataset.dragging = 'false';
      springBack(from);
      return;
    }
    setState('dropping');
    el.dataset.dragging = 'false';
    const dest = t.dx !== undefined && t.dy !== undefined ? { x: t.dx, y: t.dy } : { x: cur.x - start.x, y: cur.y - start.y };
    const blingAt = ctx
      ? { x: ctx.originRect.left + ctx.originRect.width / 2 + dest.x, y: ctx.originRect.top + ctx.originRect.height / 2 + dest.y }
      : cur;
    let p: void | Promise<unknown>;
    try {
      p = opts.onDrop(t);
    } catch (err) {
      p = Promise.reject(err);
    }
    if (optimistic) {
      // The consumer has applied (or is applying) the optimistic move: clear our transform, wobble at the new place.
      el.style.transform = '';
      el.style.boxShadow = prevStyle.boxShadow;
      cancelAnims();
      const w = animate(
        el,
        [
          { transform: 'scale(1.05) rotate(2deg)' },
          { transform: 'scale(1) rotate(0deg)' },
        ],
        { spring: springs.wobble, reduced: 'same', duration: 200 },
      );
      if (w) anims.push(w);
      spawnBling(blingAt);
      try {
        await p;
      } catch {
        // spring back from the new place to the origin after the consumer rolled back
        await Promise.resolve();
        if (!el.isConnected) return finishVisual();
        cancelAnims();
        springBack(dest, 1);
        return;
      }
      if (w) await w.finished.then(() => undefined, () => undefined);
      finishVisual();
      return;
    }
    // non-optimistic: settle to the snapped slot, wait for the server, then clear
    sx.snap(dest.x); sy.snap(dest.y);
    const settle = animate(
      el,
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1.05)` },
        { transform: `translate3d(${dest.x}px, ${dest.y}px, 0) scale(1)` },
      ],
      { spring: springs.wobble, reduced: 'same', duration: 200 },
    );
    el.style.transform = `translate3d(${dest.x}px, ${dest.y}px, 0)`;
    if (settle) anims.push(settle);
    try {
      await p;
      spawnBling(blingAt);
      finishVisual();
    } catch {
      cancelAnims();
      springBack(dest, 1);
    }
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('dragstart', preventNative);
  function preventNative(e: Event) {
    e.preventDefault();
  }

  return {
    get state() {
      return state;
    },
    cancel,
    destroy() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('dragstart', preventNative);
      el.removeEventListener('click', onClickCapture, true);
      cancelAnims();
      if (state !== 'idle') restoreStyle();
      reset();
      state = 'idle';
      delete el.dataset.dragging;
    },
  };
}

/** Vue wrapper. `elRef` may be a template ref; re-binds when the element changes. */
export function useDraggable<K>(elRef: Ref<HTMLElement | null | undefined> | (() => HTMLElement | null | undefined), opts: DragOptions<K>) {
  let ctl: DragController | null = null;
  const wrapped = opts;
  const get = () => (isRef(elRef) ? elRef.value : elRef());
  const stop = watch(
    get,
    (el) => {
      ctl?.destroy();
      ctl = el instanceof HTMLElement ? createDragController(el, wrapped) : null;
    },
    { immediate: true, flush: 'post' },
  );
  const dispose = () => {
    stop();
    ctl?.destroy();
    ctl = null;
  };
  if (getCurrentScope()) onScopeDispose(dispose);
  return {
    get state() { return ctl?.state ?? 'idle'; },
    cancel: () => ctl?.cancel(),
    dispose,
  };
}

// ---------------------------------------------------------------- hit-test factories

const snap = (v: number, step: number) => Math.round(v / step) * step;

export interface SlotGridOptions {
  /** Bounding rect of the whole grid (all day columns, from 00:00 at the top). Read live (scroll!). */
  rect: () => DOMRect | null;
  /** Number of day columns (1 for the day view, 7 for the week). */
  columns: number;
  /** Pixels per minute (hour height / 60). */
  pxPerMinute: number;
  /** Width of a leading gutter (time labels) inside rect. */
  gutter?: number;
  /** Snap step in minutes (default 15). */
  step?: number;
}
export interface SlotKey { column: number; minutes: number }

/** Hit-test for time grids. The card's top edge snaps to the slot; dx/dy move it there. */
export function createSlotGrid(o: SlotGridOptions): (x: number, y: number, ctx: DragContext) => DropTarget<SlotKey> | null {
  const step = o.step ?? 15;
  const gutter = o.gutter ?? 0;
  return (x, y, ctx) => {
    const r = o.rect();
    if (!r) return null;
    const colW = (r.width - gutter) / o.columns;
    const column = clamp(Math.floor((x - r.left - gutter) / colW), 0, o.columns - 1);
    const maxMin = r.height / o.pxPerMinute - step;
    const topY = y - ctx.grab.y - r.top;
    const minutes = clamp(snap(topY / o.pxPerMinute, step), 0, Math.max(0, Math.round(maxMin / step) * step));
    const colLeft = r.left + gutter + column * colW;
    return {
      key: { column, minutes },
      dx: colLeft - ctx.originRect.left,
      dy: r.top + minutes * o.pxPerMinute - ctx.originRect.top,
    };
  };
}

export interface CellGridOptions<K> {
  /** Current cells: rect + key. Called per move; keep it cheap (e.g. NodeList mapping). */
  cells: () => { el: Element; key: K }[];
}

/** Hit-test for day cells (month view, all-day row): the cell under the pointer. */
export function createCellGrid<K>(o: CellGridOptions<K>): (x: number, y: number, ctx: DragContext) => DropTarget<K> | null {
  return (x, y, ctx) => {
    for (const c of o.cells()) {
      const r = c.el.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        return { key: c.key, dx: r.left - ctx.originRect.left + (r.width - ctx.originRect.width) / 2, dy: r.top - ctx.originRect.top + 2 };
      }
    }
    return null;
  };
}

export type DropGridOptions<K> =
  | ({ kind: 'slots' } & SlotGridOptions)
  | ({ kind: 'cells' } & CellGridOptions<K>);

/** Convenience wrapper: `const { hitTest } = useDropGrid({ kind: 'slots', ... })`. */
export function useDropGrid<K = SlotKey>(o: DropGridOptions<K>) {
  const hitTest = (o.kind === 'slots' ? createSlotGrid(o) : createCellGrid<K>(o)) as DragOptions<K>['hitTest'];
  return { hitTest };
}
