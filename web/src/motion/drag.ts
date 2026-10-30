/**
 * Pointer-event drag and drop with spring physics (no library).
 *
 *  createDragController(el, opts)  framework-free state machine (testable)
 *  useDraggable(elRef, opts)       Vue wrapper, cleans up on scope dispose / element change
 *  createSlotGrid / createCellGrid hit-test factories (15-minute slots, day cells)
 *  useDropGrid(opts)               wrapper returning { hitTest }
 *  watchDrags(fn)                  read-only per-frame drag state for passive followers (drag helper cat)
 *
 * State machine:  idle -> pending (touch long-press / mouse slop) -> dragging -> dropping -> idle
 *                 pending --move>slop (touch)--> idle (scroll wins)     dragging --Escape/cancel--> returning -> idle
 *                 dragging (touch): the touch events steer too, and carry it alone after a pointercancel or when the pointer
 *                 events stop (touchend drops, touchcancel cancels)
 *                 dropping: onDrop rejects -> returning (spring back) -> idle
 *                 dragging --carry()--> dragging on a ghost copy: the card itself may leave the page (the view turns)
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
  /** Long-press (touch, pen, and a mouse held still) in ms (default 350). */
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
  /** Scale of the element's ancestors (a zoomed Canvas): a translate of 1 px moves it by this many screen px. Read at pick-up; default 1. */
  scale?: () => number;
  onStateChange?: (s: DragState) => void;
  onTarget?: (t: DropTarget<K> | null) => void;
  /**
   * Scroll container auto-scrolled near its edges while dragging. Any scroll of it (auto-scroll or wheel) re-runs the hit
   * test, and when it contains the card the card's transform compensates, so the card stays under the pointer.
   */
  scrollEl?: () => HTMLElement | null;
}

/** Module-wide flag: a drag owns the gesture. Swipe navigation checks it (and also sees pointer events stopped). */
let claimed = 0;
export function isGestureClaimed(): boolean {
  return claimed > 0;
}
export const GESTURE_CLAIM_EVENT = 'gesture-claim';

/** Claims the gesture for a drag that does not use the controller (the clock dial) until the returned release runs. */
export function claimGesture(): () => void {
  claimed++;
  window.dispatchEvent(new CustomEvent(GESTURE_CLAIM_EVENT));
  let done = false;
  return () => {
    if (!done) { done = true; claimed--; }
  };
}

// ---------------------------------------------------------------- read-only drag watch (drag helper cat)

/** One frame of the active drag as drawn, for passive followers (the drag helper cat). */
export interface DragFrame {
  /** `start` on pick-up, `move` on every drag frame, `end` once on drop or cancel. */
  phase: 'start' | 'move' | 'end';
  /** Viewport rect of the lifted card as drawn now (pick-up rect plus the follow offset; scale and tilt ignored). */
  rect: { left: number; top: number; width: number; height: number };
  /** Displacement of the drawn card from where it was picked up (px, viewport). */
  dx: number;
  dy: number;
  /** Pointer velocity (px/s) over the last moves; it keeps its last value while the pointer rests. */
  vx: number;
  vy: number;
  /** How long the pointer has rested (moved ≤ 3 px), in ms of frame time. */
  stillMs: number;
}
export type DragWatcher = (f: DragFrame) => void;
const watchers = new Set<DragWatcher>();
/** Pointer movement (px) that still counts as resting for `stillMs`. */
const STILL_SLOP = 3;

/**
 * Follow every drag passively: called synchronously from the drag's own rAF loop (no second loop, no pointer events).
 * Returns the unsubscribe function. Watchers must be cheap and must never throw into the drag.
 */
export function watchDrags(fn: DragWatcher): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}
function emitDrag(f: DragFrame) {
  for (const w of watchers) {
    try { w(f); } catch { /* a follower never breaks the drag */ }
  }
}

const MAX_TILT = 6;
/** How long the pointer must rest in an edge zone before the scroll container starts to auto-scroll. */
const EDGE_DWELL_MS = 400;

