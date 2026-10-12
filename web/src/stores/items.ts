import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api, ApiError } from '@/api/client';
import type {
  CalendarEvent, CalendarItem, CreateEventInput, CreateTaskListInput, DaySummary, LocalDate, TaskList,
  UpdateEventInput, UpdateTaskListInput,
} from '@/api/types';
import { itemSegments, segmentsByDate, type Segment } from '@/lib/items';
import { useClockStore } from './clock';
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
 * - A refresh replaces the range; items with a pending mutation keep their optimistic state.
 * - Mutations: events/task list details are not optimistic (`createEvent`...), item ops use `optimistic()`.
 */
export const useItemsStore = defineStore('items', () => {
  const byId = shallowRef<Record<string, CalendarItem>>({});
  const ranges = shallowRef<Record<string, RangeEntry>>({});
  const lru = ref<string[]>([]);
  const visible = ref<{ from: LocalDate; to: LocalDate } | null>(null);
  const pending = new Set<string>();
  /** Open task lists outside the visible ranges that are carried over to today (kept by gc). */
  const carriedIds = new Set<string>();
  /** Ids deleted in this session: a response that was already in flight when the delete landed must not re-add them. */
  const deleted = new Set<string>();
  const loading = ref(false);
  let ctrl: AbortController | null = null;

  const all = computed<CalendarItem[]>(() => Object.values(byId.value));
  /** Segments per day over every cached item. Views read this (after filtering via `useDaySegments`). */
  const segmentsOf = (items: Iterable<CalendarItem>): Map<LocalDate, Segment[]> => segmentsByDate(items, useClockStore().today);
  const byDate = computed(() => segmentsByDate(all.value, useClockStore().today));
  const tagsInUse = computed(() => {
    const set = new Set<string>();
    for (const i of all.value) if (i.kind === 'tasklist') i.tags.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b));
  });
  const get = (id: string) => byId.value[id];
  const isDeleted = (id: string) => deleted.has(id);

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
    for (const [id, it] of Object.entries(byId.value)) if (keep.has(id) || pending.has(id) || carriedIds.has(id)) next[id] = it;
    byId.value = next;
  }

  /** Replace one range with a server response. */
  function applyResponse(from: LocalDate, to: LocalDate, items: CalendarItem[], syncedAt: string) {
    const next = { ...byId.value };
    const key = rangeKey(from, to);
    for (const it of items) {
      if (deleted.has(it.id)) continue; // stale response from before the delete
      if (pending.has(it.id)) continue; // keep optimistic state (also optimistic deletes)
      next[it.id] = it;
    }
    byId.value = next;
    ranges.value = { ...ranges.value, [key]: { from, to, ids: items.filter((i) => !deleted.has(i.id)).map((i) => i.id), syncedAt } };
    touch(key);
    gc();
  }

  async function fetchRange(from: LocalDate, to: LocalDate, signal?: AbortSignal): Promise<void> {
    const res = await api.items(from, to, undefined, { signal });
    applyResponse(from, to, res.items, res.syncedAt);
  }

  /** Make `[from, to)` the visible range and load it (aborting a superseded load). Errors are reported to the sync store. */
  async function setVisible(from: LocalDate, to: LocalDate): Promise<void> {
    visible.value = { from, to };
    return refreshVisible();
  }

  async function refreshVisible(): Promise<void> {
    const v = visible.value;
    if (!v) return;
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    loading.value = true;
    try {
      await fetchRange(v.from, v.to, mine.signal);
      useSyncStore().markSynced();
    } catch (e) {
      if (e instanceof ApiError && e.isAbort) return;
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
  function upsert(it: CalendarItem): void {
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
  /** Mark an id as having local, unconfirmed changes: polls will not overwrite it. Balanced by `endPending`. */
  function beginPending(id: string): void { pending.add(id); }
  function endPending(id: string): void { pending.delete(id); }
  /** Keep these open task lists (carried over to today) in the cache even when no range holds them. */
  function setCarried(lists: TaskList[]): void {
    carriedIds.clear();
    const next = { ...byId.value };
    for (const l of lists) {
      carriedIds.add(l.id);
      if (!pending.has(l.id)) next[l.id] = l;
    }
    byId.value = next;
    gc();
  }
  function remove(id: string): void {
    carriedIds.delete(id);
    const { [id]: _gone, ...rest } = byId.value;
    byId.value = rest;
    const next = { ...ranges.value };
    for (const [k, r] of Object.entries(next)) if (r.ids.includes(id)) next[k] = { ...r, ids: r.ids.filter((i) => i !== id) };
    ranges.value = next;
  }

  /** Reports unavailability to the sync banner, then rethrows so dialogs can show `error.userMessage`. */
  function report(e: unknown): never {
    if (e instanceof ApiError && e.isUnavailable) useSyncStore().reportError(e);
    throw e;
  }

  async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    try {
      const ev = await api.createEvent(input);
      upsert(ev);
      return ev;
    } catch (e) { return report(e); }
  }
  /** Sends `If-Match: <etag>` from the cached item (or `etag` when given). 412 → ApiError.isConflict. */
  async function updateEvent(id: string, patch: UpdateEventInput, etag?: string): Promise<CalendarEvent> {
    const cur = byId.value[id];
    try {
      const ev = await api.updateEvent(id, patch, { ifMatch: etag ?? cur?.etag });
      upsert(ev);
      return ev;
    } catch (e) { return report(e); }
  }
  async function deleteEvent(id: string, etag?: string): Promise<void> {
    try {
      await api.deleteEvent(id, { ifMatch: etag ?? byId.value[id]?.etag });
      deleted.add(id);
      remove(id);
    } catch (e) { report(e); }
  }
  async function createTaskList(input: CreateTaskListInput): Promise<TaskList> {
    try {
      const tl = await api.createTaskList(input);
      upsert(tl);
      return tl;
    } catch (e) { return report(e); }
  }
  async function updateTaskList(id: string, patch: UpdateTaskListInput, etag?: string): Promise<TaskList> {
    try {
      const tl = await api.updateTaskList(id, patch, { ifMatch: etag ?? byId.value[id]?.etag });
      upsert(tl);
      return tl;
    } catch (e) { return report(e); }
  }
  async function deleteTaskList(id: string, etag?: string): Promise<void> {
    try {
      await api.deleteTaskList(id, { ifMatch: etag ?? byId.value[id]?.etag });
      deleted.add(id);
      remove(id);
    } catch (e) { report(e); }
  }

  /**
   * Optimistic task list item operation: `apply` mutates a copy locally, `call` performs the API request
   * (item ops need no etag). On success the returned TaskList replaces the item; on failure it is rolled back
   * and the error goes to the sync banner. Polls never undo it while in flight.
   */
  async function optimistic(id: string, apply: (tl: TaskList) => TaskList, call: () => Promise<TaskList>): Promise<TaskList | null> {
    const before = byId.value[id] as TaskList | undefined;
    if (!before || before.kind !== 'tasklist') return null;
    pending.add(id);
    byId.value = { ...byId.value, [id]: apply(structuredClone(before)) };
    try {
      const fresh = await call();
      pending.delete(id);
      upsert(fresh);
      return fresh;
    } catch (e) {
      pending.delete(id);
      byId.value = { ...byId.value, [id]: before };
      return report(e);
    }
  }

  /**
   * Optimistic replacement of any item (event move, edit): shows `next` at once, calls the API, swaps in the response.
   * On failure the previous item is restored (a create with no previous item is removed) and the error is reported/rethrown.
   * Polls never undo it while in flight.
   */
  async function optimisticItem<T extends CalendarItem>(id: string, next: CalendarItem | null, call: () => Promise<T | void>): Promise<T | undefined> {
    const before = byId.value[id];
    pending.add(id);
    if (next) upsert(next);
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
      if (before) upsert(before);
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
  async function loadSummary(from: LocalDate, to: LocalDate, force = false): Promise<void> {
    const key = rangeKey(from, to);
    if (!force && summaryByKey.has(key)) return;
    const res = await api.summary(from, to);
    summaryByKey.set(key, res.days);
    summaryKeys.value = [key, ...summaryKeys.value.filter((k) => k !== key)];
    while (summaryKeys.value.length > 14) summaryByKey.delete(summaryKeys.value.pop()!);
    mergeSummary();
  }
  async function refreshSummaries(): Promise<void> {
    await Promise.all(summaryKeys.value.map((k) => {
      const [f, t] = k.split('_');
      return loadSummary(f, t, true);
    }));
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
    summaryByKey.clear();
    summaryKeys.value = [];
    summary.value = {};
  }

  return {
    byId, ranges, visible, loading, all, byDate, segmentsOf, tagsInUse, get, summary,
    isDeleted, setVisible, refreshVisible, fetchRange, applyResponse, upsert, remove, beginPending, endPending, setCarried,
    createEvent, updateEvent, deleteEvent, createTaskList, updateTaskList, deleteTaskList, optimistic, optimisticItem,
    loadSummary, refreshSummaries, $reset,
  };
});
