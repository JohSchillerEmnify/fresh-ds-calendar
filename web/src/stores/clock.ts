import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { AppConfig } from '@/api/types';
import { parseIsoDate } from '@/lib/dates';
import { appTimeout, listen, DisposerBag } from '@/lib/timers';

/** The config as the app holds it: `provider` is `null` until the server has answered (never assumed to be the mock). */
export type ClientConfig = Omit<AppConfig, 'provider'> & { provider: AppConfig['provider'] | null };

const FALLBACK: ClientConfig = {
  now: '', clockFrozen: false, timeZone: 'Europe/Berlin', weekStartsOn: 1, pollIntervalMs: 30000,
  provider: null, testMode: false, publicUrl: null, version: '', apk: null, plugins: [],
  // no server answer and nothing kept: no place search, the map shows its placeholder
  placeSearchUrl: '', mapTileUrl: '',
};

/**
 * App clock and `/api/config` (API.md). Everything that needs "now" or "today" goes through `useClockStore()`;
 * nothing else calls `new Date()` for that. `now` ticks once per minute (aligned), paused while hidden.
 */
export const useClockStore = defineStore('clock', () => {
  const config = ref<ClientConfig>({ ...FALLBACK });
  const loaded = ref(false);
  /** Date.parse(now) - Date.now() at fetch time (running clock). */
  const offsetMs = ref(0);
  const frozenAt = ref<number | null>(null);
  /** Reactive "now" in ms; refreshed by the minute ticker. */
  const nowTick = ref(Date.now());
  /** The config came from the last known state (feature last-known-state): a failed load keeps it. */
  let restoredConfig = false;
  const bag = new DisposerBag();
  let stopTimer: (() => void) | null = null;

  function nowMs(): number {
    return frozenAt.value ?? Date.now() + offsetMs.value;
  }

  async function load(signal?: AbortSignal): Promise<void> {
    try {
      const c = await api.config({ signal });
      config.value = c;
      frozenAt.value = c.clockFrozen ? Date.parse(c.now) : null;
      offsetMs.value = c.clockFrozen ? 0 : Date.parse(c.now) - Date.now();
      loaded.value = true;
    } catch {
      // offline: device clock, Europe/Berlin, Monday, 30 s polling
      if (!loaded.value && !restoredConfig) {
        config.value = { ...FALLBACK };
        frozenAt.value = null;
        offsetMs.value = 0;
      }
    }
    nowTick.value = nowMs();
  }

  /** Takes the last known config until the server answers: its zone, and a frozen clock's time (test mode). */
  function restore(c: AppConfig): void {
    if (loaded.value) return;
    config.value = { ...c };
    frozenAt.value = c.clockFrozen ? Date.parse(c.now) : null;
    offsetMs.value = 0;
    restoredConfig = true;
    nowTick.value = nowMs();
  }

  const timeZone = computed(() => config.value.timeZone);
  const pollIntervalMs = computed(() => config.value.pollIntervalMs);

  function parts(ms: number): { date: string; minutes: number } {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone.value, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }

  const nowParts = computed(() => parts(nowTick.value));
  /** Today as 'YYYY-MM-DD' in the calendar zone. */
  const today = computed(() => nowParts.value.date);
  /** Today as a local-midnight Date (for date-fns math). */
  const todayDate = computed(() => parseIsoDate(today.value)!);
  /** Minutes since local midnight (calendar zone). */
  const minutesNow = computed(() => nowParts.value.minutes);

  /** Device-clock instants (Date.now ms) at which `nowTick` must refresh before the next minute: they share the one ticker timer. */
  const wakes = new Set<number>();
  /** Ask for a `nowTick` refresh at `ms` (Date.now scale), in addition to the minute ticks; past instants are ignored. */
  function wakeAt(ms: number): void {
    if (ms <= Date.now()) return;
    wakes.add(ms);
    if (stopTimer) scheduleTick();
  }

  function scheduleTick() {
    stopTimer?.();
    const ms = nowMs();
    // exactly on the minute boundary (a timer that fires a hair early is rounded up below), or earlier for a requested wake
    let wait = 60000 - (ms % 60000);
    const dev = Date.now();
    for (const w of wakes) wait = Math.min(wait, Math.max(w - dev, 0));
    stopTimer = appTimeout(() => {
      const t = nowMs();
      const now = Date.now();
      for (const w of wakes) if (w <= now) wakes.delete(w);
      nowTick.value = t % 60000 > 59500 ? t + 500 : t;
      scheduleTick();
    }, wait);
  }

  function startTicker() {
    stopTicker();
    nowTick.value = nowMs();
    if (typeof document !== 'undefined' && !document.hidden) scheduleTick();
    if (typeof document !== 'undefined') {
      bag.add(listen(document, 'visibilitychange', () => {
        if (document.hidden) {
          stopTimer?.();
          stopTimer = null;
        } else {
          nowTick.value = nowMs();
          scheduleTick();
        }
      }));
    }
  }
  function stopTicker() {
    stopTimer?.();
    stopTimer = null;
    bag.dispose();
  }

  return { config, loaded, timeZone, pollIntervalMs, nowTick, today, todayDate, minutesNow, nowMs, wakeAt, load, restore, startTicker, stopTicker };
});

