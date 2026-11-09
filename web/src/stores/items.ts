import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api, ApiError } from '@/api/client';
import type {
  CalendarItem, DaySummary, LocalDate, TaskItem, TaskList,
} from '@/api/types';
import { covers, itemsIn, summaryOf } from '@/lib/deviceData';
import { ports } from '@/lib/outboxPorts';
import { logUndone } from '@/lib/decisionLog';
import { toIsoDate } from '@/lib/dates';
import { itemSegments, segmentsByDate, type Segment } from '@/lib/items';
import { addDays } from 'date-fns';
import { useClockStore } from './clock';
import { useDeviceStore } from './device';
import { useSyncStore } from './sync';

const MAX_RANGES = 6;
const rangeKey = (from: string, to: string) => `${from}_${to}`;

interface RangeEntry {
  from: LocalDate;
  to: LocalDate;
  ids: string[];
  syncedAt: string;
}

/**
 * Range cache with normalized items (events and task lists share one id-keyed map, as ids are unique).
 * - `setVisible(from, to)` fetches the range the router needs; LRU of 6 ranges, unreferenced items are dropped.
 *   With `withToday`, today is fetched (and refreshed) in the same request (`also`) when outside `[from, to)` (Now card)
 *   and cached as its own range.
 * - A refresh replaces the range; items with a pending mutation keep their optimistic state.
 * - Writes of events, task lists and their items go through the outbox (`stores/outbox.ts`), which shows them at once.
 */
