/**
 * A finger on an iPhone, for the `iphone` project (WebKit): Playwright cannot move a touch in WebKit, so the page gets a
 * small model of iOS WebKit's touch handling (STEPS.md "Drag and drop", iPhone project) and the steps drive it.
 *
 *   installIosTouchModel   init script: tracks non-passive `touchmove` listeners, defines `window.__iosFinger`
 *   iosFinger(page)        down / move / up from the test side, plus `drag` (long press, moves, release)
 */
import type { Page } from '@playwright/test';

interface Point { x: number; y: number }

/** Page side of the model. Runs before any app code (context init script). */
export function installIosTouchModel(): void {
  type Listener = EventListenerOrEventListenerObject;
  // non-passive touchmove listeners per target, as WebKit's event regions see them
  const nonPassive = new WeakMap<EventTarget, Set<string>>();
  const ids = new WeakMap<object, number>();
  let nextId = 1;
  const keyOf = (fn: Listener, capture: boolean) => {
    if (!ids.has(fn)) ids.set(fn, nextId++);
    return `${ids.get(fn)}:${capture}`;
  };
  // WebKit makes window/document/body touch listeners passive unless they say otherwise
  const defaultPassive = (t: EventTarget) => t === window || t === document || t === document.documentElement || t === document.body;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, fn: Listener | null, opts?: boolean | AddEventListenerOptions) {
    if (type === 'touchmove' && fn) {
      const capture = typeof opts === 'boolean' ? opts : !!opts?.capture;
      const passive = typeof opts === 'object' && opts.passive !== undefined ? opts.passive : defaultPassive(this);
      if (!passive) {
        const set = nonPassive.get(this) ?? new Set<string>();
        set.add(keyOf(fn, capture));
        nonPassive.set(this, set);
      }
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, fn: Listener | null, opts?: boolean | EventListenerOptions) {
    if (type === 'touchmove' && fn) nonPassive.get(this)?.delete(keyOf(fn, typeof opts === 'boolean' ? opts : !!opts?.capture));
    return remove.call(this, type, fn, opts);
  };
  const preventable = (target: Element) => {
    const path: EventTarget[] = [];
    for (let n: Node | null = target; n; n = n.parentNode) path.push(n);
    path.push(window);
    return path.some((t) => (nonPassive.get(t)?.size ?? 0) > 0);
  };

  const POINTER_ID = 7;
  let g: {
    target: Element; start: Point; last: Point; preventable: boolean; firstMovePrevented: boolean | null; panning: boolean;
  } | null = null;

  const touchEvent = (type: string, p: Point, cancelable: boolean, released = false) => {
    const t = g!.target;
    const touch = { identifier: 1, target: t, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y, radiusX: 10, radiusY: 10, force: 1 };
    const ev = new TouchEvent(type, { bubbles: true, cancelable, composed: true });
    const list = released ? [] : [touch];
    Object.defineProperty(ev, 'touches', { value: list });
    Object.defineProperty(ev, 'targetTouches', { value: list });
    Object.defineProperty(ev, 'changedTouches', { value: [touch] });
    t.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const pointerEvent = (type: string, p: Point) => {
    g!.target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: type !== 'pointercancel', composed: true, pointerId: POINTER_ID, pointerType: 'touch', isPrimary: true,
      clientX: p.x, clientY: p.y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      width: 20, height: 20, pressure: type === 'pointerup' ? 0 : 0.5,
    }));
  };
  /** The nearest ancestor that scrolls natively right now (UIKit: scrollEnabled follows the computed overflow). */
  const scroller = (from: Element) => {
    for (let n: Element | null = from; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  };

  (window as unknown as { __iosFinger: unknown }).__iosFinger = {
    down(x: number, y: number) {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error(`nothing under the finger at ${x},${y}`);
      g = { target, start: { x, y }, last: { x, y }, preventable: preventable(target), firstMovePrevented: null, panning: false };
      pointerEvent('pointerdown', g.start);
      touchEvent('touchstart', g.start, g.preventable);
    },
    move(x: number, y: number) {
      if (!g) throw new Error('no finger down');
      const p = { x, y };
      if (!g.panning) pointerEvent('pointermove', p);
      const prevented = touchEvent('touchmove', p, g.preventable && !g.panning);
      // WebKit lets the first touch move decide whether the page may stop the native pan
      if (g.firstMovePrevented === null) g.firstMovePrevented = prevented;
      if (!g.panning && !g.firstMovePrevented && Math.hypot(x - g.start.x, y - g.start.y) > 10) {
        g.panning = true;
        if (y !== g.start.y) pointerEvent('pointercancel', p);
      }
      if (g.panning) {
        const s = scroller(g.target);
        if (s) s.scrollTop -= y - g.last.y;
      }
      g.last = p;
    },
    up() {
      if (!g) return;
      if (!g.panning) pointerEvent('pointerup', g.last);
      touchEvent('touchend', g.last, g.preventable && !g.panning, true);
      g = null;
    },
  };
}

/** Test side: the model's finger on `page`. */
export function iosFinger(page: Page) {
  const call = (fn: 'down' | 'move' | 'up', p?: Point) => page.evaluate(([f, q]) => {
    const finger = (window as unknown as { __iosFinger: Record<string, (x?: number, y?: number) => void> }).__iosFinger;
    finger[f as string](q ? (q as Point).x : undefined, q ? (q as Point).y : undefined);
  }, [fn, p] as const);
  return {
    down: (p: Point) => call('down', p),
    move: (p: Point) => call('move', p),
    up: () => call('up'),
    /** A long press of `holdMs` with the small moves of a real finger in it (1 px, then 2 px). */
    async press(p: Point, holdMs: number) {
      await call('down', p);
      const jitter = [{ x: p.x + 1, y: p.y }, { x: p.x + 1, y: p.y + 2 }];
      for (const j of jitter) {
        await page.waitForTimeout(holdMs / 4);
        await call('move', j);
      }
      await page.waitForTimeout(holdMs / 2);
    },
    /** Interpolated moves from `from` to `to` over about `durationMs`. */
    async moves(from: Point, to: Point, steps: number, durationMs: number) {
      for (let i = 1; i <= steps; i++) {
        await call('move', { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
        await page.waitForTimeout(durationMs / steps);
      }
    },
  };
}
