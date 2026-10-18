import { computed, onMounted, watch } from 'vue';
import { api, ApiError } from '@/api/client';
import type { TaskList } from '@/api/types';
import { t } from '@/i18n';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';

/** Options of {@link useTaskList}. */
export interface UseTaskListOptions {
  /** Load the list on mount when the store lacks it (deep link, list outside the loaded range); `onClose` runs if that fails. */
  load?: { seed?: () => TaskList | undefined; onClose: () => void };
  /** Runs when the list vanishes from the store (deleted here or elsewhere). */
  onGone?: () => void;
}

/** The task list `id()` from the items store (null while missing or of another kind), with optional deep-link load and vanish wiring. */
export function useTaskList(id: () => string, opts: UseTaskListOptions = {}) {
  const items = useItemsStore();
  const tl = computed(() => {
    const i = items.get(id());
    return i?.kind === 'tasklist' ? i : null;
  });
  const { load, onGone } = opts;
  if (load) {
    onMounted(async () => {
      if (tl.value) return;
      const seed = load.seed?.();
      if (seed) { items.upsert(seed); return; }
      try {
        items.upsert(await api.getTaskList(id()));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) useUiStore().notify(t('tasks.list.gone'));
        load.onClose();
      }
    });
  }
  if (onGone) watch(tl, (now, before) => { if (before && !now) onGone(); });
  return tl;
}