export interface DragController {
  readonly state: DragState;
  destroy(): void;
  /** Cancel an active drag (springs back). */
  cancel(): void;
  /**
   * Lets the card leave the page while it is lifted (the calendar turns to another day or week under the drag): a fixed
   * copy of the card (`data-drag-ghost`) takes over the drawing, the card is hidden, its own touch listeners keep carrying
   * a touch drag even once it is removed (iOS sends a touch's events to where it started), and a destroy waits for the drop.
   */
  carry(): void;
  /** Re-runs the hit test at the pointer (the grid under a still pointer changed). */
  refresh(): void;
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
  let edgeSince = 0;
  /** Scroll container of this drag and its scroll position at pick-up (the card's layout box moves with it). */
  let sc: HTMLElement | null = null;
  let scroll0: Point = { x: 0, y: 0 };
  let lastShift: Point = { x: 0, y: 0 };
  let anims: Animation[] = [];
  /** Ancestor scale at pick-up: viewport offsets are divided by it to get the element's own translate. */
  let k = 1;
  let claimedHere = false;
  let listening = false;
  /** The finger of this press, from the card's touchstart; null when the press sent no touch events (mouse, a pen on Windows). */
  let touchId: number | null = null;
  /** Timer that disarms the click swallow after a drop. */
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Scroll container whose native scrolling is off while a touch drag is lifted, and its inline overflow-y before. */
  let locked: HTMLElement | null = null;
  let lockedOverflow = '';
  let prevStyle = { transform: '', transition: '', zIndex: '', boxShadow: '', touchAction: '', userSelect: '', willChange: '', position: '' };
  /** The fixed copy that draws a carried drag (see `carry`), the card's visibility before, and a destroy waiting for the drop. */
  let ghost: HTMLElement | null = null;
  let prevVisibility = '';
  let destroyLater = false;
  /** Touch events the window listeners already handled (the card's own listeners skip them; they serve a removed card). */
  const seenTouch = new WeakSet<Event>();
  const sx = new Spring1D(springs.follow);
  const sy = new Spring1D(springs.follow);
  const tilt = new Spring1D({ stiffness: 300, damping: 0.7 });
  const vt = createVelocityTracker(90);
  /** Drag watch: last emitted frame (re-sent as `end`), where the pointer last rested and since when (frame time). */
  let lastFrame: DragFrame | null = null;
  let stillAt: Point = { x: 0, y: 0 };
  let stillSince = 0;

