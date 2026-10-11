import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ViewKind } from '@/lib/dates';

/** UI state for the calendar shell. View + anchor date are synced from the route. */
export const useCalendarStore = defineStore('calendar', () => {
  const view = ref<ViewKind>('month');
  const anchor = ref<Date>(new Date());
  const createSheetOpen = ref(false);

  function setFromRoute(v: ViewKind, d: Date) {
    view.value = v;
    anchor.value = d;
  }

  return { view, anchor, createSheetOpen, setFromRoute };
});
