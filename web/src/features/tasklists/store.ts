import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { api } from '@/api/client';
import type { TaskList } from '@/api/types';
import { CARRY_OVER_DAYS, isCarriedOver } from '@/lib/items';
import { differenceInCalendarDays, parseIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { firstOpenItem } from './format';

/** Tray order (API.md): date ascending, untimed before timed, then time, then title. */
export function compareOpen(a: TaskList, b: TaskList): number {
  return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title);
}

/**
 * Open task lists for the tray and the carry-over. `GET /api/tasklists/open` is the source for lists outside the
 * visible range; lists already in the items store (always fresher after ticks) override it. Refreshed by the sync store.
 */
export const useTaskListsStore = defineStore('tasklists', () => {
  const clock = useClockStore();
  const items = useItemsStore();
  const fromApi = shallowRef<TaskList[]>([]);
  const dropped = new Set<string>();
  const loaded = ref(false);

  async function refresh(): Promise<void> {
    const res = await api.openTaskLists(clock.today, CARRY_OVER_DAYS);
    dropped.clear();
    fromApi.value = res.items;
    items.setCarried(res.items);
    loaded.value = true;
  }
  function drop(id: string): void {
    dropped.add(id);
    fromApi.value = fromApi.value.filter((l) => l.id !== id);
  }

  const inWindow = (l: TaskList): boolean => {
    const a = parseIsoDate(l.date), b = clock.todayDate;
    if (!a || l.date > clock.today) return false;
    return differenceInCalendarDays(b, a) <= CARRY_OVER_DAYS;
  };
  /** Open lists dated within the last 30 days up to today, in tray order. */
  const tray = computed<TaskList[]>(() => {
    const map = new Map<string, TaskList>();
    for (const l of fromApi.value) map.set(l.id, l);
    for (const it of Object.values(items.byId)) if (it.kind === 'tasklist') map.set(it.id, it);
    return [...map.values()]
      .filter((l) => !dropped.has(l.id) && l.totalCount > l.doneCount && inWindow(l))
      .sort(compareOpen);
  });
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

  return { tray, count, nextTask, loaded, refresh, drop, isCarried };
});
