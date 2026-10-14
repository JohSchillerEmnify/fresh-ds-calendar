import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import { DEFAULT_BEDTIME } from '@/features/bedtime/bedtime';
import { cachedLanguagePref, type LanguagePref } from '@/i18n';
import type { ApproachWindowHours, BedtimePrefs, Prefs, SupportCatSetting, TasksFilter, TasksGroupBy, TasksSortBy, TasksSortDir, UndatedDone } from '@/api/types';

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views), the Approaching card, its
 * approach track and window length (both on by default, like the server), "Show tasks calendar in Google",
 * support cat, the version label in the corner (off by default), left-handed mode (off by default), the Labs switch for the AI theme prompt and import, and how the Tasks view groups and sorts (time, date).
 */
export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  const approachBar = ref(true);
  const approachWindowHours = ref<ApproachWindowHours>(3);
  const approachingCard = ref(true);
  /** Task-list categories shown (on by default); off hides every category UI but keeps the stored ids. */
  const taskCategories = ref(true);
  const tasksCalendarVisible = ref(false);
  const supportCat = ref<SupportCatSetting>('sometimes');
  const versionInCorner = ref(false);
  const leftHanded = ref(false);
  const tasksGroupBy = ref<TasksGroupBy>('time');
  const tasksSortBy = ref<TasksSortBy>('date');
  const labsOwnThemes = ref(false);
  const tasksSortDir = ref<TasksSortDir>('default');
  const undatedDone = ref<UndatedDone>('calendar');
  /** The Tasks view's filter, shared by Open, Canvas and Archive. */
  const tasksFilter = ref<TasksFilter>({ categories: [], when: 'all' });
  /** The UI language preference; the shell applies it with `applyLanguage` whenever it changes. */
  const language = ref<LanguagePref>(cachedLanguagePref());
  /** Bedtime mode (night band and reminder); off until switched on in the settings. */
  const bedtime = ref<BedtimePrefs>({ ...DEFAULT_BEDTIME });

  function apply(p: Partial<Prefs>): void {
    labs.value = p.labs ?? labs.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    approachWindowHours.value = p.approachWindowHours ?? approachWindowHours.value;
    approachingCard.value = p.approachingCard ?? approachingCard.value;
    taskCategories.value = p.taskCategories ?? taskCategories.value;
    tasksCalendarVisible.value = p.tasksCalendarVisible ?? tasksCalendarVisible.value;
    supportCat.value = p.supportCat ?? supportCat.value;
    versionInCorner.value = p.versionInCorner ?? versionInCorner.value;
    leftHanded.value = p.leftHanded ?? leftHanded.value;
    tasksGroupBy.value = p.tasksGroupBy ?? tasksGroupBy.value;
    tasksSortBy.value = p.tasksSortBy ?? tasksSortBy.value;
    labsOwnThemes.value = p.labsOwnThemes ?? labsOwnThemes.value;
    tasksSortDir.value = p.tasksSortDir ?? tasksSortDir.value;
    undatedDone.value = p.undatedDone ?? undatedDone.value;
    tasksFilter.value = p.tasksFilter ?? tasksFilter.value;
    language.value = p.language ?? language.value;
    bedtime.value = p.bedtime ? { ...bedtime.value, ...p.bedtime } : bedtime.value;
  }

  async function load(): Promise<void> {
    try {
      apply(await api.prefs());
    } catch { /* offline or signed out: switches keep their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = {
      labs: labs.value, approachBar: approachBar.value, approachWindowHours: approachWindowHours.value, approachingCard: approachingCard.value, taskCategories: taskCategories.value,
      tasksCalendarVisible: tasksCalendarVisible.value, supportCat: supportCat.value,
      versionInCorner: versionInCorner.value, labsOwnThemes: labsOwnThemes.value, leftHanded: leftHanded.value, tasksGroupBy: tasksGroupBy.value, tasksSortBy: tasksSortBy.value, tasksSortDir: tasksSortDir.value, undatedDone: undatedDone.value, tasksFilter: tasksFilter.value, language: language.value, bedtime: bedtime.value,
    };
    apply(p);
    try {
      await api.patchPrefs(p);
    } catch (e) {
      apply(before);
      throw e;
    }
  }

  return { labs, approachBar, approachWindowHours, approachingCard, taskCategories, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, tasksGroupBy, tasksSortBy, tasksSortDir, undatedDone, tasksFilter, language, bedtime, load, set };
});
