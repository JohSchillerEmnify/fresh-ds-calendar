import { defineStore } from 'pinia';
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api/client';
import type { TaskList } from '@/api/types';
import { CARRY_OVER_DAYS, isCarriedOver } from '@/lib/items';
import { differenceInCalendarDays, parseIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { firstOpenItem, isComplete } from './format';

/** Tray order (API.md): date ascending, untimed before timed, then time, then title. */
export function compareOpen(a: TaskList, b: TaskList): number {
  return (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title);
}

/**
 * Open task lists for the tray and the carry-over. `GET /api/tasklists/open` is the source for lists outside the
 * visible range; lists already in the items store (always fresher after ticks) override it. Refreshed by the sync store.
 */
export const useTaskListsStore = defineStore('tasklists', () => {
  const clock = useClockStore();
  const items = useItemsStore();
  const fromApi = shallowRef<TaskList[]>([]);
  const finishedFromApi = shallowRef<TaskList[]>([]);
  /** Lists finished in this tab today, shown as finished before the server's `completedOn` arrives (no flicker). */
  const finishedHere = reactive(new Set<string>());
  const loaded = ref(false);

  async function refresh(): Promise<void> {
    const res = await api.openTaskLists(clock.today, CARRY_OVER_DAYS);
    const alive = (l: TaskList) => !items.isDeleted(l.id); // a response in flight during a delete still lists it
    fromApi.value = res.items.filter(alive);
    finishedFromApi.value = (res.finishedToday ?? []).filter(alive);
    items.setCarried(fromApi.value);
    loaded.value = true;
  }
  /** Called after a tick that leaves no open item in the list. */
  function markFinished(id: string): void {
    finishedHere.add(id);
  }

  const inWindow = (l: TaskList): boolean => {
    const a = l.date ? parseIsoDate(l.date) : null, b = clock.todayDate;
    if (!a || !l.date || l.date > clock.today) return false;
    return differenceInCalendarDays(b, a) <= CARRY_OVER_DAYS;
  };
  /** Every known list in the tray window: API results, overridden by the (fresher) items store. */
  const known = computed<TaskList[]>(() => {
    const map = new Map<string, TaskList>();
    for (const l of [...fromApi.value, ...finishedFromApi.value]) map.set(l.id, l);
    for (const it of Object.values(items.byId)) if (it.kind === 'tasklist') map.set(it.id, it);
    // `isDeleted` also covers lists hidden by a pending delete (byId changes with it, so this recomputes).
    return [...map.values()].filter((l) => !items.isDeleted(l.id) && inWindow(l)).sort(compareOpen);
  });
  /** Open lists dated within the last 30 days up to today, in tray order. */
  const tray = computed<TaskList[]>(() => known.value.filter((l) => l.totalCount > l.doneCount));
  /** Lists finished today (API.md `finishedToday`), shown struck through after the open ones. */
  const finished = computed<TaskList[]>(() => known.value.filter((l) => isComplete(l) && (l.completedOn === clock.today || finishedHere.has(l.id))));
  watch(() => clock.today, () => finishedHere.clear());
  const count = computed(() => tray.value.length);
  /** Next small task: first unticked item of the oldest open list in tray order (Now card, expanded helper). */
  const nextTask = computed(() => {
    for (const l of tray.value) {
      const item = firstOpenItem(l);
      if (item) return { item, list: l };
    }
    return null;
  });
  const isCarried = (l: TaskList) => isCarriedOver(l, clock.today);

  return { tray, finished, count, nextTask, loaded, refresh, isCarried, markFinished };
});
