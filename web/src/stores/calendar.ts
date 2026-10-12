import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchRange, nextFocus, periodTitle, type ViewKind } from '@/lib/dates';
import { useClockStore } from './clock';
import { useItemsStore } from './items';
import { useSyncStore } from './sync';

/** Current period (from the route), focus date and visible-range loading. */
export const useCalendarStore = defineStore('calendar', () => {
  const view = ref<ViewKind>('month');
  const anchor = ref<Date>(new Date());
  const focus = ref<Date | null>(null);

  const title = computed(() => periodTitle(view.value, anchor.value));
  const focusDate = computed(() => focus.value ?? anchor.value);

  /** Called by the router after every calendar navigation. */
  function setFromRoute(v: ViewKind, d: Date): void {
    view.value = v;
    anchor.value = d;
    focus.value = nextFocus(v, d, focus.value, useClockStore().todayDate);
    if (v === 'year') return; // the year view loads /api/summary itself
    const [from, to] = fetchRange(v, d);
    const sync = useSyncStore();
    useItemsStore().setVisible(from, to).then(
      () => { if (sync.error) sync.clearError(); sync.markSynced(); },
      (e) => sync.reportError(e),
    );
  }

  function setFocus(d: Date): void {
    focus.value = d;
  }

  return { view, anchor, focus, focusDate, title, setFromRoute, setFocus };
});
