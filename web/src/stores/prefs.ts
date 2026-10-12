import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { ApproachWindowHours, LabsPrefs } from '@/api/types';

/**
 * Per-person preferences: Labs switches (`GET/PATCH /api/prefs`): experimental views, the approach bar and its
 * window length.
 */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(false);
  const approachWindowHours = ref<ApproachWindowHours>(3);

  function apply(p: Partial<LabsPrefs>): void {
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    approachWindowHours.value = p.approachWindowHours ?? approachWindowHours.value;
  }

  async function load(): Promise<void> {
    try {
      apply(await api.prefs());
    } catch { /* offline or signed out: switches stay off */ }
  }

  /** Optimistic switch change; rolls back when the server refuses. */
  async function set(p: Partial<LabsPrefs>): Promise<void> {
    const before = { labs: labs.value, approachBar: approachBar.value, approachWindowHours: approachWindowHours.value };
    apply(p);
    try {
      await api.patchPrefs(p);
    } catch (e) {
      apply(before);
      throw e;
    }
  }

  return { labs, approachBar, approachWindowHours, load, set };
});
