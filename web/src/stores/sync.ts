import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '@/api/client';
import { appTimeout, DisposerBag, listen, type Disposer } from '@/lib/timers';
import { useClockStore } from './clock';
import { useItemsStore } from './items';
import { useSettingsStore } from './settings';

export type SyncState = 'idle' | 'syncing' | 'error';
export const SYNC_ERROR_MESSAGE = "Can't reach Google Calendar. Showing the last known data.";
const FOCUS_DEBOUNCE_MS = 500;

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

  const errorMessage = computed(() => (error.value ? SYNC_ERROR_MESSAGE : ''));

  /** Add a refresher run on every sync (e.g. the open task tray, motivation). Returns an unregister function. */
  function registerTask(name: string, fn: () => Promise<unknown>): () => void {
    tasks.set(name, fn);
    return () => { if (tasks.get(name) === fn) tasks.delete(name); };
  }

  function reportError(e: unknown): void {
    if (e instanceof ApiError && e.isUnavailable) {
      error.value = e;
      state.value = 'error';
    }
  }
  /** A fetch outside the polling loop (route load) succeeded: counts as a completed sync. */
  function markSynced(): void {
    lastSync.value = new Date().toISOString();
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
    ];
  }

  async function run(withConfig: boolean): Promise<void> {
    running.value = true;
    if (state.value !== 'error') state.value = 'syncing';
    const clock = useClockStore();
    if (withConfig) await clock.load().catch(() => undefined);
    const list = [...builtinTasks(), ...tasks.entries()];
    const results = await Promise.allSettled(list.map(([, fn]) => fn()));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.isAbort));
    if (failed) {
      if (failed.reason instanceof ApiError && failed.reason.isUnavailable) reportError(failed.reason);
      else if (!error.value) state.value = 'idle';
      else state.value = 'error';
    } else {
      error.value = null;
      state.value = 'idle';
      lastSync.value = new Date().toISOString();
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
        } while (again);
      } finally {
        current = null;
      }
    })();
    return current;
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
    void syncNow(true).then(schedule);
  }
  function onFocus(): void {
    focusTimer?.();
    focusTimer = appTimeout(() => {
      focusTimer = null;
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
