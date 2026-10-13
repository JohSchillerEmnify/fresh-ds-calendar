import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import { cachedLanguagePref, type LanguagePref } from '@/i18n';
import type { ApproachWindowHours, Prefs, SupportCatSetting } from '@/api/types';

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views), the Approaching card, its
 * approach track and window length (both on by default, like the server), "Show tasks calendar in Google",
 * support cat, and the version label in the corner (off by default).
 */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(true);
  const approachWindowHours = ref<ApproachWindowHours>(3);
  const approachingCard = ref(true);
  const tasksCalendarVisible = ref(false);
  const supportCat = ref<SupportCatSetting>('sometimes');
  const versionInCorner = ref(false);
  /** The UI language preference; the shell applies it with `applyLanguage` whenever it changes. */
  const language = ref<LanguagePref>(cachedLanguagePref());

  function apply(p: Partial<Prefs>): void {
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    approachWindowHours.value = p.approachWindowHours ?? approachWindowHours.value;
    approachingCard.value = p.approachingCard ?? approachingCard.value;
    tasksCalendarVisible.value = p.tasksCalendarVisible ?? tasksCalendarVisible.value;
    supportCat.value = p.supportCat ?? supportCat.value;
    versionInCorner.value = p.versionInCorner ?? versionInCorner.value;
    language.value = p.language ?? language.value;
  }

  async function load(): Promise<void> {
    try {
      apply(await api.prefs());
    } catch { /* offline or signed out: switches keep their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = {
      labs: labs.value, approachBar: approachBar.value, approachWindowHours: approachWindowHours.value, approachingCard: approachingCard.value,
      tasksCalendarVisible: tasksCalendarVisible.value, supportCat: supportCat.value,
      versionInCorner: versionInCorner.value, language: language.value,
    };
    apply(p);
    try {
      await api.patchPrefs(p);
    } catch (e) {
      apply(before);
      throw e;
    }
  }

  return { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat, versionInCorner, language, load, set };
});
