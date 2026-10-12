import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { ApproachWindowHours, Prefs, SupportCatSetting } from '@/api/types';

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views, the approach bar and its window
 * length), "Show tasks calendar in Google" and the support cat.
 */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(false);
  const approachWindowHours = ref<ApproachWindowHours>(3);
  const tasksCalendarVisible = ref(false);
  const supportCat = ref<SupportCatSetting>('sometimes');

  function apply(p: Partial<Prefs>): void {
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    approachWindowHours.value = p.approachWindowHours ?? approachWindowHours.value;
    tasksCalendarVisible.value = p.tasksCalendarVisible ?? tasksCalendarVisible.value;
    supportCat.value = p.supportCat ?? supportCat.value;
  }

  async function load(): Promise<void> {
    try {
      apply(await api.prefs());
    } catch { /* offline or signed out: switches stay at their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = {
      labs: labs.value, approachBar: approachBar.value, approachWindowHours: approachWindowHours.value,
      tasksCalendarVisible: tasksCalendarVisible.value, supportCat: supportCat.value,
    };
    apply(p);
    try {
      await api.patchPrefs(p);
    } catch (e) {
      apply(before);
      throw e;
    }
  }

  return { labs, approachBar, approachWindowHours, tasksCalendarVisible, supportCat, load, set };
});
