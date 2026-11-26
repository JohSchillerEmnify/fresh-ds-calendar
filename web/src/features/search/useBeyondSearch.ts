/** The search beyond the device (feature item-search): starts by itself at the end of the device results, and offline only says so. */
import { ref, shallowRef, type Ref } from 'vue';
import { ApiError } from '@/api/client';
import type { CalendarEvent, LocalDate } from '@/api/types';
import { logUndone } from '@/lib/decisionLog';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useItemSearchStore } from '@/stores/itemSearch';

/** How long a query rests before Google is asked (typing in between asks nothing). */
const BEYOND_WAIT_MS = 400;
/** After a failed ask the next scroll to the end does not ask again before this has passed. */
export const RETRY_AFTER_MS = 3_000;
/** The longest query the server accepts. */
export const MAX_QUERY = 100;

/** What the line under the device results says: `idle` = not asked yet, `more` = a full page came and more follow on the next scroll to the end. */
export type BeyondState = 'idle' | 'loading' | 'done' | 'more' | 'limited' | 'offline';

export const eventKey = (e: CalendarEvent): string => `e:${e.calendarId}\n${e.id}`;

/** `enabled`: false while the device copy does not exist yet (what it holds is unknown, so the server cannot be told what to leave out). */
export function useBeyondSearch(query: Ref<string>, reach: Ref<{ from: LocalDate; to: LocalDate }>, today: Ref<LocalDate>, enabled: Ref<boolean>) {
  const store = useItemSearchStore();
  const events = shallowRef<CalendarEvent[]>([]);
  const state = ref<BeyondState>('idle');
  /** Finished asks of Google (also failed ones) since the sheet opened: what a test waits on. */
  const loads = ref(0);
  let ctrl: AbortController | null = null;
  let wait: Disposer | null = null;
  let cursor: string | undefined;
  let epoch = 0;
  let failedAt = -Infinity;

  /** Drops what the old query found beyond the device. */
  function reset(): void {
    stop();
    cursor = undefined;
    failedAt = -Infinity;
    events.value = [];
    state.value = 'idle';
  }

  function stop(): void {
    epoch++;
    ctrl?.abort();
    ctrl = null;
    wait?.();
    wait = null;
  }

  async function ask(mine: number): Promise<void> {
    ctrl = new AbortController();
    try {
      const r = await store.beyond(query.value.trim(), reach.value, today.value, cursor, ctrl.signal);
      if (mine !== epoch) return;
      const seen = new Set(events.value.map(eventKey));
      events.value = [...events.value, ...r.items.filter((e) => !seen.has(eventKey(e)))];
      cursor = r.nextCursor;
      state.value = cursor ? 'more' : 'done';
      loads.value++;
    } catch (e) {
      if (mine !== epoch) return;
      loads.value++;
      failedAt = performance.now();
      state.value = e instanceof ApiError && e.code === 'NETWORK' ? 'offline' : 'limited';
      if (state.value === 'limited') logUndone('item search beyond the device', e);
    }
  }

  /** The end of the device results was reached: goes on over all dates, offline only says so. */
  function reachedEnd(): void {
    const q = query.value.trim();
    if (!q || q.length > MAX_QUERY || !enabled.value || state.value === 'loading' || state.value === 'done') return;
    if ((state.value === 'limited' || state.value === 'offline') && performance.now() - failedAt < RETRY_AFTER_MS) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { state.value = 'offline'; return; }
    const first = state.value === 'idle';
    state.value = 'loading';
    const mine = epoch;
    // typing goes on: the first ask rests a moment; the next pages follow a scroll and need no rest
    if (first) wait = appTimeout(() => { wait = null; void ask(mine); }, BEYOND_WAIT_MS);
    else void ask(mine);
  }

  return { events, state, loads, reset, reachedEnd, stop };
}
