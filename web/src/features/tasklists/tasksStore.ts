/**
 * Tasks view data (feature tasks-view): the open task lists, undated ones included. The lists live in the items
 * store (so item operations are the existing optimistic ones); this store loads them from `GET /api/tasklists/all-open`,
 * keeps them cached, and derives what the view shows.
 */
import { defineStore } from 'pinia';
import { computed, reactive, ref, shallowRef } from 'vue';
import { api } from '@/api/client';
import type { TaskList } from '@/api/types';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { isFinished } from './archive';
import { isOpen } from './tasksView';

/** The tabs of the Tasks view: the Canvas shows the same open lists as Open (feature tasks-canvas). */
export type TasksTab = 'open' | 'canvas' | 'archive';

export const useTasksViewStore = defineStore('tasksView', () => {
  const clock = useClockStore();
  const items = useItemsStore();
  /** Ids the server listed last time. */
  const served = shallowRef<Set<string>>(new Set());
  /** Lists finished while the view was open: they stay (struck through) until the view is opened again. */
  const finishedHere = reactive(new Set<string>());

  /** The tab the view shows; the refresh loads that tab's lists (feature tasks-archive). */
  const tab = ref<TasksTab>('open');
  /** Ids of the archived lists the server listed last time. */
  const archiveIds = shallowRef<string[]>([]);

  /** Worked out on the device: every task list the device store holds, of any date, undated ones included. */
  function refreshFromDevice(): void {
    items.refreshFromDevice();
    const alive = useDeviceStore().data!.taskLists.filter((l) => !items.isDeleted(l.id));
    if (tab.value === 'archive') archiveIds.value = alive.filter(isFinished).map((l) => l.id);
    else served.value = new Set(alive.filter(isOpen).map((l) => l.id));
  }

  /** Reads the lists of the shown tab; from the server only before the device has had its first sync. */
  async function refresh(): Promise<void> {
    if (useDeviceStore().ready) return refreshFromDevice();
    if (tab.value === 'archive') return refreshArchive();
    const res = await api.allOpenTaskLists(clock.today);
    const alive = res.items.filter((l) => !items.isDeleted(l.id));
    const next = new Set(alive.map((l) => l.id));
    // finished or removed elsewhere: gone from the answer, so gone from the cache (a calendar view refetches what it needs)
    for (const id of served.value) if (!next.has(id) && !finishedHere.has(id)) items.remove(id);
    items.setKept(alive);
    served.value = next;
  }

  async function refreshArchive(): Promise<void> {
    const res = await api.archivedTaskLists(clock.today);
    const alive = res.items.filter((l) => !items.isDeleted(l.id));
    items.setKept(alive);
    archiveIds.value = alive.map((l) => l.id);
  }

  /** Switches the tab and loads its lists; the lists of the other tab leave the cache (the next switch refetches). */
  async function setTab(next: TasksTab): Promise<void> {
    if (tab.value === next) return;
    tab.value = next;
    served.value = new Set();
    await refresh();
  }

  /** Called when the view is opened: forgets lists finished during an earlier visit. */
  function reset(): void {
    finishedHere.clear();
    tab.value = 'open';
    archiveIds.value = [];
  }
  function markFinished(id: string): void {
    finishedHere.add(id);
  }

  /** Every open list in the cache (plus the ones finished here), before filtering, grouping and sorting. */
  const lists = computed<TaskList[]>(() =>
    Object.values(items.byId).filter((i): i is TaskList => i.kind === 'tasklist' && !items.isDeleted(i.id) && (isOpen(i) || finishedHere.has(i.id))));

  /** The archived lists in the cache that are still finished (an unticked one has moved back to Open). */
  const archived = computed<TaskList[]>(() =>
    archiveIds.value.map((id) => items.get(id)).filter((i): i is TaskList => i?.kind === 'tasklist' && !items.isDeleted(i.id) && isFinished(i)));

  return { tab, lists, archived, refresh, reset, markFinished, setTab };
});