  const setState = (s: DragState) => {
    if (state === s) return;
    const was = state;
    state = s;
    if (was === 'dragging' && lastFrame) {
      emitDrag({ ...lastFrame, phase: 'end' });
      lastFrame = null;
    }
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
    seenTouch.add(e);
    if (state !== 'dragging') return;
    // a sheet's own swipe-to-dismiss underneath never sees the moves of a drag
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    // this press's finger steers a lifted drag even while pointer moves still come (they say the same) or have just
    // stopped without a pointercancel (iOS on a sideways move): the touch events are always sent
    const t = touchId !== null ? finger(e.touches) : undefined;
    if (t) {
      cur = { x: t.clientX, y: t.clientY };
      vt.add(cur.x, cur.y, e.timeStamp || performance.now());
      update(cur.x, cur.y);
    }
  };
  /**
   * The card's own non-passive touchmove listener, there from creation: iOS WebKit decides at touchstart whether the
   * moves of a touch can stop scrolling, from the non-passive listeners present then (one added on pointerdown is too late).
   */
  const onElTouchMove = (e: TouchEvent) => {
    if (state === 'dragging' && e.cancelable) e.preventDefault();
    // a carried card that left the page: its touch events no longer reach the window
    if (ghost && !seenTouch.has(e)) onTouchMove(e);
  };
  const onElTouchEnd = (e: TouchEvent) => {
    if (ghost && !seenTouch.has(e)) onTouchEnd(e);
  };
  const onElTouchCancel = (e: TouchEvent) => {
    if (ghost && !seenTouch.has(e)) onTouchCancel(e);
  };
  /** Notes the finger of this press (passive): only a press that sends touch events can be carried by them. */
  const onElTouchStart = (e: TouchEvent) => {
    if (state === 'pending' && touchId === null) touchId = e.changedTouches?.[0]?.identifier ?? null;
  };
  /** This press's finger in a touch list (a second finger never steers the drag). */
  const finger = (list: TouchList | undefined) => (list ? [...list].find((t) => t.identifier === touchId) : undefined);
  const onTouchEnd = (e: TouchEvent) => {
    seenTouch.add(e);
    // a pointerup that came first has dropped already; one that never comes (pointer events stopped) leaves it to the touch
    if (touchId === null || state !== 'dragging') return;
    const t = finger(e.changedTouches);
    if (!t) return;
    cur = { x: t.clientX, y: t.clientY };
    update(cur.x, cur.y);
    drop();
  };
  const onTouchCancel = (e: TouchEvent) => {
    seenTouch.add(e);
    if (touchId !== null && state === 'dragging' && finger(e.changedTouches)) cancel();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (state === 'dragging' || state === 'pending')) cancel();
  };
  const onCtx = (e: Event) => {
    if (state !== 'idle') e.preventDefault();
  };
  // a press that may become a drag never starts a text selection (iOS long press)
  const onSelectStart = (e: Event) => {
    if (state !== 'idle') e.preventDefault();
  };
  const onScroll = () => {
    if (state === 'dragging') update(cur.x, cur.y, true);
  };
  /** Swallows the click on this card right after a drop, on window so no ancestor's capture listener sees it either. */
  const onClickCapture = (e: Event) => {
    if (!(e.target instanceof Node) || !el.contains(e.target)) return;
    window.removeEventListener('click', onClickCapture, true);
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
    window.addEventListener('selectstart', onSelectStart, true);
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchCancel, true);
  }
  function unlisten() {
    if (!listening) return;
    listening = false;
    window.removeEventListener('pointermove', onWinMove, true);
    window.removeEventListener('pointerup', onWinUp, true);
    window.removeEventListener('pointercancel', onWinCancel, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('contextmenu', onCtx, true);
    window.removeEventListener('selectstart', onSelectStart, true);
    window.removeEventListener('touchmove', onTouchMove, true);
    window.removeEventListener('touchend', onTouchEnd, true);
    window.removeEventListener('touchcancel', onTouchCancel, true);
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
  /** Removes the carry ghost and shows the card again (it may be gone from the page by now). */
  function dropGhost() {
    if (!ghost) return;
    const g = ghost;
    ghost = null;
    el.style.visibility = prevVisibility;
    // the moved card renders on the next frame: the copy goes after it, so nothing blinks
    requestAnimationFrame(() => requestAnimationFrame(() => g.remove()));
  }

  function carry() {
    if (state !== 'dragging' || ghost || !ctx) return;
    const r = ctx.originRect;
    const g = el.cloneNode(true) as HTMLElement;
    // a copy, never the card: no id and no test ids to be found by
    g.removeAttribute('id');
    for (const n of [g, ...g.querySelectorAll('[data-testid],[id]')]) { n.removeAttribute('data-testid'); n.removeAttribute('id'); }
    g.dataset.dragGhost = 'true';
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, {
      position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0',
      zIndex: '60', pointerEvents: 'none', transition: 'none', transform: el.style.transform, boxShadow: el.style.boxShadow,
    });
    document.body.appendChild(g);
    ghost = g;
    prevVisibility = el.style.visibility;
    el.style.visibility = 'hidden';
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
    sc?.removeEventListener('scroll', onScroll);
    sc = null;
    touchId = null;
    if (locked) {
      locked.style.overflowY = lockedOverflow;
      locked = null;
    }
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
    touchId = null;
    start = { x: e.clientX, y: e.clientY };
    cur = { ...start };
    ctx = { originRect: rect, grab: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    vt.reset();
    vt.add(e.clientX, e.clientY, e.timeStamp || performance.now());
    listen();
    setState('pending');
    // press-and-hold picks up like a long press (mouse too); a mouse still picks up early past the slop
    timer = setTimeout(pickUp, touchDelay);
  }

  function pickUp() {
    clearTimer();
    if (state !== 'pending' || !ctx) return;
    claim();
    window.dispatchEvent(new CustomEvent(GESTURE_CLAIM_EVENT));
    try { el.setPointerCapture?.(pointerId); } catch { /* ignore */ }
    prevStyle = {
      transform: el.style.transform, transition: el.style.transition, zIndex: el.style.zIndex, boxShadow: el.style.boxShadow,
      touchAction: el.style.touchAction, userSelect: el.style.userSelect, willChange: el.style.willChange, position: el.style.position,
    };
    k = opts.scale?.() || 1;
    el.dataset.dragging = 'true';
    el.style.transition = 'none';
    el.style.zIndex = '60';
    el.style.userSelect = 'none';
    el.style.willChange = 'transform';
    edgeSince = 0;
    // wheel scrolling stays native during a drag; follow it so the indicator tracks the pointer over the moving grid
    sc = opts.scrollEl?.() ?? null;
    scroll0 = sc ? { x: sc.scrollLeft, y: sc.scrollTop } : { x: 0, y: 0 };
    lastShift = { x: 0, y: 0 };
    sc?.addEventListener('scroll', onScroll, { passive: true });
    // a native pan the browser may still start under a lifted touch drag (iOS) must not scroll the grid away under it
    if (isTouch && sc) {
      locked = sc;
      lockedOverflow = sc.style.overflowY;
      sc.style.overflowY = 'hidden';
    }
    sx.snap(0); sy.snap(0); tilt.snap(0);
    haptic(10);
    setState('dragging');
    stillAt = { ...cur };
    stillSince = performance.now();
    watchFrame('start', stillSince);
    if (getMotionLevel() === 'full') {
      // small wiggle on the independent `rotate` property so it composes with the follow transform
      const a = el.animate?.(
        [{ rotate: '0deg' }, { rotate: '-2.2deg' }, { rotate: '1.8deg' }, { rotate: '-1deg' }, { rotate: '0deg' }],
        { duration: 340, easing: 'ease-in-out' },
      );
      if (a) anims.push(a);
    }
    tested = null;
    update(cur.x, cur.y, true);
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /** Where the hit test last ran: a move to the same point does not run it again (a scroll or a refresh forces it). */
  let tested: Point | null = null;
  function update(x: number, y: number, force = false) {
    if (!ctx) return;
    if (!force && tested && tested.x === x && tested.y === y) return;
    tested = { x, y };
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
    } else if (state === 'dragging') {
      // a touch drag outlives the pointer the browser cancelled for its pan: the touch events carry it to the drop
      // (only when this press sent touch events: a pen on Windows/ChromeOS sends none and would stay lifted)
      if (touchId === null) cancel();
    }
  }

  /** How far the card's layout box moved since pick-up because its scroll container scrolled (0 when outside it). */
  function scrollShift(): Point {
    // a ghost sits at the pick-up rect, fixed: the scroll of the grid no longer moves what is drawn
    if (ghost || !sc || !sc.contains(el)) return { x: 0, y: 0 };
    return { x: sc.scrollLeft - scroll0.x, y: sc.scrollTop - scroll0.y };
  }

  /** Translation of the card from its layout box: hit-test dx/dy and pointer deltas are relative to the pick-up rect. */
  function offsets(): Point {
    const s = scrollShift();
    if (magnet && target && target.dx !== undefined && target.dy !== undefined) return { x: target.dx + s.x, y: target.dy + s.y };
    return { x: cur.x - start.x + s.x, y: cur.y - start.y + s.y };
  }

  function paint() {
    const { vx } = vt.velocity();
    tilt.target = clamp(vx / 160, -MAX_TILT, MAX_TILT);
    const v = ghost ?? el;
    v.style.transform = `translate3d(${sx.x.toFixed(2)}px, ${sy.x.toFixed(2)}px, 0) rotate(${tilt.x.toFixed(2)}deg) scale(1.05)`;
    v.style.boxShadow = '0 14px 30px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.18)';
  }

  function autoScroll(dt: number) {
    // a card held still near the edge (press-and-hold release) must not drift under the pointer
    if (!sc || Math.hypot(cur.x - start.x, cur.y - start.y) <= touchSlop) return;
    const r = sc.getBoundingClientRect();
    const edge = 56;
    let v = 0;
    if (cur.y < r.top + edge) v = -(1 - clamp((cur.y - r.top) / edge, 0, 1));
    else if (cur.y > r.bottom - edge) v = 1 - clamp((r.bottom - cur.y) / edge, 0, 1);
    // dwell first: a pointer that merely arrives in the edge zone (and is released there) must not move the grid under the target
    if (!v) edgeSince = 0;
    else if (!edgeSince) edgeSince = performance.now();
    if (v && performance.now() - edgeSince >= EDGE_DWELL_MS) {
      const before = sc.scrollTop;
      sc.scrollTop += v * 600 * dt;
      if (sc.scrollTop !== before) update(cur.x, cur.y, true);
    }
  }

  function frame(t: number) {
    raf = 0;
    if (state !== 'dragging') return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // scroll first so this frame's transform already matches the new scroll position
    autoScroll(dt);
    const o0 = offsets();
    const o = { x: o0.x / k, y: o0.y / k };
    const lvl = getMotionLevel();
    // a scroll moves the card's layout box: shift the spring with it, so only pointer motion lags, never the scroll
    const s = scrollShift();
    sx.x += s.x - lastShift.x; sx.target += s.x - lastShift.x;
    sy.x += s.y - lastShift.y; sy.target += s.y - lastShift.y;
    lastShift = s;
    if (lvl === 'full') {
      sx.target = o.x;
      sy.target = o.y;
      sx.step(dt); sy.step(dt); tilt.step(dt);
    } else {
      sx.snap(o.x); sy.snap(o.y); tilt.snap(0);
    }
    paint();
    watchFrame('move', t);
    raf = requestAnimationFrame(frame);
  }

  /** Tells drag watchers where the card is drawn now; skipped entirely while nobody watches. */
  function watchFrame(phase: 'start' | 'move', t: number) {
    if (!watchers.size || !ctx) return;
    if (Math.hypot(cur.x - stillAt.x, cur.y - stillAt.y) > STILL_SLOP) {
      stillAt = { ...cur };
      stillSince = t;
    }
    // the drawn card = pick-up rect + spring offset - scroll since pick-up (the layout box moved with the scroll)
    const s = scrollShift();
    const dx = sx.x * k - s.x;
    const dy = sy.x * k - s.y;
    const r = ctx.originRect;
    const { vx, vy } = vt.velocity();
    lastFrame = { phase, rect: { left: r.left + dx, top: r.top + dy, width: r.width, height: r.height }, dx, dy, vx, vy, stillMs: Math.max(0, t - stillSince) };
    emitDrag(lastFrame);
  }

  function currentOffset() {
    return { x: sx.x, y: sy.x };
  }

  function finishVisual() {
    cancelAnims();
    dropGhost();
    restoreStyle();
    reset();
    setState('idle');
    if (destroyLater) destroyNow();
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
    // a carried card's origin is on another day or week: nothing to spring back to on screen
    if (ghost) return finishVisual();
    const from = currentOffset();
    setTarget(null);
    el.dataset.dragging = 'false';
    springBack(from);
  }

  function suppressNextClick() {
    window.addEventListener('click', onClickCapture, true);
    // a new drop re-arms the full 400 ms: an earlier drop's timer must not disarm it
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      window.removeEventListener('click', onClickCapture, true);
    }, 400);
  }

  async function drop() {
    const t = target;
    stopRaf();
    suppressNextClick();
    const from = currentOffset();
    if (!t) {
      el.dataset.dragging = 'false';
      if (ghost) return finishVisual();
      springBack(from);
      return;
    }
    setState('dropping');
    el.dataset.dragging = 'false';
    const shift = scrollShift();
    const at = t.dx !== undefined && t.dy !== undefined ? { x: t.dx, y: t.dy } : { x: cur.x - start.x, y: cur.y - start.y };
    // `at` is relative to the pick-up rect (viewport); the card's transform also has to undo the scroll since pick-up
    const dest = { x: (at.x + shift.x) / k, y: (at.y + shift.y) / k };
    const blingAt = ctx
      ? { x: ctx.originRect.left + ctx.originRect.width / 2 + at.x, y: ctx.originRect.top + ctx.originRect.height / 2 + at.y }
      : cur;
    let p: void | Promise<unknown>;
    try {
      p = opts.onDrop(t);
    } catch (err) {
      p = Promise.reject(err);
    }
    if (ghost) {
      // the moved card is drawn at its new place by the consumer: the ghost goes, a failure rolls back off screen
      Promise.resolve(p).catch(() => undefined);
      spawnBling(blingAt);
      finishVisual();
      return;
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
      // The card is usable again as soon as the wobble ends; the PATCH round trip (can take seconds) must not keep the
      // controller in `dropping`, or a new long-press on this card is ignored meanwhile.
      let failed = false;
      let settled = false;
      const outcome = Promise.resolve(p).then(() => { settled = true; }, () => { settled = true; failed = true; });
      if (w) await w.finished.then(() => undefined, () => undefined);
      if (!settled) {
        finishVisual();
        void outcome.then(() => {
          // consumer rolled back: wobble the (re-laid out) card from the dropped place back to the origin, unless
          // the user already grabbed it again
          if (failed && state === 'idle' && el.isConnected) {
            animate(el, [{ transform: `translate3d(${dest.x}px, ${dest.y}px, 0)` }, { transform: 'translate3d(0,0,0)' }], { spring: springs.wobble, reduced: 'same', duration: 220 });
          }
        });
        return;
      }
      if (failed) {
        if (!el.isConnected) return finishVisual();
        cancelAnims();
        springBack(dest, 1);
        return;
      }
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
  el.addEventListener('touchmove', onElTouchMove, { passive: false });
  el.addEventListener('touchstart', onElTouchStart, { passive: true });
  el.addEventListener('touchend', onElTouchEnd);
  el.addEventListener('touchcancel', onElTouchCancel);
  el.addEventListener('dragstart', preventNative);
  function preventNative(e: Event) {
    e.preventDefault();
  }

  function destroyNow() {
    destroyLater = false;
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('touchmove', onElTouchMove);
    el.removeEventListener('touchstart', onElTouchStart);
    el.removeEventListener('touchend', onElTouchEnd);
    el.removeEventListener('touchcancel', onElTouchCancel);
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = null;
    el.removeEventListener('dragstart', preventNative);
    window.removeEventListener('click', onClickCapture, true);
    cancelAnims();
    dropGhost();
    if (state !== 'idle') restoreStyle();
    reset();
    // the owner hears the drag is over (it clears its drop preview, edge band and the like)
    if (state !== 'idle') setState('idle');
    delete el.dataset.dragging;
  }

  return {
    get state() {
      return state;
    },
    cancel,
    carry,
    refresh() {
      if (state === 'dragging') update(cur.x, cur.y, true);
    },
    destroy() {
      // a carried drag outlives its card's component: it ends at the drop
      if (ghost && state === 'dragging') {
        destroyLater = true;
        return;
      }
      destroyNow();
    },
  };
}

/** Vue wrapper. `elRef` may be a template ref; re-binds when the element changes. */
export function useDraggable<K>(elRef: Ref<HTMLElement | null | undefined> | (() => HTMLElement | null | undefined), opts: DragOptions<K>) {
  let ctl: DragController | null = null;
  /** A carried drag whose card was unbound: it runs on until its drop and is still the one asked about. */
  let carried: DragController | null = null;
  const wrapped = opts;
  const get = () => (isRef(elRef) ? elRef.value : elRef());
  const unbind = () => {
    ctl?.destroy();
    if (ctl && ctl.state === 'dragging') carried = ctl;
    ctl = null;
  };
  const stop = watch(
    get,
    (el) => {
      unbind();
      ctl = el instanceof HTMLElement ? createDragController(el, wrapped) : null;
    },
    { immediate: true, flush: 'post' },
  );
  const dispose = () => {
    stop();
    unbind();
  };
  if (getCurrentScope()) onScopeDispose(dispose);
  const active = () => (carried && carried.state !== 'idle' ? carried : ctl);
  return {
    get state() { return active()?.state ?? 'idle'; },
    cancel: () => active()?.cancel(),
    carry: () => active()?.carry(),
    refresh: () => active()?.refresh(),
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
  /** Minutes-of-day at the top of rect (default 0), e.g. 480 when the grid starts at 08:00. Added to key.minutes. */
  startMinutes?: number;
}
export interface SlotKey { column: number; minutes: number }

/**
 * Hit-test for time grids. The card's top edge snaps to the slot; dx/dy move it there. Sideways it moves by whole
 * columns only: a card drawn in the right part of its column (side by side, cascaded) keeps that place and stays under
 * the finger instead of jumping to the column's left edge (owner, 2026-10-23).
 */
export function createSlotGrid(o: SlotGridOptions): (x: number, y: number, ctx: DragContext) => DropTarget<SlotKey> | null {
  const step = o.step ?? 15;
  const gutter = o.gutter ?? 0;
  return (x, y, ctx) => {
    const r = o.rect();
    if (!r) return null;
    const colW = (r.width - gutter) / o.columns;
    const columnAt = (px: number) => clamp(Math.floor((px - r.left - gutter) / colW), 0, o.columns - 1);
    const column = columnAt(x);
    const maxMin = r.height / o.pxPerMinute - step;
    const topY = y - ctx.grab.y - r.top;
    const minutes = clamp(snap(topY / o.pxPerMinute, step), 0, Math.max(0, Math.round(maxMin / step) * step));
    return {
      key: { column, minutes: minutes + (o.startMinutes ?? 0) },
      dx: (column - columnAt(ctx.originRect.left + ctx.grab.x)) * colW,
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
