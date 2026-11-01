import { watch } from 'vue';
import { api } from '@/api/client';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import { apkHintVisible, checkApk } from '@/native/apkHint';
import { errorFacts, logDevice } from '@/lib/deviceLog';

const DISMISSED_KEY = 'cal.updateDismissed';
const RELOADED_KEY = 'cal.updateReloadedFor';

let offered: number | null = null;
/** The newest installed service worker, activated by `reload()` (null: none, so a plain reload; manual snackbar path). */
let waiting: ServiceWorker | null = null;
/** Newest server version seen by `checkVersion` ('' = none yet): what a "Reload" is for and what a dismissal is remembered against. */
let latest = '';
let warnedStuck = false;

/** Reads a per-session memory slot (null when storage is unavailable). */
function recall(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

/** Writes a per-session memory slot; without storage the memory is simply lost. */
function remember(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* storage unavailable: the prompt may come back */ }
}

/** Version this page was built with (`<html data-app-version>`, falling back to the build-time constant). */
export function runningVersion(): string {
  return document.documentElement.dataset.appVersion ?? __APP_VERSION__;
}

/** Activate a waiting service worker (if any), then reload. Remembers the target so a reload that comes back old is not re-offered. */
function reload(): void {
  if (latest) remember(RELOADED_KEY, latest);
  if (!waiting) { location.reload(); return; }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Preview builds (`…-preview+<sha>`) are for looking at the newest state, so they reload by themselves. */
export function isPreviewBuild(version = runningVersion()): boolean {
  return version.includes('-preview');
}

/** Whether `target` must not be offered: the person dismissed it, or a reload for it already came back with the old build. */
function suppressed(target: string): boolean {
  if (!target) return false;
  if (recall(DISMISSED_KEY) === target) return true;
  if (recall(RELOADED_KEY) === target && target !== runningVersion()) {
    if (!warnedStuck) { warnedStuck = true; console.warn(`[pwa] reloaded for ${target} but still running ${runningVersion()}; not offering it again`); }
    return true;
  }
  return false;
}

/** Show the persistent "new version" snackbar once; it never reloads by itself, except on a preview build. */
function offerUpdate(): void {
  if (suppressed(latest)) return;
  if (isPreviewBuild()) { reload(); return; }
  const ui = useUiStore();
  // the APK hint goes first (one snackbar at a time); the reload is offered again by the next check
  if (apkHintVisible()) return;
  if (offered !== null && ui.snackbars.some((s) => s.id === offered)) return;
  const target = latest;
  offered = ui.notify(t('calendar.update.available'), {
    duration: 0, testid: 'update-available',
    action: { label: t('calendar.update.reload'), testid: 'update-reload', run: reload },
    onClose: () => { if (target) remember(DISMISSED_KEY, target); },
  });
}

/** Stops the deferred-apply watchers (null: none set up). They are created once and torn down after applying. */
let stopDeferred: (() => void) | null = null;
/** Whether an auto-apply has started (the page is about to reload). */
let applying = false;

/** Safe moment to reload: no open dialog/editor, picker or drag/resize. */
function uiIsSafe(): boolean {
  const ui = useUiStore();
  return !ui.dialog && !ui.pickerOpen && !ui.resizing;
}

/**
 * Auto-apply the newest installed worker (controlling-worker path): now when the ui is safe, otherwise as soon as it
 * becomes safe or the tab is hidden, whichever comes first. A later worker replaces the pending one; the watchers are set up once.
 */
export function autoUpdate(w: ServiceWorker): void {
  if (applying || suppressed(latest)) return;
  // the newest worker always wins over a stale one from an earlier check
  waiting = w;
  if (uiIsSafe()) { applying = true; reload(); return; }
  if (stopDeferred) return;
  const apply = (): void => { stopDeferred?.(); stopDeferred = null; applying = true; reload(); };
  const stopWatch = watch(uiIsSafe, (safe) => { if (safe) apply(); });
  const onHidden = (): void => { if (document.hidden) apply(); };
  document.addEventListener('visibilitychange', onHidden);
  stopDeferred = () => { stopWatch(); document.removeEventListener('visibilitychange', onHidden); };
}

/**
 * With a controlling worker, fetch the CURRENT server worker (`reg.update()`) so the update jumps to the newest build, then
 * auto-apply it when safe. A worker that is still installing is handed over by the registration's `updatefound` handler.
 * Without a controlling worker (or registration) a plain reload loads the new build, so the manual snackbar is offered.
 */
async function offerWhenReady(): Promise<void> {
  if (!navigator.serviceWorker?.controller) { offerUpdate(); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { offerUpdate(); return; }
    await reg.update();
    if (!reg.installing && reg.waiting) autoUpdate(reg.waiting);
  } catch (e) {
    // offline or update failed: the next check tries again
    logDevice('sw', { step: 'update', ...errorFacts(e) });
  }
}

/** Offer a reload when the server's build version differs from the running one (empty = unknown, ignored). */
export async function checkVersion(serverVersion: string, apk?: { versionCode: number; versionName: string } | null): Promise<void> {
  // the APK hint is checked first, so that it wins over a pending reload
  await checkApk(apk);
  if (apkHintVisible()) {
    if (offered !== null) useUiStore().dismiss(offered);
    return;
  }
  if (!serverVersion || serverVersion === runningVersion()) return;
  latest = serverVersion;
  if (suppressed(serverVersion)) return;
  await offerWhenReady();
}

/** Lightweight `/api/config` fetch for syncs that do not reload the clock; failures are ignored (offline). */
export async function checkServerVersion(): Promise<void> {
  try {
    const c = await api.config();
    checkVersion(c.version, c.apk);
  } catch {
    // offline: the next sync checks again
  }
}
