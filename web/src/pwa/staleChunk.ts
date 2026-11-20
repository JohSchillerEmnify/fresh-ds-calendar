import { watch } from 'vue';
import type { Router } from 'vue-router';
import { dialogLoads } from '@/extensions/registry';
import { uiIsSafe } from './update';

const RELOAD_KEY = 'cal.chunkReloadAt';
/** A second chunk failure within this time of a reload is not answered with another reload (no loop). */
const LOOP_GUARD_MS = 60_000;
const MESSAGES = ['Failed to fetch dynamically imported module', 'error loading dynamically imported module', 'Importing a module script failed', 'Unable to preload CSS'];

/** The error a browser or Vite's preload helper throws when a lazily loaded script or style file no longer exists on the server. */
export function isStaleChunkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return MESSAGES.some((x) => m.includes(x));
}

/** Takes the one reload this minute; false when one just happened or storage cannot remember it (no guard, no reload: it could loop). */
function claimReload(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    if (at && Date.now() - at < LOOP_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

let deferred = false;

/** A fresh page load fetches the renamed files; with no navigation it waits for a safe moment (no dialog open) unless the dialog just opened failed. `any`: stale whatever the error says. */
export function handleStaleChunk(e: unknown, to?: string, any = false): boolean {
  if (!(any || isStaleChunkError(e)) || navigator.onLine === false) return false;
  if (to || uiIsSafe() || dialogLoads.pending > 0) return reload(to);
  if (deferred) return true;
  deferred = true;
  const stop = watch(uiIsSafe, (safe) => {
    if (!safe) return;
    stop();
    deferred = false;
    reload();
  });
  return true;
}

function reload(to?: string): boolean {
  if (!claimReload()) return false;
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
    if (handleStaleChunk((ev as Event & { payload?: unknown }).payload, pending, true)) ev.preventDefault();
  });
  router.onError((e, to) => { pending = undefined; handleStaleChunk(e, to.fullPath); });
  window.addEventListener('unhandledrejection', (ev) => { handleStaleChunk(ev.reason); });
}
