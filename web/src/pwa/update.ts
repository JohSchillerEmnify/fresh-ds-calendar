import { api } from '@/api/client';
import { useUiStore } from '@/stores/ui';

let offered: number | null = null;
/** The waiting service worker to activate on "Reload" (null: no worker, e.g. insecure context or TEST_MODE). */
let waiting: ServiceWorker | null = null;

/** Version this page was built with (`<html data-app-version>`, falling back to the build-time constant). */
export function runningVersion(): string {
  return document.documentElement.dataset.appVersion ?? __APP_VERSION__;
}

/** Remember the service worker that carries the new assets; "Reload" activates it first. */
export function setWaitingWorker(w: ServiceWorker | null): void {
  waiting = w;
}

/** Activate a waiting service worker (if any), then reload. Only ever called from the user's click. */
function reload(): void {
  if (!waiting) { location.reload(); return; }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Show the persistent "new version" snackbar once; it never reloads by itself. */
export function offerUpdate(): void {
  const ui = useUiStore();
  if (offered !== null && ui.snackbars.some((s) => s.id === offered)) return;
  offered = ui.notify('New version available', {
    duration: 0, testid: 'update-available',
    action: { label: 'Reload', testid: 'update-reload', run: reload },
  });
}

/** Offer a reload when the server's build version differs from the running one (empty = unknown, ignored). */
export function checkVersion(serverVersion: string): void {
  if (serverVersion && serverVersion !== runningVersion()) offerUpdate();
}

/** Lightweight `/api/config` fetch for syncs that do not reload the clock; failures are ignored (offline). */
export async function checkServerVersion(): Promise<void> {
  try {
    checkVersion((await api.config()).version);
  } catch {
    // offline: the next sync checks again
  }
}
