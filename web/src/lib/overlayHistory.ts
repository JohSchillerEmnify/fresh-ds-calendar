/**
 * Overlay back-stack: the system back (Android gesture/button, browser back, iOS Safari edge swipe) closes the
 * topmost open overlay first. Opening an overlay pushes a history entry carrying `{ overlay: id }` (no route
 * change, router keys copied so vue-router's position bookkeeping stays intact); `popstate` closes the topmost
 * overlay; closing by other means goes back over the entry. See feature navigation.
 */
import { onScopeDispose, watch } from 'vue';
import type { Router } from 'vue-router';

interface Entry { id: number; close: () => void }

const stack: Entry[] = [];
const pending: Array<() => void> = [];
let seq = 0;
let busy = false;
let installed = false;
let navDone: Promise<unknown> = Promise.resolve();

function run(op: () => void): void {
  if (busy) pending.push(op);
  else op();
}

function flush(): void {
  while (!busy && pending.length) pending.shift()!();
}

/** Capture-phase listener so it runs before (and can hide the event from) vue-router's own popstate handler. */
function onPopState(e: PopStateEvent): void {
  if (busy) {
    // our own history.back() finished; the router must not see it
    busy = false;
    e.stopImmediatePropagation();
    flush();
    return;
  }
  const top = stack.pop();
  if (!top) return;
  e.stopImmediatePropagation();
  top.close();
}

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', onPopState, true);
}

/** Registers an open overlay and queues its history entry; returns its release function. */
function register(close: () => void): () => void {
  install();
  const entry: Entry = { id: ++seq, close };
  stack.push(entry);
  run(() => {
    if (stack.includes(entry)) history.pushState({ ...(history.state as object | null), overlay: entry.id }, '');
  });
  return () => {
    const i = stack.indexOf(entry);
    if (i < 0) return; // already closed by popstate, which consumed the entry
    stack.splice(i, 1);
    // a router navigation started in the same tick must land first, else our back() races and undoes it
    void navDone.then(() => run(() => {
      // only the entry on top of the history can be consumed; a buried one stays (harmless no-op back)
      if ((history.state as { overlay?: number } | null)?.overlay !== entry.id) return;
      busy = true;
      history.back();
    }));
  };
}

/**
 * Makes router pushes made while an overlay entry is on top replace that entry (a navigation supersedes the
 * overlay, so there is no dead entry and the later close must not go back over it), and lets the overlay close
 * wait for an in-flight navigation. Call once after creating the router.
 */
export function bindRouterToOverlays(router: Router): void {
  const push = router.push.bind(router);
  router.push = (to) => {
    if ((history.state as { overlay?: number } | null)?.overlay == null) return push(to);
    const p = router.replace(to).then((failure) => {
      // success: the entry now holds the new route; drop its overlay marker so closing does not go back
      if (!failure) history.replaceState({ ...(history.state as object), overlay: undefined }, '');
      return failure;
    });
    navDone = p.catch(() => undefined);
    return p;
  };
}

/** Ties an overlay's open state to a history entry: `close` is called when the system back is pressed. */
export function useOverlayHistory(isOpen: () => boolean, close: () => void): void {
  let release: (() => void) | null = null;
  watch(isOpen, (open) => {
    if (open && !release) release = register(close);
    else if (!open && release) { release(); release = null; }
  }, { immediate: true });
  onScopeDispose(() => { release?.(); release = null; });
}
