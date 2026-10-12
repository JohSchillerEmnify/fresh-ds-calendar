import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { Prefs } from '@/api/types';

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views, approach bar) and "Show tasks
 * calendar in Google".
 */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(false);
  const tasksCalendarVisible = ref(false);

  async function load(): Promise<void> {
    try {
      const p = await api.prefs();
      labs.value = p.labs;
      approachBar.value = p.approachBar;
      tasksCalendarVisible.value = p.tasksCalendarVisible ?? false;
    } catch { /* offline or signed out: switches stay off */ }
  }

  /** Optimistic switch change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = { labs: labs.value, approachBar: approachBar.value, tasksCalendarVisible: tasksCalendarVisible.value };
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    tasksCalendarVisible.value = p.tasksCalendarVisible ?? tasksCalendarVisible.value;
    try {
      await api.patchPrefs(p);
    } catch (e) {
      labs.value = before.labs;
      approachBar.value = before.approachBar;
      tasksCalendarVisible.value = before.tasksCalendarVisible;
      throw e;
    }
  }

  return { labs, approachBar, tasksCalendarVisible, load, set };
});