export const useItemsStore = defineStore('items', () => {
  const byId = shallowRef<Record<string, CalendarItem>>({});
  const ranges = shallowRef<Record<string, RangeEntry>>({});
  const lru = ref<string[]>([]);
  const visible = ref<{ from: LocalDate; to: LocalDate; withToday?: boolean } | null>(null);
  const pending = new Set<string>();
  /** Open task lists outside the visible ranges that are carried over to today (kept by gc). */
  const carriedIds = new Set<string>();
  /** Task lists the Tasks view lists (undated ones are in no range): kept by gc. */
  const keptIds = new Set<string>();
  /**
   * Ids deleted in this session or hidden while their delete waits for the undo time (`pendingDeletes` store):
   * no response may (re-)add them. Holds task list item ids too; those are stripped from their list.
   */
  const deleted = new Set<string>();
  /** First week id -> series id of the repeating lists created in this session: deleting one of them deletes the series. */
  const createdSeries = new Map<string, string>();
  const loading = ref(false);
  let ctrl: AbortController | null = null;

  const all = computed<CalendarItem[]>(() => Object.values(byId.value));
  /** Segments per day over every cached item. Views read this (after filtering via `useDaySegments`). */
  const segmentsOf = (items: Iterable<CalendarItem>): Map<LocalDate, Segment[]> => segmentsByDate(items, useClockStore().today);
  /** An unchanged item (same object, same today) keeps its segments, so the views' entries for it keep their props and do not re-render. */
  const segCache = new WeakMap<CalendarItem, { today: LocalDate | undefined; segs: Segment[] }>();
  function cachedSegments(it: CalendarItem, today?: LocalDate): Segment[] {
    const hit = segCache.get(it);
    if (hit && hit.today === today) return hit.segs;
    const segs = itemSegments(it, today);
    segCache.set(it, { today, segs });
    return segs;
  }
  const byDate = computed(() => segmentsByDate(all.value, useClockStore().today, cachedSegments));
  const get = (id: string) => byId.value[id];
  const isDeleted = (id: string) => deleted.has(id);
  /** The item without its deleted/hidden task list items (counts follow). */
  function strip<T extends CalendarItem>(it: T): T {
    if (it.kind !== 'tasklist' || !it.items.some((i) => deleted.has(i.id))) return it;
    const rest = it.items.filter((i) => !deleted.has(i.id));
    return { ...it, items: rest, doneCount: rest.filter((i) => i.done).length, totalCount: rest.length };
  }

  function touch(key: string) {
    lru.value = [key, ...lru.value.filter((k) => k !== key)];
  }
  function gc() {
    while (lru.value.length > MAX_RANGES) {
      const drop = lru.value.pop()!;
      const r = { ...ranges.value };
      delete r[drop];
      ranges.value = r;
    }
    const keep = new Set<string>();
    for (const r of Object.values(ranges.value)) r.ids.forEach((i) => keep.add(i));
    const next: Record<string, CalendarItem> = {};
    for (const [id, it] of Object.entries(byId.value)) if (keep.has(id) || pending.has(id) || carriedIds.has(id) || keptIds.has(id)) next[id] = it;
    byId.value = next;
  }

  /** Replace one range with a server response. */
  function applyResponse(from: LocalDate, to: LocalDate, items: CalendarItem[], syncedAt: string) {
    const next = { ...byId.value };
    const key = rangeKey(from, to);
    for (const it of items) {
      if (deleted.has(it.id)) continue; // stale response from before the delete
      if (pending.has(it.id)) continue; // keep optimistic state (also optimistic deletes)
      // an unchanged item keeps its object (and so its segments): a poll that changes nothing re-renders none of the entries
      const fresh = strip(it), cur = next[it.id];
      next[it.id] = cur && JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh;
    }
    byId.value = next;
    ranges.value = { ...ranges.value, [key]: { from, to, ids: items.filter((i) => !deleted.has(i.id)).map((i) => i.id), syncedAt } };
    touch(key);
    gc();
  }

  /** The held items of `[from, to)` become that cached range. */
  function applyHeld(from: LocalDate, to: LocalDate): void {
    const device = useDeviceStore();
    applyResponse(from, to, itemsIn(device.data!, from, to), new Date(device.syncedAt ?? useClockStore().nowMs()).toISOString());
  }
  /** Whether the device store holds all of `[from, to)`: then it answers and the server is not asked. */
  const heldInFull = (from: LocalDate, to: LocalDate): boolean => {
    const device = useDeviceStore();
    return device.ready && covers(device.data!, from, to);
  };

  /** Loads `[from, to)`: from the device store when it holds the range, else from the server (days outside the window, not kept; before the first sync). */
  async function fetchRange(from: LocalDate, to: LocalDate, signal?: AbortSignal): Promise<boolean> {
    if (heldInFull(from, to)) {
      applyHeld(from, to);
      return false;
    }
    try {
      const res = await api.items(from, to, undefined, { signal });
      applyResponse(from, to, res.items, res.syncedAt);
    } catch (e) {
      // without the server the part the device holds still shows
      if (useDeviceStore().ready) applyHeld(from, to);
      throw e;
    }
    return true;
  }

  /** One request for `[from, to)` plus the `also` range; the merged response is split back into both cached ranges. */
  async function fetchWithAlso(from: LocalDate, to: LocalDate, also: { from: LocalDate; to: LocalDate }, signal?: AbortSignal): Promise<boolean> {
    if (heldInFull(from, to) && heldInFull(also.from, also.to)) {
      applyHeld(also.from, also.to);
      applyHeld(from, to);
      return false;
    }
    const res = await api.items(from, to, undefined, { signal }, also);
    const extra: RangeEntry = { ...also, ids: [], syncedAt: res.syncedAt };
    const inAlso = res.items.filter((it) => overlaps(it, extra));
    // an item not placed in `also` stays with the main range, so a boundary mismatch never loses it to gc
    const inMain = res.items.filter((it) => overlaps(it, { from, to, ids: [], syncedAt: '' }) || !inAlso.includes(it));
    applyResponse(also.from, also.to, inAlso, res.syncedAt);
    applyResponse(from, to, inMain, res.syncedAt);
    return true;
  }

  const prefetching = new Set<string>();
  /** When a background load of a range last failed: it is not retried before `PREFETCH_RETRY_MS` (watchers re-ask on every change). */
  const prefetchFailed = new Map<string, number>();
  const PREFETCH_RETRY_MS = 30_000;
  /** Load `[from, to)` into the cache in the background unless it is cached, already loading or failed a moment ago (swipe neighbour). Errors are ignored: the route change reports its own. */
  function prefetch(from: LocalDate, to: LocalDate): void {
    const key = rangeKey(from, to);
    if (ranges.value[key] || prefetching.has(key)) return;
    if (Date.now() - (prefetchFailed.get(key) ?? -Infinity) < PREFETCH_RETRY_MS) return;
    prefetching.add(key);
    fetchRange(from, to).then(() => prefetchFailed.delete(key), () => prefetchFailed.set(key, Date.now())).finally(() => prefetching.delete(key));
  }

  /** Make `[from, to)` the visible range and load it (aborting a superseded load). Errors are reported to the sync store. */
  async function setVisible(from: LocalDate, to: LocalDate, withToday = false): Promise<boolean> {
    visible.value = { from, to, withToday };
    return refreshVisible();
  }

  /** Resolves to whether the server answered (false: the device store did, which says nothing about the connection). */
  async function refreshVisible(): Promise<boolean> {
    const v = visible.value;
    if (!v) return false;
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    loading.value = true;
    try {
      const clock = useClockStore();
      const today = clock.today;
      const server = v.withToday && (today < v.from || today >= v.to)
        ? await fetchWithAlso(v.from, v.to, { from: today, to: toIsoDate(addDays(clock.todayDate, 1)) }, mine.signal)
        : await fetchRange(v.from, v.to, mine.signal);
      if (server) useSyncStore().markSynced();
      return server;
    } catch (e) {
      if (e instanceof ApiError && e.isAbort) return false;
      throw e;
    } finally {
      if (ctrl === mine) {
        loading.value = false;
        ctrl = null;
      }
    }
  }

  // --- mutations ------------------------------------------------------------------
  function overlaps(it: CalendarItem, r: RangeEntry): boolean {
    return itemSegments(it).some((s) => s.date >= r.from && s.date < r.to);
  }
  /** Shows `item` in the cache and the ranges it falls into, without touching the device store. */
  function place(item: CalendarItem): void {
    if (deleted.has(item.id)) return; // e.g. a task list op finishing while its list waits for its delete
    const it = strip(item);
    // an undated list is in no range, so nothing else would keep it in the cache
    if (it.kind === 'tasklist' && it.date === null) keptIds.add(it.id);
    byId.value = { ...byId.value, [it.id]: it };
    const next = { ...ranges.value };
    for (const [k, r] of Object.entries(next)) {
      const has = r.ids.includes(it.id);
      const should = overlaps(it, r);
      if (should && !has) next[k] = { ...r, ids: [...r.ids, it.id] };
      else if (!should && has) next[k] = { ...r, ids: r.ids.filter((i) => i !== it.id) };
    }
    ranges.value = next;
  }
  /** A saved item (the server's answer): shown, and kept in the device store at once. */
  function upsert(item: CalendarItem): void {
    place(item);
    if (!deleted.has(item.id)) useDeviceStore().put(item);
  }
  /** Mark an id as having local, unconfirmed changes: polls will not overwrite it. Balanced by `endPending`. */
  function beginPending(id: string): void { pending.add(id); }
  function endPending(id: string): void { pending.delete(id); }
  /** Keep these open task lists (carried over to today) in the cache even when no range holds them. */
  function setCarried(lists: TaskList[]): void {
    carriedIds.clear();
    const next = { ...byId.value };
    for (const l of lists) {
      carriedIds.add(l.id);
      if (!pending.has(l.id) && !deleted.has(l.id)) next[l.id] = strip(l);
    }
    byId.value = next;
    gc();
  }
  /** Keep exactly these task lists (the Tasks view's) in the cache, even when no range holds them. */
  function setKept(lists: TaskList[]): void {
    keptIds.clear();
    const next = { ...byId.value };
    for (const l of lists) {
      keptIds.add(l.id);
      if (!pending.has(l.id) && !deleted.has(l.id)) next[l.id] = strip(l);
    }
    byId.value = next;
    gc();
  }
  function remove(id: string): void {
    carriedIds.delete(id);
    keptIds.delete(id);
    const { [id]: _gone, ...rest } = byId.value;
    byId.value = rest;
    const next = { ...ranges.value };
    for (const [k, r] of Object.entries(next)) if (r.ids.includes(id)) next[k] = { ...r, ids: r.ids.filter((i) => i !== id) };
    ranges.value = next;
  }

  /** Hide an event or task list until `unhide` (deferred delete). Keeps a carried-over list carried for an undo. */
  function hide(id: string): void {
    const carried = carriedIds.has(id), kept = keptIds.has(id);
    deleted.add(id);
    remove(id);
    if (carried) carriedIds.add(id);
    if (kept) keptIds.add(id);
  }
  /** Undo `hide`: show `it` (the item as it was when hidden) again. */
  function unhide(it: CalendarItem): void {
    deleted.delete(it.id);
    place(it);
  }
  /** Hide one task list item until `unhideTaskItem`. */
  function hideTaskItem(listId: string, itemId: string): void {
    deleted.add(itemId);
    const tl = byId.value[listId];
    if (tl) byId.value = { ...byId.value, [listId]: strip(tl) };
  }
  /** Undo `hideTaskItem`: put `item` back at `index` (unless a fresher list already has it). */
  function unhideTaskItem(listId: string, item: TaskItem, index: number): void {
    deleted.delete(item.id);
    const tl = byId.value[listId];
    if (!tl || tl.kind !== 'tasklist' || tl.items.some((i) => i.id === item.id)) return;
    const list = [...tl.items];
    list.splice(Math.min(index, list.length), 0, item);
    byId.value = { ...byId.value, [listId]: { ...tl, items: list, doneCount: list.filter((i) => i.done).length, totalCount: list.length } };
  }

  /** Reports unavailability to the sync banner, then rethrows so dialogs can show `error.userMessage`. */
  function report(e: unknown): never {
    if (e instanceof ApiError && e.isUnavailable) useSyncStore().reportError(e);
    throw e;
  }

  /** A repeating list the outbox created: deleting it deletes the series. */
  const noteSeries = (firstId: string, seriesId: string): void => { createdSeries.set(firstId, seriesId); };
  const seriesOf = (id: string): string | undefined => createdSeries.get(id);
  const forgetSeries = (id: string): void => { createdSeries.delete(id); };

  /**
   * Optimistic replacement of an item that is not kept in the outbox (a birthday, whose series the server patches): shows `next`,
   * calls the API, swaps in the response. On failure the previous item is restored and the error is reported/rethrown.
   */
  async function optimisticItem<T extends CalendarItem>(id: string, next: CalendarItem | null, call: () => Promise<T | void>): Promise<T | undefined> {
    const before = byId.value[id];
    pending.add(id);
    if (next) place(next);
    else remove(id);
    try {
      const fresh = await call();
      pending.delete(id);
      if (fresh) {
        if (fresh.id !== id) remove(id); // create: the temporary id is replaced by the server id
        upsert(fresh);
      }
      return fresh ?? undefined;
    } catch (e) {
      pending.delete(id);
      logUndone('birthday', e);
      if (before) place(before);
      else remove(id);
      return report(e);
    }
  }

  // --- year view / month picker summaries --------------------------------------------
  const summary = shallowRef<Record<LocalDate, DaySummary>>({});
  const summaryKeys = ref<string[]>([]);
  const summaryByKey = new Map<string, Record<LocalDate, DaySummary>>();

  function mergeSummary() {
    const out: Record<LocalDate, DaySummary> = {};
    for (const k of summaryKeys.value) Object.assign(out, summaryByKey.get(k));
    summary.value = out;
  }
  /** Loads `[from, to)` day counts (cached; at most 14 ranges kept). */
  async function loadSummary(from: LocalDate, to: LocalDate, force = false): Promise<boolean> {
    const key = rangeKey(from, to);
    if (!force && summaryByKey.has(key)) return false;
    // counted on the device when it holds the range, else the server counts (days outside the window)
    const server = !heldInFull(from, to);
    const days = server ? (await api.summary(from, to)).days : summaryOf(useDeviceStore().data!, from, to);
    summaryByKey.set(key, days);
    summaryKeys.value = [key, ...summaryKeys.value.filter((k) => k !== key)];
    while (summaryKeys.value.length > 14) summaryByKey.delete(summaryKeys.value.pop()!);
    mergeSummary();
    return server;
  }
  async function refreshSummaries(): Promise<void> {
    await Promise.all(summaryKeys.value.map((k) => {
      const [f, t] = k.split('_');
      return loadSummary(f, t, true);
    }));
  }

  /**
   * The device store changed (a sync, or the first read after a restart): every task list it holds is kept in the cache
   * (the tray, the Tasks view and the Canvas read them from here), and every cached range the device holds in full is
   * read from it again; the day counts too.
   */
  function refreshFromDevice(): void {
    const device = useDeviceStore();
    if (!device.ready) return;
    const lists = device.data!.taskLists.filter((l) => !deleted.has(l.id) && !pending.has(l.id));
    const next = { ...byId.value };
    keptIds.clear();
    for (const l of lists) { keptIds.add(l.id); next[l.id] = strip(l); }
    byId.value = next;
    for (const r of Object.values(ranges.value)) if (heldInFull(r.from, r.to)) applyHeld(r.from, r.to);
    gc();
    for (const k of summaryKeys.value) {
      const [f, t] = k.split('_');
      if (heldInFull(f, t)) { summaryByKey.set(k, summaryOf(device.data!, f, t)); }
    }
    mergeSummary();
  }
  /** Removes everything shown from the device store (it belongs to another person). */
  function dropDevice(): void {
    byId.value = {};
    ranges.value = {};
    keptIds.clear();
  }

  /** Test / logout helper. */
  function $reset() {
    ctrl?.abort();
    byId.value = {};
    ranges.value = {};
    lru.value = [];
    visible.value = null;
    pending.clear();
    carriedIds.clear();
    keptIds.clear();
    createdSeries.clear();
    prefetchFailed.clear();
    summaryByKey.clear();
    summaryKeys.value = [];
    summary.value = {};
  }

  ports.items = {
    get, all: () => all.value, upsert, remove, hide, unhide, beginPending, endPending, noteSeries, seriesOf, forgetSeries,
  };

  return {
    byId, ranges, visible, loading, all, byDate, segmentsOf, get, summary,
    isDeleted, hide, unhide, hideTaskItem, unhideTaskItem, setVisible, refreshVisible, fetchRange, prefetch, applyResponse, refreshFromDevice, dropDevice, upsert, remove, beginPending, endPending, setCarried, setKept,
    noteSeries, seriesOf, forgetSeries, optimisticItem,
    loadSummary, refreshSummaries, $reset,
  };
});
