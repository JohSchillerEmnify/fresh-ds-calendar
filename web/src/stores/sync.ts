import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, ApiError, type SyncErrorBeacon } from '@/api/client';
import { errorFacts, logDevice } from '@/lib/deviceLog';
import { appTimeout, DisposerBag, listen, type Disposer } from '@/lib/timers';
import { startLiveSync } from '@/lib/liveSync';
import { ports } from '@/lib/outboxPorts';
import { useClockStore } from './clock';
import { useDeviceStore } from './device';
import { useItemsStore } from './items';
import { useOutboxStore } from './outbox';
import { checkServerVersion, checkVersion } from '@/pwa/update';
import { t } from '@/i18n';

/** In the Android app only: hands the home-screen widget a fresh snapshot (a no-op in a browser, nothing is loaded). */
export function pushWidget(): void {
  if (typeof window !== 'undefined' && 'Capacitor' in window) void import('@/native/widgetBridge').then((m) => m.onSynced());
}

export type SyncState = 'idle' | 'syncing' | 'error';
/** Why a sync runs: the triggers of ADR 0025 (and `changed`, which the live connection of ADR 0030 calls with). */
export type SyncReason = 'open' | 'focus' | 'visible' | 'online' | 'retry' | 'poll' | 'changed';
const FOCUS_DEBOUNCE_MS = 500;
/** After a failed sync, automatic triggers wait at least the poll interval (or this, when polling is off) and any `Retry-After`. */
const DEFAULT_BACKOFF_MS = 30_000;
/** While the live connection is up a normal poll is only a safety net: at most once a minute (a short interval set on purpose, e.g. by a test, stays). */
const LIVE_POLL_MS = 60_000;
const NORMAL_POLL_MS = 30_000;
/** A failure within this long after the page became visible again counts as "just resumed". */
const RESUME_WINDOW_MS = 5000;
/** How long our own server must stay unreachable before the banner says so (a deploy restart is shorter). */
const SERVER_DOWN_BANNER_MS = 60_000;

/**
 * Background sync. Exactly one polling timer exists app-wide (`pollTimer`), chained after each sync, paused while
 * `document.hidden` and resumed with one immediate sync on `visible`. Triggers: interval (`pollIntervalMs` from
 * /api/config, 0 = off), window focus (debounced), visibilitychange, `online`, `retry()`, route changes
 * (the items store). Other features add their own refreshers with `registerTask`.
 * A failed sync starts a quiet period (the poll interval, or the server's `Retry-After` when longer) in which focus,
 * visibility, `online` and queued follow-ups do not sync again; only the poll timer and `retry()` do.
 */
