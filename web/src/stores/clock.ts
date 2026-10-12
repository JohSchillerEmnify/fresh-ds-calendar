import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { AppConfig } from '@/api/types';
import { parseIsoDate } from '@/lib/dates';
import { appTimeout, listen, DisposerBag } from '@/lib/timers';

const FALLBACK: AppConfig = {
  now: '', clockFrozen: false, timeZone: 'Europe/Berlin', weekStartsOn: 1, pollIntervalMs: 30000,
  provider: 'mock', testMode: false, publicUrl: null, version: '',
};

/**
 * App clock and `/api/config` (API.md). Everything that needs "now" or "today" goes through `useClock()`;
 * nothing else calls `new Date()` for that. `now` ticks once per minute (aligned), paused while hidden.
 */
export const useClockStore = defineStore('clock', () => {
  const config = ref<AppConfig>({ ...FALLBACK });
  const loaded = ref(false);
  /** Date.parse(now) - Date.now() at fetch time (running clock). */
  const offsetMs = ref(0);
  const frozenAt = ref<number | null>(null);
  /** Reactive "now" in ms; refreshed by the minute ticker. */
  const nowTick = ref(Date.now());
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
      if (!loaded.value) {
        config.value = { ...FALLBACK };
        frozenAt.value = null;
        offsetMs.value = 0;
      }
    }
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

  function scheduleTick() {
    stopTimer?.();
    const ms = nowMs();
    // exactly on the minute boundary (a timer that fires a hair early is rounded up below)
    const wait = 60000 - (ms % 60000);
    stopTimer = appTimeout(() => {
      const t = nowMs();
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

  return { config, loaded, timeZone, pollIntervalMs, nowTick, today, todayDate, minutesNow, nowMs, load, startTicker, stopTicker };
});

/** Composable alias used across the app (API.md: "one useClock() composable"). */
export const useClock = useClockStore;
