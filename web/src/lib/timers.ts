/**
 * Leak-safe timer and listener helpers (feature resource-efficiency). Every timer/listener in the app goes through these,
 * so each returns a disposer and, in test mode, live timers are counted in `window.__appTimers`.
 */
import { getCurrentScope, onScopeDispose } from 'vue';

declare global {
  interface Window {
    __appTimers?: number;
  }
}

let counting = false;
function bump(d: number) {
  if (counting && typeof window !== 'undefined') window.__appTimers = Math.max(0, (window.__appTimers ?? 0) + d);
}

/** Turn on `window.__appTimers` counting (test mode only). */
export function enableTimerCounting(on = true): void {
  counting = on;
  if (on && typeof window !== 'undefined') window.__appTimers ??= 0;
}

export type Disposer = () => void;

export function appTimeout(fn: () => void, ms: number): Disposer {
  let live = true;
  bump(1);
  const id = setTimeout(() => {
    if (!live) return;
    live = false;
    bump(-1);
    fn();
  }, ms);
  return () => {
    if (!live) return;
    live = false;
    bump(-1);
    clearTimeout(id);
  };
}

export function listen<K extends keyof WindowEventMap>(
  target: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions,
): Disposer;
export function listen<K extends keyof DocumentEventMap>(
  target: Document, type: K, fn: (e: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions,
): Disposer;
export function listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): Disposer;
export function listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): Disposer {
  target.addEventListener(type, fn, opts);
  return () => target.removeEventListener(type, fn, opts);
}

/** Runs the disposer when the current component/effect scope is disposed. Returns it for early disposal. */
function autoDispose(d: Disposer): Disposer {
  if (getCurrentScope()) onScopeDispose(d);
  return d;
}

/** `listen` bound to the current component scope. */
export function useListener(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): Disposer {
  return autoDispose(listen(target, type, fn, opts));
}

/** A group of disposers (for stores: `dispose()` on `stop`). */
export class DisposerBag {
  private list: Disposer[] = [];
  add(d: Disposer): Disposer {
    this.list.push(d);
    return d;
  }
  dispose(): void {
    const l = this.list;
    this.list = [];
    for (const d of l) d();
  }
  get size(): number {
    return this.list.length;
  }
}