export const useSyncStore = defineStore('sync', () => {
  const state = ref<SyncState>('idle');
  const lastSync = ref<string | null>(null);
  /** The last successful sync: device time (the 5 minute rule) and app-clock time (what the person is told). */
  const lastOk = ref<{ wall: number; app: number }>({ wall: Date.now(), app: useDeviceStore().syncedAt ?? useClockStore().nowMs() });
  const error = ref<ApiError | null>(null);
  const running = ref(false);
  /** The server is rate limited by Google but the screen still has data: no banner, only this flag (and `data-rate-limited`). */
  const rateLimited = ref(false);

  const tasks = new Map<string, () => Promise<unknown>>();
  const bag = new DisposerBag();
  let pollTimer: Disposer | null = null;
  let focusTimer: Disposer | null = null;
  let started = false;
  let liveUp = false;
  let current: Promise<void> | null = null;
  let again = false;
  let visibleAt = -Infinity;
  /** Until this time (ms) automatic triggers do not start a sync (set by a failed sync). */
  let quietUntil = 0;
  /** A beacon that could not be sent (network down); the next successful sync sends it. */
  let pending: { beacon: SyncErrorBeacon; at: number } | null = null;

  /** When our own server first failed to answer in the current outage (null while it answers). */
  let serverDownSince: number | null = null;
  /** A sync has succeeded since the app opened: only then is a failed one possibly a blip (an app opened offline says so at once). */
  let hasSynced = false;

  const errorMessage = computed(() => (!error.value ? '' : error.value.isServerUnreachable ? t('calendar.sync.serverUnreachable') : t('calendar.sync.unreachable')));

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

  /** The device log keeps every failed sync, the banner's beacon facts included (feature device-log). */
  function logFailure(reason: unknown, task: string): void {
    logDevice('sync', reason instanceof ApiError ? { ...beaconFor(reason, task), code: reason.code } : { task, ...errorFacts(reason) });
  }

  /** Starts the quiet period after a failure: the poll interval, at least the server's `Retry-After`. */
  function noteFailure(e: ApiError): void {
    const poll = useClockStore().pollIntervalMs;
    const ms = Math.max(poll > 0 ? poll : DEFAULT_BACKOFF_MS, (e.retryAfterSec ?? 0) * 1000);
    quietUntil = Math.max(quietUntil, Date.now() + ms);
  }

  /** Shows the banner for an unavailable error (not for a rate limit while data is shown); `task` names the failed refresher for the diagnostics beacon. */
  function reportError(e: unknown, task = 'other', fromSync = false): void {
    if (e instanceof ApiError && e.isUnavailable) {
      noteFailure(e);
      // a restart of our server is over in seconds: the person is told only once it has lasted (the data stays shown meanwhile)
      // (a failed save or other action of the person is told at once)
      if (e.isServerUnreachable) {
        serverDownSince ??= Date.now();
        if (fromSync && hasSynced && Date.now() - serverDownSince < SERVER_DOWN_BANNER_MS) return;
      } else serverDownSince = null;
      if (e.isRateLimited && Object.keys(useItemsStore().ranges).length > 0) {
        rateLimited.value = true;
        return;
      }
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

  /** What every sync does after the device store has taken in the server's changes: re-read what is shown from it (days outside the window come from the server). */
  function builtinTasks(): [string, () => Promise<unknown>][] {
    const items = useItemsStore();
    return [
      ['items', () => items.refreshVisible()],
      ['summary', () => items.refreshSummaries()],
    ];
  }

  /** Runs every refresher once; resolves to whether all of them succeeded. */
  async function run(withConfig: boolean): Promise<boolean> {
    running.value = true;
    if (state.value !== 'error') state.value = 'syncing';
    const clock = useClockStore();
    if (withConfig) {
      await clock.load().catch(() => undefined);
      void checkVersion(clock.config.version, clock.config.apk);
    }
    // what was changed without a connection goes first, so the sync below reads it back from the server
    await useOutboxStore().flush(false);
    // the device store comes first: everything else reads what it took in (the version check runs beside it, it never fails)
    const device = await Promise.allSettled([useDeviceStore().sync(), withConfig ? undefined : checkServerVersion()]).then((r) => r.slice(0, 1));
    const list: [string, () => Promise<unknown>][] = [['device', () => Promise.resolve()], ...builtinTasks(), ...tasks.entries()];
    const results = [...device, ...await Promise.allSettled(list.slice(1).map(([, fn]) => fn()))];
    const failedAt = results.findIndex((r) => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.isAbort));
    const failed = failedAt >= 0 ? (results[failedAt] as PromiseRejectedResult) : undefined;
    if (failed) {
      logFailure(failed.reason, list[failedAt]![0]);
      if (failed.reason instanceof ApiError && failed.reason.isUnavailable) reportError(failed.reason, list[failedAt]![0], true);
      if (!error.value) state.value = 'idle';
      else state.value = 'error';
    } else {
      rateLimited.value = false;
      serverDownSince = null;
      hasSynced = true;
      error.value = null;
      state.value = 'idle';
      lastSync.value = new Date().toISOString();
      lastOk.value = { wall: Date.now(), app: clock.nowMs() };
      pushWidget();
      if (pending) {
        const p = pending;
        pending = null;
        sendBeacon({ ...p.beacon, ageSec: Math.round((Date.now() - p.at) / 1000) }, false);
      }
    }
    running.value = false;
    return !failed;
  }

  /**
   * Run a sync now (coalesces concurrent calls; a call during a run schedules exactly one follow-up, unless that run fails).
   * The one entry point of every trigger; only focus, visibility, `online` and retry re-read the config (the app start has just read it).
   */
  function syncNow(reason: SyncReason = 'poll'): Promise<void> {
    const withConfig = reason === 'focus' || reason === 'visible' || reason === 'online' || reason === 'retry';
    if (current) {
      again = true;
      return current;
    }
    current = (async () => {
      try {
        do {
          again = false;
          const ok = await run(withConfig);
          if (!ok) again = false; // a failed sync is retried by the poll timer, never at once
          if (typeof document !== 'undefined' && document.hidden) again = false; // no follow-up fetch while hidden
        } while (again);
      } finally {
        current = null;
      }
    })();
    return current;
  }

  /**
   * After a write whose effect reaches beyond the item it answered (a series, a category, a conflict): the device takes in
   * the server's state and the views read it again. Reading the device alone would show the stale copy.
   */
  function resyncAfterWrite(): Promise<void> {
    return syncNow('changed').catch(() => undefined);
  }

  ports.resync = () => { void resyncAfterWrite(); };

  /** A fetch outside `run` (initial page load) succeeded: counts as a completed sync. */
  function markSynced(): void {
    if (state.value === 'error') return;
    lastSync.value = new Date().toISOString();
    lastOk.value = { wall: Date.now(), app: useClockStore().nowMs() };
  }

  function retry(): Promise<void> {
    return syncNow('retry');
  }

  /** A sync started by focus or visibility: skipped (the poll timer stays) during the quiet period after a failure. */
  function syncAuto(reason: SyncReason): void {
    if (Date.now() < quietUntil) {
      schedule();
      return;
    }
    void syncNow(reason).then(schedule);
  }

  function schedule(): void {
    pollTimer?.();
    pollTimer = null;
    if (!started || (typeof document !== 'undefined' && document.hidden)) return;
    const configured = useClockStore().pollIntervalMs;
    if (!configured || configured <= 0) return;
    const ms = liveUp && configured >= NORMAL_POLL_MS ? Math.max(configured, LIVE_POLL_MS) : configured;
    pollTimer = appTimeout(async () => {
      pollTimer = null;
      if (document.hidden) return;
      if (Date.now() >= quietUntil) await syncNow();
      schedule();
    }, quietUntil > Date.now() ? quietUntil - Date.now() + 50 : ms);
  }

  function onVisible(): void {
    if (document.hidden) {
      pollTimer?.();
      pollTimer = null;
      return;
    }
    visibleAt = Date.now();
    syncAuto('visible');
  }
  function onFocus(): void {
    focusTimer?.();
    focusTimer = appTimeout(() => {
      focusTimer = null;
      if (document.hidden) return;
      syncAuto('focus');
    }, FOCUS_DEBOUNCE_MS);
  }

  /** Start listeners and the polling timer. Idempotent. */
  function start(): void {
    if (started) return;
    started = true;
    bag.add(listen(document, 'visibilitychange', onVisible));
    bag.add(listen(window, 'focus', onFocus));
    // the network coming back is news, so it is not held back by the quiet period
    bag.add(listen(window, 'online', () => { void syncNow('online').then(schedule); }));
    // a nudge or a reconnect is news, so it is not held back by the quiet period either
    bag.add(startLiveSync({
      changed: () => { if (!document.hidden) void syncNow('changed').then(schedule); },
      connected: (up) => {
        // tests wait for the stream before they change something elsewhere
        document.documentElement.dataset.liveConnected = String(up);
        if (up !== liveUp) { liveUp = up; schedule(); }
      },
    }));
    schedule();
  }
  /** Stop everything (timers and listeners). */
  function stop(): void {
    started = false;
    liveUp = false;
    pollTimer?.();
    pollTimer = null;
    focusTimer?.();
    focusTimer = null;
    bag.dispose();
  }

  return { state, lastSync, lastOk, error, rateLimited, errorMessage, running, registerTask, reportError, clearError, markSynced, syncNow, resyncAfterWrite, retry, start, stop, schedule };
});
