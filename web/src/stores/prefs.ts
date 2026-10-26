import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import { DEFAULT_BEDTIME } from '@/features/bedtime/bedtime';
import { cachedLanguagePref, type LanguagePref } from '@/i18n';
import type { ApproachWindowHours, DaySideBySide, HeaderLayout, MinEventMinutes, StreakChoice, WeekSideBySide, NavPosition, BedtimePrefs, NotifyPrefs, Prefs, SupportCatSetting, TasksFilter, TasksGroupBy, TasksSortBy, TasksSortDir, TaskOpen, UndatedDone } from '@/api/types';

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs switches (experimental views), the Approaching card, its
 * approach track and window length (both on by default, like the server), "Show tasks calendar in Google",
 * support cat, the version label in the corner (off by default), left-handed mode (off by default), where the view switcher sits (phone, desktop), the Labs switch for the AI theme prompt and import, and how the Tasks view groups and sorts (time, date).
 */
/** The server's default `notify` preference (feature reminders). */
export const DEFAULT_NOTIFY: NotifyPrefs = { bedtime: true, events: true, tasklists: false, morning: false, morningTime: '08:00' };

export const usePrefsStore = defineStore('prefs', () => {
  const labs = ref(false);
  /** Which Labs views the switcher offers, per view id (see `visibleLabsViews`). */
  const labsViews = ref<Record<string, boolean>>({});
  const approachBar = ref(true);
  const approachWindowHours = ref<ApproachWindowHours>(3);
  const approachingCard = ref(true);
  /** Task-list categories shown (on by default); off hides every category UI but keeps the stored ids. */
  const taskCategories = ref(true);
  const tasksCalendarVisible = ref(false);
  const supportCat = ref<SupportCatSetting>('sometimes');
  const versionInCorner = ref(false);
  const leftHanded = ref(false);
  /** The "From …" label on task lists carried over to today (on by default). */
  const showCarriedFrom = ref(true);
  /** Where the view switcher sits on phones / on desktop and tablets (feature nav-position). */
  const navPhone = ref<NavPosition>('bottom');
  const navDesktop = ref<NavPosition>('rail');
  const tasksGroupBy = ref<TasksGroupBy>('time');
  const tasksSortBy = ref<TasksSortBy>('date');
  const labsOwnThemes = ref(false);
  const tasksSortDir = ref<TasksSortDir>('default');
  const undatedDone = ref<UndatedDone>('calendar');
  const taskOpen = ref<TaskOpen>('inline');
  /** The Tasks view's filter, shared by Open, Canvas and Archive. */
  const tasksFilter = ref<TasksFilter>({ categories: [], when: 'all' });
  /** The UI language preference; the shell applies it with `applyLanguage` whenever it changes. */
  const language = ref<LanguagePref>(cachedLanguagePref());
  /** Bedtime mode (night band and reminder); off until switched on in the settings. */
  const bedtime = ref<BedtimePrefs>({ ...DEFAULT_BEDTIME });
  /** Which reminders become system notifications (like the server's default: all but the morning overview). */
  const notify = ref<NotifyPrefs>({ ...DEFAULT_NOTIFY });
  /** Labs: the two-row week overview (off by default) and how many days sit on its top row. */
  const weekTwoRow = ref(false);
  const weekTwoRowTop = ref<3 | 4>(4);
  /** Labs: a tap on a task-list card grows it in place (off by default: a tap opens the list sheet). */
  const labsGrowCards = ref(false);
  /** Minimum event length in minutes (0 = off): shorter timed entries are laid out as this long. */
  const minEventMinutes = ref<MinEventMinutes>(0);
  /** How many overlapping events the day view places side by side before they cascade. */
  const daySideBySide = ref<DaySideBySide>(4);
  /** How many overlapping events the week view places side by side before they cascade. */
  const weekSideBySide = ref<WeekSideBySide>(2);
  /** What the top bar shows of the streak; Off until the prefs say otherwise, so a flame or plant never flashes up. */
  const streak = ref<StreakChoice>('off');
  /** The sync icon all the time; off, it shows only while syncing fails. */
  const syncIndicator = ref(false);
  /** The phone's top bar layout (two rows by default). */
  const headerLayout = ref<HeaderLayout>('two-rows');
  /** The server's answer has been applied once (the top bar's `data-ready`: a hidden streak is then a choice, not a wait). */
  const loaded = ref(false);

  function apply(p: Partial<Prefs>): void {
    labs.value = p.labs ?? labs.value;
    labsViews.value = p.labsViews ? { ...labsViews.value, ...p.labsViews } : labsViews.value;
    approachBar.value = p.approachBar ?? approachBar.value;
    approachWindowHours.value = p.approachWindowHours ?? approachWindowHours.value;
    approachingCard.value = p.approachingCard ?? approachingCard.value;
    taskCategories.value = p.taskCategories ?? taskCategories.value;
    tasksCalendarVisible.value = p.tasksCalendarVisible ?? tasksCalendarVisible.value;
    supportCat.value = p.supportCat ?? supportCat.value;
    versionInCorner.value = p.versionInCorner ?? versionInCorner.value;
    leftHanded.value = p.leftHanded ?? leftHanded.value;
    showCarriedFrom.value = p.showCarriedFrom ?? showCarriedFrom.value;
    navPhone.value = p.navPhone ?? navPhone.value;
    navDesktop.value = p.navDesktop ?? navDesktop.value;
    tasksGroupBy.value = p.tasksGroupBy ?? tasksGroupBy.value;
    tasksSortBy.value = p.tasksSortBy ?? tasksSortBy.value;
    labsOwnThemes.value = p.labsOwnThemes ?? labsOwnThemes.value;
    tasksSortDir.value = p.tasksSortDir ?? tasksSortDir.value;
    undatedDone.value = p.undatedDone ?? undatedDone.value;
    taskOpen.value = p.taskOpen ?? taskOpen.value;
    tasksFilter.value = p.tasksFilter ?? tasksFilter.value;
    language.value = p.language ?? language.value;
    bedtime.value = p.bedtime ? { ...bedtime.value, ...p.bedtime } : bedtime.value;
    notify.value = p.notify ? { ...notify.value, ...p.notify } : notify.value;
    weekTwoRow.value = p.weekTwoRow ?? weekTwoRow.value;
    weekTwoRowTop.value = p.weekTwoRowTop ?? weekTwoRowTop.value;
    labsGrowCards.value = p.labsGrowCards ?? labsGrowCards.value;
    minEventMinutes.value = p.minEventMinutes ?? minEventMinutes.value;
    daySideBySide.value = p.daySideBySide ?? daySideBySide.value;
    weekSideBySide.value = p.weekSideBySide ?? weekSideBySide.value;
    streak.value = p.streak ?? streak.value;
    syncIndicator.value = p.syncIndicator ?? syncIndicator.value;
    headerLayout.value = p.headerLayout ?? headerLayout.value;
  }

  /** Every preference as it is now (the rollback copy of `set`, and what the last known state keeps). */
  function current(): Prefs {
    return {
      labs: labs.value, labsViews: labsViews.value, approachBar: approachBar.value, approachWindowHours: approachWindowHours.value, approachingCard: approachingCard.value, taskCategories: taskCategories.value,
      tasksCalendarVisible: tasksCalendarVisible.value, supportCat: supportCat.value,
      versionInCorner: versionInCorner.value, labsOwnThemes: labsOwnThemes.value, leftHanded: leftHanded.value, showCarriedFrom: showCarriedFrom.value, navPhone: navPhone.value, navDesktop: navDesktop.value, tasksGroupBy: tasksGroupBy.value, tasksSortBy: tasksSortBy.value, tasksSortDir: tasksSortDir.value, undatedDone: undatedDone.value, taskOpen: taskOpen.value, tasksFilter: tasksFilter.value, language: language.value, bedtime: bedtime.value, notify: notify.value, weekTwoRow: weekTwoRow.value, weekTwoRowTop: weekTwoRowTop.value, labsGrowCards: labsGrowCards.value, minEventMinutes: minEventMinutes.value, daySideBySide: daySideBySide.value, weekSideBySide: weekSideBySide.value, streak: streak.value, syncIndicator: syncIndicator.value, headerLayout: headerLayout.value,
    };
  }

  async function load(): Promise<void> {
    try {
      apply(await api.prefs());
      loaded.value = true;
    } catch { /* offline or signed out: switches keep their defaults */ }
  }

  /** Optimistic change; rolls back when the server refuses. */
  async function set(p: Partial<Prefs>): Promise<void> {
    const before = current();
    apply(p);
    try {
      await api.patchPrefs(p);
    } catch (e) {
      apply(before);
      throw e;
    }
  }

  return { labs, labsViews, approachBar, approachWindowHours, approachingCard, taskCategories, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, showCarriedFrom, navPhone, navDesktop, tasksGroupBy, tasksSortBy, tasksSortDir, undatedDone, taskOpen, tasksFilter, language, bedtime, notify, weekTwoRow, weekTwoRowTop, labsGrowCards, minEventMinutes, daySideBySide, weekSideBySide, streak, syncIndicator, headerLayout, loaded, load, set, current, restore: apply };
});
