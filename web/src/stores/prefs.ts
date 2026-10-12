import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

/** Per-person preferences: Labs switches (`GET/PATCH /api/prefs`): experimental views and the approach bar. */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(false);

  async function load(): Promise<void> {
    try {
      const p = await api.prefs();
      labs.value = p.labs;
      approachBar.value = p.approachBar;
    } catch { /* offline or signed out: switches stay off */ }
  }

  /** Optimistic switch change; rolls back when the server refuses. */
  async function set(p: { labs?: boolean; approachBar?: boolean }): Promise<void> {
    const before = { labs: labs.value, approachBar: approachBar.value };
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    try {
      await api.patchPrefs(p);
    } catch (e) {
      labs.value = before.labs;
      approachBar.value = before.approachBar;
      throw e;
    }
  }

  return { labs, approachBar, load, set };
});
