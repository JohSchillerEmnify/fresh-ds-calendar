import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, ApiError, type SyncErrorBeacon } from '@/api/client';
import { appTimeout, DisposerBag, listen, type Disposer } from '@/lib/timers';
import { useCalendarsStore } from './calendars';
import { useClockStore } from './clock';
import { useItemsStore } from './items';
import { useSettingsStore } from './settings';
import { checkServerVersion, checkVersion } from '@/pwa/update';
import { t } from '@/i18n';

/** In the Android app only: hands the home-screen widget a fresh snapshot (a no-op in a browser, nothing is loaded). */
export function pushWidget(): void {
  if (typeof window !== 'undefined' && 'Capacitor' in window) void import('@/native/widgetBridge').then((m) => m.onSynced());
}

export type SyncState = 'idle' | 'syncing' | 'error';
const FOCUS_DEBOUNCE_MS = 500;
/** A failure within this long after the page became visible again counts as "just resumed". */
const RESUME_WINDOW_MS = 5000;

/**
 * Background sync. Exactly one polling timer exists app-wide (`pollTimer`), chained after each sync, paused while
 * `document.hidden` and resumed with one immediate sync on `visible`. Triggers: interval (`pollIntervalMs` from
 * /api/config, 0 = off), window focus (debounced), visibilitychange, `online`, `retry()`, route changes
 * (the items store). Other features add their own refreshers with `registerTask`.
 */
export const useSyncStore = defineStore('sync', () => {
  const state = ref<SyncState>('idle');
  const lastSync = ref<string | null>(null);
  const error = ref<ApiError | null>(null);
  const running = ref(false);

  const tasks = new Map<string, () => Promise<unknown>>();
  const bag = new DisposerBag();
  let pollTimer: Disposer | null = null;
  let focusTimer: Disposer | null = null;
  let started = false;
  let current: Promise<void> | null = null;
  let again = false;
  let visibleAt = -Infinity;
  /** A beacon that could not be sent (network down); the next successful sync sends it. */
  let pending: { beacon: SyncErrorBeacon; at: number } | null = null;

  const errorMessage = computed(() => (error.value ? t('calendar.sync.unreachable') : ''));

  /** Add a refresher run on every sync (e.g. the open task tray, motivation). Returns an unregister function. */
  function registerTask(name: string, fn: () => Promise<unknown>): () => void {
    tasks.set(name, fn);
    return () => { if (tasks.get(name) === fn) tasks.delete(name); };
  }

  /** Tells the server (which only logs it) why the banner appeared; a send that fails on the network waits for the next good sync. */
  function sendBeacon(beacon: SyncErrorBeacon, retry: boolean): void {
    api.diagSyncError(beacon).catch((e) => {
      if (retry && e instanceof ApiError && e.code === 'NETWORK') pending = { beacon, at: Date.now() };
    });
  }

  function beaconFor(e: ApiError, task: string): SyncErrorBeacon {
    return {
      kind: e.isAbort ? 'abort' : e.timeout ? 'timeout' : e.status > 0 ? 'http' : 'network',
      ...(e.status > 0 ? { status: e.status } : {}),
      task,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      resumed: Date.now() - visibleAt <= RESUME_WINDOW_MS,
      app: typeof window !== 'undefined' && 'Capacitor' in window,
    };
  }

  /** Shows the banner for an unavailable error; `task` names the failed refresher for the diagnostics beacon. */
  function reportError(e: unknown, task = 'other'): void {
    if (e instanceof ApiError && e.isUnavailable) {
      const entering = state.value !== 'error';
      error.value = e;
      state.value = 'error';
      if (entering) sendBeacon(beaconFor(e, task), true);
    }
  }
  function clearError(): void {
    error.value = null;
    state.value = 'idle';
  }

  function builtinTasks(): [string, () => Promise<unknown>][] {
    const items = useItemsStore();
    const settings = useSettingsStore();
    return [
      ['items', () => items.refreshVisible()],
      ['summary', () => items.refreshSummaries()],
      ['settings', () => settings.load()],
      ['calendars', () => useCalendarsStore().load()],
    ];
  }

  async function run(withConfig: boolean): Promise<void> {
    running.value = true;
    if (state.value !== 'error') state.value = 'syncing';
    const clock = useClockStore();
    if (withConfig) {
      await clock.load().catch(() => undefined);
      checkVersion(clock.config.version, clock.config.apk);
    } else {
      await checkServerVersion();
    }
    const list = [...builtinTasks(), ...tasks.entries()];
    const results = await Promise.allSettled(list.map(([, fn]) => fn()));
    const failedAt = results.findIndex((r) => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.isAbort));
    const failed = failedAt >= 0 ? (results[failedAt] as PromiseRejectedResult) : undefined;
    if (failed) {
      if (failed.reason instanceof ApiError && failed.reason.isUnavailable) reportError(failed.reason, list[failedAt]![0]);
      else if (!error.value) state.value = 'idle';
      else state.value = 'error';
    } else {
      error.value = null;
      state.value = 'idle';
      lastSync.value = new Date().toISOString();
      pushWidget();
      if (pending) {
        const p = pending;
        pending = null;
        sendBeacon({ ...p.beacon, ageSec: Math.round((Date.now() - p.at) / 1000) }, false);
      }
    }
    running.value = false;
  }

  /** Run a sync now (coalesces concurrent calls; a call during a run schedules exactly one follow-up). */
  function syncNow(withConfig = false): Promise<void> {
    if (current) {
      again = true;
      return current;
    }
    current = (async () => {
      try {
        do {
          again = false;
          await run(withConfig);
          if (typeof document !== 'undefined' && document.hidden) again = false; // no follow-up fetch while hidden
        } while (again);
      } finally {
        current = null;
      }
    })();
    return current;
  }

  /** A fetch outside `run` (initial page load) succeeded: counts as a completed sync. */
  function markSynced(): void {
    if (state.value !== 'error') lastSync.value = new Date().toISOString();
  }

  function retry(): Promise<void> {
    return syncNow(true);
  }

  function schedule(): void {
    pollTimer?.();
    pollTimer = null;
    if (!started || (typeof document !== 'undefined' && document.hidden)) return;
    const ms = useClockStore().pollIntervalMs;
    if (!ms || ms <= 0) return;
    pollTimer = appTimeout(async () => {
      pollTimer = null;
      if (document.hidden) return;
      await syncNow();
      schedule();
    }, ms);
  }

  function onVisible(): void {
    if (document.hidden) {
      pollTimer?.();
      pollTimer = null;
      return;
    }
    visibleAt = Date.now();
    void syncNow(true).then(schedule);
  }
  function onFocus(): void {
    focusTimer?.();
    focusTimer = appTimeout(() => {
      focusTimer = null;
      if (document.hidden) return;
      void syncNow(true).then(schedule);
    }, FOCUS_DEBOUNCE_MS);
  }

  /** Start listeners and the polling timer. Idempotent. */
  function start(): void {
    if (started) return;
    started = true;
    bag.add(listen(document, 'visibilitychange', onVisible));
    bag.add(listen(window, 'focus', onFocus));
    bag.add(listen(window, 'online', () => { void syncNow(true).then(schedule); }));
    schedule();
  }
  /** Stop everything (timers and listeners). */
  function stop(): void {
    started = false;
    pollTimer?.();
    pollTimer = null;
    focusTimer?.();
    focusTimer = null;
    bag.dispose();
  }

  return { state, lastSync, error, errorMessage, running, registerTask, reportError, clearError, markSynced, syncNow, retry, start, stop, schedule };
});
