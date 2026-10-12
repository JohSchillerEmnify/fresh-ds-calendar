import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { Prefs, SupportCatSetting } from '@/api/types';

/** Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views, approach bar) and the support cat. */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(false);
  const supportCat = ref<SupportCatSetting>('sometimes');

  async function load(): Promise<void> {
    try {
      const p = await api.prefs();
      labs.value = p.labs;
      approachBar.value = p.approachBar;
      if (p.supportCat) supportCat.value = p.supportCat;
    } catch { /* offline or signed out: switches stay at their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = { labs: labs.value, approachBar: approachBar.value, supportCat: supportCat.value };
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    supportCat.value = p.supportCat ?? supportCat.value;
    try {
      await api.patchPrefs(p);
    } catch (e) {
      labs.value = before.labs;
      approachBar.value = before.approachBar;
      supportCat.value = before.supportCat;
      throw e;
    }
  }

  return { labs, approachBar, supportCat, load, set };
});
