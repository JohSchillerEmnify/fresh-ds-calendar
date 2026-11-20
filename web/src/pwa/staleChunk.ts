import type { Router } from 'vue-router';

const RELOAD_KEY = 'cal.chunkReloadAt';
/** A second chunk failure within this time of a reload is not answered with another reload (no loop). */
const LOOP_GUARD_MS = 60_000;
const MESSAGES = ['Failed to fetch dynamically imported module', 'error loading dynamically imported module', 'Importing a module script failed'];

/** The error a browser throws when a lazily loaded script (route, dialog) no longer exists on the server. */
export function isStaleChunkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return MESSAGES.some((x) => m.includes(x));
}

/** After a deploy the running page still points at the old hashed files: a fresh page load (of `to` when given, so the view asked for opens) fetches the new ones. True when it reloaded. */
export function handleStaleChunk(e: unknown, to?: string): boolean {
  if (!isStaleChunkError(e) || navigator.onLine === false) return false;
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    if (at && Date.now() - at < LOOP_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage unavailable: a single reload attempt per failure is still safe because the new page has the files */ }
  if (to) location.assign(to); else location.reload();
  return true;
}

/** Listens for chunk loads that fail: Vite's preload error, router navigations and lazy components (unhandled rejections). */
export function installStaleChunkReload(router: Router): void {
  // the view being navigated to: Vite's preload error does not know it, and the person should land there after the reload
  let pending: string | undefined;
  router.beforeEach((to) => { pending = to.fullPath; });
  router.afterEach(() => { pending = undefined; });
  window.addEventListener('vite:preloadError', (ev) => {
    if (handleStaleChunk((ev as Event & { payload?: unknown }).payload, pending)) ev.preventDefault();
  });
  router.onError((e, to) => { handleStaleChunk(e, to.fullPath); });
  window.addEventListener('unhandledrejection', (ev) => { handleStaleChunk(ev.reason); });
}
