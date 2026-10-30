<script setup lang="ts">
import { isIos as detectIos, isStandalone } from '@/pwa/install';
import IosInstallSheet from '@/components/settings/IosInstallSheet.vue';
// iPhones and iPads cannot install the Android app, so the download row is hidden there; they get the Home Screen instructions instead
const isIos = detectIos();
const showIosInstall = isIos && !isStandalone();
const installing = ref(false);
import { androidAppLabelKey, downloadApk, isNativeApp } from '@/native/app';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IconArrowBack as IconBack, IconKeyboardArrowUp as IconUp, IconKeyboardArrowDown as IconDown, IconAdd, IconChevronRight as IconNext } from '@/components/icons';
import { api, ApiError } from '@/api/client';
import { EVENT_COLOR_OPTIONS } from '@/api/colors';
import { NAV_POSITIONS } from '@/lib/navPosition';
import { bottomBarSizeOf, topBarSizeOf } from '@/composables/useBarSize';
import { isPhone } from '@/composables/useViewport';
import type { AnimationLevel, ApproachWindowHours, BedtimeMode, DaySideBySide, MinEventMinutes, WeekSideBySide, BedtimePrefs, Category, NotifyPrefs, Motivation, NavPosition, NavPhonePosition, Prefs, StreakChoice, SunflowersMode, SupportCatSetting, TaskOpen, UndatedDone, ViewName } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import Select from '@/components/m3/Select.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import TextField from '@/components/m3/TextField.vue';
import CategoryDialog from '@/components/settings/CategoryDialog.vue';
import { LABS_VIEWS, isLabsViewOn } from '@/features/labs/labs';
import { StreakFlame } from '@/features/motivation';
import { useMotivationStore } from '@/features/motivation/store';
import ConfirmDialog from '@/components/m3/ConfirmDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useBackupStore } from '@/stores/backup';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { usePrefsStore } from '@/stores/prefs';
import { useItemsStore } from '@/stores/items';
import { systemReducedMotion } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useSaveSettings } from '@/composables/useSaveSettings';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { shownVersion } from '@/pwa/version';
import { googleColorLabel, presetLabel, themeLabel as nameOfTheme } from '@/theme/labels';
import { automaticPreset } from '@/theme/presets';
import { LANGUAGE_NAMES, LANGUAGES, t, type LanguagePref } from '@/i18n';

const router = useRouter();
const settings = useSettingsStore();
const clock = useClockStore();
const device = useDeviceStore();
const auth = useAuthStore();
const sync = useSyncStore();
const ui = useUiStore();
const items = useItemsStore();
const s = computed(() => settings.settings);
const labs = usePrefsStore();
const theme = useThemeStore();
/** The chosen theme's name (an imported theme by its own name). */
const baseName = computed(() => (theme.pref.preset.startsWith('theme:') ? theme.themes.find((t) => `theme:${t.id}` === theme.pref.preset)?.doc.name ?? presetLabel('Default') : nameOfTheme(theme.pref.preset)));
/** The Theme row's value: the calendar's theme alone for Header + colours ("Halloween"), "Neon · Halloween header" for Header only, else the name. */
const themeLabel = computed(() => {
  const today = presetLabel(automaticPreset(clock.today));
  return theme.pref.seasonal === 'all' ? today : theme.pref.seasonal === 'header' ? t('theme.seasonal.headerOf', { base: baseName.value, name: today }) : baseName.value;
});
/** Each language in its own name; Automatic follows the device language. */
const languageOptions = computed(() => [{ value: 'auto', label: t('settings.language.auto') }, ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))]);
const build = shownVersion();

/** Persist a per-person preference (Labs switch, support cat, tasks calendar); a refusal rolls back in the store and shows a snackbar. */
async function savePrefs(p: Partial<Prefs>) {
  try { await labs.set(p); } catch (e) { ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed')); }
}

/** Persist a settings patch (failures: banner or snackbar, see `useSaveSettings`). */
const save = useSaveSettings();

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/');
}

// --- sections -------------------------------------------------------------------------------
/** Every setting lives in exactly one section (feature settings); the desktop list links to them. */
const SECTION_IDS = ['appearance', 'calendar', 'tasklists', 'motivation', 'motion', 'bedtime', 'notifications', 'labs', 'account'] as const;
type SectionId = (typeof SECTION_IDS)[number];
const sections = computed(() => SECTION_IDS.map((id) => ({ id, title: t(`settings.sections.${id}`) })));
const title = (id: SectionId) => t(`settings.sections.${id}`);
/** Scrolls inside the page instead of changing the URL hash (the router owns the URL). */
function jump(id: SectionId) {
  document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const views = computed(() => [{ value: 'month', label: t('views.month') }, { value: 'week', label: t('views.week') }, { value: 'day', label: t('views.day') }]);
const colorOptions = computed(() => [{ value: '', label: t('settings.calendar.calendarColor') }, ...EVENT_COLOR_OPTIONS.map((c) => ({ value: c.id, label: googleColorLabel(c) }))]);
/** 3, 6 and 12 hours, plus "Custom…" which reveals the hours field. */
const PRESET_WINDOWS = [3, 6, 12];
const approachWindows = computed(() => [...PRESET_WINDOWS.map((v) => ({ value: String(v), label: t('settings.calendar.approachWindow.hours', { count: v }, v) })), { value: 'custom', label: t('settings.calendar.approachWindow.custom') }]);
const customPicked = ref(false);
/** The select shows Custom… while picked or while the stored value is not a preset. */
const approachChoice = computed(() => (customPicked.value || !PRESET_WINDOWS.includes(labs.approachWindowHours) ? 'custom' : String(labs.approachWindowHours)));
/** Picking a preset saves it and hides the field; picking Custom… reveals and focuses the field. */
function pickApproachWindow(v: string) {
  if (v === 'custom') {
    customPicked.value = true;
    void nextTick(() => document.querySelector<HTMLInputElement>('[data-testid="settings-approach-window-custom"]')?.focus());
    return;
  }
  customPicked.value = false;
  void savePrefs({ approachWindowHours: Number(v) as ApproachWindowHours });
}
const customHours = ref(String(labs.approachWindowHours));
const customHoursError = ref('');
watch(() => labs.approachWindowHours, (h) => { customHours.value = String(h); customHoursError.value = ''; });
/** Saves a typed window length when it is a whole number of hours from 1 to 24. */
function commitCustomHours() {
  const h = Number(customHours.value.trim());
  if (!Number.isInteger(h) || h < 1 || h > 24) { customHoursError.value = t('settings.calendar.approachWindow.invalid'); return; }
  customHoursError.value = '';
  if (h !== labs.approachWindowHours) void savePrefs({ approachWindowHours: h });
}
const levels = computed(() => [{ value: 'full', label: t('settings.motion.full') }, { value: 'reduced', label: t('settings.motion.reduced') }, { value: 'off', label: t('common.off') }]);
/** The sunflowers setting only has an effect on the Sunflower field scene; otherwise it is shown but inactive. */
const fieldActive = computed(() => settings.effectiveScene === 'sunflowers');
const sunflowerModes = computed(() => [{ value: 'grow', label: t('settings.sunflowers.grow') }, { value: 'full', label: t('settings.sunflowers.full') }]);
const taskOpenOptions = computed(() => [
  { value: 'inline', label: t('settings.tasklists.taskOpen.inline'), testid: 'settings-task-open-inline' },
  { value: 'drawer', label: t('settings.tasklists.taskOpen.drawer'), testid: 'settings-task-open-drawer' },
]);
const undatedDoneOptions = computed(() => [
  { value: 'calendar', label: t('settings.tasklists.undatedDone.calendar'), testid: 'settings-undated-done-calendar' },
  { value: 'archive', label: t('settings.tasklists.undatedDone.archive'), testid: 'settings-undated-done-archive' },
]);
/** The three view switcher positions as options of the phone or the desktop row. */
/** The two-row week's split: 4 days on top (Mon-Thu) or 3 (Mon-Wed), values are strings for the segmented control. */
const minEventOptions = computed(() => ([0, 15, 30] as const).map((n) => ({
  value: String(n), label: n ? t('settings.calendar.minEventLength.minutes', { n }) : t('settings.calendar.minEventLength.off'), testid: `settings-min-event-length-${n}`,
})));
/** "Up to N" options of the day or week "events side by side" setting (values are strings for the segmented control). */
const sideBySideOptions = (view: 'day' | 'week', ns: readonly number[]) => computed(() => ns.map((n) => ({
  value: String(n), label: t('settings.calendar.sideBySide.upTo', { n }), testid: `settings-${view}-side-by-side-${n}`,
})));
const daySideOptions = sideBySideOptions('day', [2, 3, 4]);
const weekSideOptions = sideBySideOptions('week', [2, 3]);
const weekSplitOptions = [
  { value: '4', label: '4 / 3', testid: 'settings-week-two-row-split-4' },
  { value: '3', label: '3 / 4', testid: 'settings-week-two-row-split-3' },
];
const navOptions = (device: 'phone' | 'desktop') => (device === 'phone' ? [...NAV_POSITIONS, 'drawer' as const] : NAV_POSITIONS).map((p) => ({ value: p, label: t(`settings.navPosition.${p}`), testid: `settings-nav-${device}-${p}` }));
// --- bedtime ------------------------------------------------------------------------------------
const bt = computed(() => labs.bedtime);
const nt = computed(() => labs.notify);
/** Saves part of the notification preference (the whole object goes to the server, which merges it). */
function saveNotify(p: Partial<NotifyPrefs>) {
  if (p.morningTime !== undefined && !/^\d{2}:\d{2}$/.test(p.morningTime)) return;
  void savePrefs({ notify: { ...nt.value, ...p } });
}
/** Saves part of the bedtime preference; a time field only saves a complete `HH:MM`. */
function saveBedtime(p: Partial<BedtimePrefs>) {
  for (const v of [p.bedtime, p.wake, p.weekendBedtime, p.weekendWake]) if (v !== undefined && !/^\d{2}:\d{2}$/.test(v)) return;
  void savePrefs({ bedtime: p as BedtimePrefs });
}
const bedtimeModes = computed(() => [
  { value: 'fixed', label: t('bedtime.settings.mode.fixed'), testid: 'settings-bedtime-mode-fixed' },
  { value: 'dynamic', label: t('bedtime.settings.mode.dynamic'), testid: 'settings-bedtime-mode-dynamic' },
]);
/** The offered values plus the stored one, so a value set elsewhere still shows. */
const withCurrent = (offered: number[], current: number) => (offered.includes(current) ? offered : [...offered, current].sort((a, b) => a - b));
const sleepOptions = computed(() => withCurrent([6, 7, 8, 9, 10].map((h) => h * 60), bt.value.sleepMinutes).map((m) => ({ value: String(m), label: t('bedtime.settings.sleep.hours', { count: m / 60 }, m / 60) })));
const leadOptions = computed(() => withCurrent([0, 15, 30, 45, 60, 90, 120], bt.value.leadMinutes).map((m) => ({ value: String(m), label: m === 0 ? t('bedtime.settings.lead.none') : t('bedtime.settings.lead.minutes', { count: m }) })));
const reminderOptions = computed(() => withCurrent([0, 5, 10, 15, 30, 45, 60], bt.value.reminderMinutes).map((m) => ({ value: String(m), label: m === 0 ? t('bedtime.settings.reminder.off') : t('bedtime.settings.reminder.minutes', { count: m }) })));
const barSizes = computed(() => (['expressive', 'compact'] as const).map((v) => ({ value: v, label: t(`settings.calendar.barSize.${v}`), testid: `settings-bar-size-${v}` })));
/** The size choice as shown: `auto` shows what it resolves to on this screen. */
const topBarSize = computed(() => topBarSizeOf(labs.headerLayout, isPhone.value));
const bottomBarSize = computed(() => bottomBarSizeOf(labs.bottomBarSize, isPhone.value));
const streakOptions = computed(() => (['off', 'flame', 'plant'] as const).map((v) => ({ value: v, label: t(`settings.motivation.streak.${v}`) })));
const supportCats = computed(() => [{ value: 'off', label: t('common.off') }, { value: 'sometimes', label: t('settings.motivation.supportSometimes') }, { value: 'always', label: t('settings.motivation.supportAlways') }]);

// --- categories ---------------------------------------------------------------------------
const editing = ref<Category | null>(null);
const adding = ref(false);
async function move(id: string, dir: -1 | 1) {
  try { await settings.moveCategory(id, dir); } catch (e) { sync.reportError(e); }
}

// --- streak, demo data --------------------------------------------------------------------------
const best = ref<number | null>(null);
const motivation = useMotivationStore();
const currentStreak = computed(() => motivation.motivation?.streak.current ?? null);
onMounted(() => {
  // The top bar (which normally starts the check-in) is not shown on this page.
  void motivation.start({ today: () => clock.today }).then(() => { if (motivation.motivation) best.value = motivation.motivation.streak.best; });
  device.read('motivation', () => api.motivation()).then((m: Motivation) => { best.value = m.streak.best; }, () => { best.value = null; });
});
onBeforeUnmount(() => motivation.stop());
// --- backup to Google Drive (feature drive-backup) ---------------------------------------------
const backup = useBackupStore();
const confirmRestore = ref(false);
void backup.load();
const backupText = computed(() => {
  const s = backup.status;
  if (!s) return '';
  if (s.state === 'failed') return t('backup.status.failed', { reason: s.error ?? '' });
  if (s.state === 'ok' && s.lastBackupAt) return t('backup.status.ok', { time: backup.formatTime(s.lastBackupAt, clock.timeZone) });
  return t('backup.status.never');
});
async function runBackup() {
  const r = await backup.backupNow();
  ui.notify(r.ok ? t('backup.done') : t('backup.failed', { reason: r.message }));
}
async function runRestore() {
  confirmRestore.value = false;
  const r = await backup.restore();
  if (!r.ok) ui.notify(r.message);
}
const isMock = computed(() => clock.config.provider === 'mock');
const resetting = ref(false);
async function resetDemo() {
  resetting.value = true;
  try {
    await api.resetDemoData();
    items.$reset();
    await sync.syncNow();
    ui.notify(t('settings.account.resetDemo.done'));
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.account.resetDemo.failed'));
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <section class="page" data-testid="settings-view">
    <header class="bar">
      <IconButton :label="t('settings.back')" data-testid="settings-back" @click="back"><IconBack /></IconButton>
      <h1>{{ t('settings.title') }}</h1>
    </header>
    <div class="layout">
      <nav class="toc" :aria-label="t('settings.sectionsLabel')" data-testid="settings-toc">
        <a v-for="x in sections" :key="x.id" :href="`#s-${x.id}`" class="tocitem" @click.prevent="jump(x.id)">{{ x.title }}</a>
      </nav>
      <div class="content">
        <section id="s-appearance" class="card" data-testid="settings-section" data-section="appearance" aria-labelledby="h-appearance">
          <h2 id="h-appearance">{{ title('appearance') }}</h2>
          <button type="button" class="row link" data-testid="settings-theme" @click="router.push('/settings/theme')">
            <span class="grow"><span class="lab">{{ t('settings.theme.label') }}</span><span class="sub">{{ t('settings.theme.hint') }}</span></span>
            <span class="val" data-testid="settings-theme-name">{{ themeLabel }}</span>
            <IconNext aria-hidden="true" />
          </button>
          <div class="row"><Select class="fw" :model-value="labs.language" :options="languageOptions" :label="t('settings.language.label')" data-testid="settings-language" @update:model-value="savePrefs({ language: $event as LanguagePref })" /></div>
        </section>

        <section id="s-calendar" class="card" data-testid="settings-section" data-section="calendar" aria-labelledby="h-cal">
          <h2 id="h-cal">{{ title('calendar') }}</h2>
          <div class="row"><Select class="fw" :model-value="s.defaultView" :options="views" :label="t('settings.calendar.defaultView')" data-testid="settings-default-view" @update:model-value="save({ defaultView: $event as ViewName })" /></div>
          <div class="row"><Select class="fw" :model-value="s.defaultEventColorId ?? ''" :options="colorOptions" :label="t('settings.calendar.defaultEventColor')" data-testid="settings-default-event-color" @update:model-value="save({ defaultEventColorId: $event || null })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.calendar.minEventLength.label') }}</span><span class="sub">{{ t('settings.calendar.minEventLength.hint') }}</span><SegmentedButton :model-value="String(labs.minEventMinutes)" :options="minEventOptions" :label="t('settings.calendar.minEventLength.label')" data-testid="settings-min-event-length" @update:model-value="savePrefs({ minEventMinutes: Number($event) as MinEventMinutes })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.calendar.sideBySide.day') }}</span><span class="sub">{{ t('settings.calendar.sideBySide.hint') }}</span><SegmentedButton :model-value="String(labs.daySideBySide)" :options="daySideOptions" :label="t('settings.calendar.sideBySide.day')" data-testid="settings-day-side-by-side" @update:model-value="savePrefs({ daySideBySide: Number($event) as DaySideBySide })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.calendar.sideBySide.week') }}</span><span class="sub">{{ t('settings.calendar.sideBySide.hint') }}</span><SegmentedButton :model-value="String(labs.weekSideBySide)" :options="weekSideOptions" :label="t('settings.calendar.sideBySide.week')" data-testid="settings-week-side-by-side" @update:model-value="savePrefs({ weekSideBySide: Number($event) as WeekSideBySide })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.calendar.topBarSize.label') }}</span><span class="sub">{{ t('settings.calendar.topBarSize.hint') }}</span><SegmentedButton :model-value="topBarSize" :options="barSizes" :label="t('settings.calendar.topBarSize.label')" data-testid="settings-top-bar-size" @update:model-value="savePrefs({ headerLayout: $event === 'expressive' ? 'two-rows' : 'one-row' })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.calendar.bottomBarSize.label') }}</span><span class="sub">{{ t('settings.calendar.bottomBarSize.hint') }}</span><SegmentedButton :model-value="bottomBarSize" :options="barSizes" :label="t('settings.calendar.bottomBarSize.label')" data-testid="settings-bottom-bar-size" @update:model-value="savePrefs({ bottomBarSize: $event as 'expressive' | 'compact' })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.approachingCard.label') }}</span><span class="sub">{{ t('settings.calendar.approachingCard.hint') }}</span></div><Switch :model-value="labs.approachingCard" :label="t('settings.calendar.approachingCard.label')" data-testid="settings-approaching-card" @update:model-value="savePrefs({ approachingCard: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.approachTimeLeft.label') }}</span><span class="sub">{{ t('settings.calendar.approachTimeLeft.hint') }}</span></div><Switch :model-value="labs.approachTimeLeft" :label="t('settings.calendar.approachTimeLeft.label')" data-testid="settings-approach-time-left" @update:model-value="savePrefs({ approachTimeLeft: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.approachBar.label') }}</span><span class="sub">{{ t('settings.calendar.approachBar.hint') }}</span></div><Switch :model-value="labs.approachBar" :label="t('settings.calendar.approachBar.label')" data-testid="settings-approach-bar" @update:model-value="savePrefs({ approachBar: $event })" /></div>
          <div class="row">
            <Select class="grow" :model-value="approachChoice" :options="approachWindows" :label="t('settings.calendar.approachWindow.label')" data-testid="settings-approach-window" @update:model-value="pickApproachWindow" />
            <TextField v-if="approachChoice === 'custom'" v-model="customHours" class="hours" type="number" inputmode="numeric" min="1" max="24" step="1" :label="t('settings.calendar.approachWindow.customLabel')" data-testid="settings-approach-window-custom" :error="customHoursError" @commit="commitCustomHours" />
          </div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.syncIndicator.label') }}</span><span class="sub">{{ t('settings.calendar.syncIndicator.hint') }}</span></div><Switch :model-value="labs.syncIndicator" :label="t('settings.calendar.syncIndicator.label')" data-testid="settings-sync-indicator" @update:model-value="savePrefs({ syncIndicator: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.tasksCalendar.label') }}</span><span class="sub">{{ t('settings.calendar.tasksCalendar.hint') }}</span></div><Switch :model-value="labs.tasksCalendarVisible" :label="t('settings.calendar.tasksCalendar.label')" data-testid="settings-tasks-calendar-visible" @update:model-value="savePrefs({ tasksCalendarVisible: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.leftHanded.label') }}</span><span class="sub">{{ t('settings.leftHanded.hint') }}</span></div><Switch :model-value="labs.leftHanded" :label="t('settings.leftHanded.label')" data-testid="settings-left-handed" @update:model-value="savePrefs({ leftHanded: $event })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.navPosition.label') }} · {{ t('settings.navPosition.phone') }}</span><span class="sub">{{ t('settings.navPosition.hint') }}</span><Select :model-value="labs.navPhone" :options="navOptions('phone')" :label="t('settings.navPosition.phone')" data-testid="settings-nav-phone" @update:model-value="savePrefs({ navPhone: $event as NavPhonePosition })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.navPosition.label') }} · {{ t('settings.navPosition.desktop') }}</span><Select :model-value="labs.navDesktop" :options="navOptions('desktop')" :label="t('settings.navPosition.desktop')" data-testid="settings-nav-desktop" @update:model-value="savePrefs({ navDesktop: $event as NavPosition })" /></div>
        </section>

        <section id="s-tasklists" class="card" data-testid="settings-section" data-section="tasklists" aria-labelledby="h-cats">
          <h2 id="h-cats">{{ title('tasklists') }}</h2>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.tasklists.taskCategories.label') }}</span><span class="sub">{{ t('settings.tasklists.taskCategories.hint') }}</span></div><Switch :model-value="labs.taskCategories" :label="t('settings.tasklists.taskCategories.label')" data-testid="settings-task-categories" @update:model-value="savePrefs({ taskCategories: $event })" /></div>
          <span v-if="labs.taskCategories" class="lab sublab">{{ t('settings.tasklists.categories') }}</span>
          <ul v-if="labs.taskCategories" class="cats">
            <li v-for="(c, i) in settings.categories" :key="c.id" class="cat" data-testid="settings-category" :data-category-id="c.id" :data-name="c.name" :data-color="c.color">
              <button class="catmain" type="button" :aria-label="t('settings.tasklists.editCategory', { name: c.name })" @click="editing = c">
                <i class="dot" :style="{ background: c.color }" /><span v-if="c.icon" class="em">{{ c.icon }}</span><span class="nm">{{ c.name }}</span>
              </button>
              <IconButton :label="t('settings.tasklists.moveUp', { name: c.name })" :disabled="i === 0" data-testid="settings-category-up" @click="move(c.id, -1)"><IconUp /></IconButton>
              <IconButton :label="t('settings.tasklists.moveDown', { name: c.name })" :disabled="i === settings.categories.length - 1" data-testid="settings-category-down" @click="move(c.id, 1)"><IconDown /></IconButton>
            </li>
          </ul>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.tasklists.carriedFrom.label') }}</span><span class="sub">{{ t('settings.tasklists.carriedFrom.hint') }}</span></div><Switch :model-value="labs.showCarriedFrom" :label="t('settings.tasklists.carriedFrom.label')" data-testid="settings-carried-from" @update:model-value="savePrefs({ showCarriedFrom: $event })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.tasklists.undatedDone.label') }}</span><SegmentedButton :model-value="labs.undatedDone" :options="undatedDoneOptions" :label="t('settings.tasklists.undatedDone.label')" data-testid="settings-undated-done" @update:model-value="savePrefs({ undatedDone: $event as UndatedDone })" /></div>
          <button type="button" class="row link" data-testid="settings-templates" @click="router.push('/settings/templates')">
            <span class="grow"><span class="lab">{{ t('tasks.templates.page') }}</span><span class="sub">{{ t('tasks.templates.pageHint') }}</span></span>
            <IconNext aria-hidden="true" />
          </button>
          <div class="row col"><span class="lab">{{ t('settings.tasklists.taskOpen.label') }}</span><SegmentedButton :model-value="labs.taskOpen" :options="taskOpenOptions" :label="t('settings.tasklists.taskOpen.label')" data-testid="settings-task-open" @update:model-value="savePrefs({ taskOpen: $event as TaskOpen })" /></div>
          <div v-if="labs.taskCategories" class="row"><Button variant="tonal" data-testid="settings-category-add" @click="adding = true"><template #icon><IconAdd /></template>{{ t('settings.tasklists.addCategory') }}</Button></div>
        </section>

        <section id="s-motivation" class="card" data-testid="settings-section" data-section="motivation" aria-labelledby="h-focus">
          <h2 id="h-focus">{{ title('motivation') }}</h2>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.motivation.calmMode.label') }}</span><span class="sub">{{ t('settings.motivation.calmMode.hint') }}</span></div><Switch :model-value="s.calmMode" :label="t('settings.motivation.calmMode.label')" data-testid="settings-calm-mode" @update:model-value="save({ calmMode: $event })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.motivation.streak.label') }}</span><SegmentedButton :model-value="labs.streak" :options="streakOptions" :label="t('settings.motivation.streak.label')" data-testid="settings-streak" @update:model-value="savePrefs({ streak: $event as StreakChoice })" /></div>
          <div class="row col"><span class="lab">{{ t('settings.sunflowers.label') }}</span><span v-if="!fieldActive" class="sub" data-testid="settings-sunflowers-hint">{{ t('settings.sunflowers.hint') }}</span><SegmentedButton :model-value="s.sunflowers" :options="sunflowerModes" :label="t('settings.sunflowers.label')" :disabled="!fieldActive" data-testid="settings-sunflowers" @update:model-value="save({ sunflowers: $event as SunflowersMode })" /></div>
          <div v-if="currentStreak !== null" class="row"><span class="lab grow">{{ t('settings.motivation.currentStreak') }}</span><StreakFlame :count="currentStreak" /></div>
          <div class="row"><span class="lab grow">{{ t('settings.motivation.bestStreak') }}</span><span class="val" data-testid="settings-best-streak">{{ best ?? '–' }}</span></div>
          <div class="row col"><span class="lab">{{ t('settings.motivation.supportCat') }}</span><SegmentedButton :model-value="labs.supportCat" :options="supportCats" :label="t('settings.motivation.supportCat')" data-testid="settings-support-cat" @update:model-value="savePrefs({ supportCat: $event as SupportCatSetting })" /></div>
        </section>

        <section id="s-motion" class="card" data-testid="settings-section" data-section="motion" aria-labelledby="h-motion">
          <h2 id="h-motion">{{ title('motion') }}</h2>
          <div class="row col"><span class="lab">{{ t('settings.motion.animations') }}</span><SegmentedButton :model-value="s.animationLevel" :options="levels" :label="t('settings.motion.animations')" data-testid="settings-animation-level" @update:model-value="save({ animationLevel: $event as AnimationLevel })" /></div>
          <p v-if="systemReducedMotion" class="sub note" data-testid="settings-system-reduced-motion">{{ t('settings.motion.systemReduced') }}</p>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.motion.ignoreSystem.label') }}</span><span class="sub">{{ t('settings.motion.ignoreSystem.hint') }}</span></div><Switch :model-value="s.ignoreSystemMotion" :label="t('settings.motion.ignoreSystem.label')" data-testid="settings-ignore-system-motion" @update:model-value="save({ ignoreSystemMotion: $event })" /></div>
          <div class="row"><span class="lab grow">{{ t('settings.motion.sounds') }}</span><Switch :model-value="s.sounds" :label="t('settings.motion.sounds')" data-testid="settings-sounds" @update:model-value="save({ sounds: $event })" /></div>
        </section>

        <section id="s-bedtime" class="card" data-testid="settings-section" data-section="bedtime" aria-labelledby="h-bedtime">
          <h2 id="h-bedtime">{{ title('bedtime') }}</h2>
          <div class="row"><div class="grow"><span class="lab">{{ t('bedtime.settings.on.label') }}</span><span class="sub">{{ t('bedtime.settings.on.hint') }}</span></div><Switch :model-value="bt.enabled" :label="t('bedtime.settings.on.label')" data-testid="settings-bedtime-on" @update:model-value="saveBedtime({ enabled: $event })" /></div>
          <template v-if="bt.enabled">
            <div class="row col"><span class="lab">{{ t('bedtime.settings.mode.label') }}</span><SegmentedButton :model-value="bt.mode" :options="bedtimeModes" :label="t('bedtime.settings.mode.label')" data-testid="settings-bedtime-mode" @update:model-value="saveBedtime({ mode: $event as BedtimeMode })" /></div>
            <div class="row">
              <TextField class="grow" :model-value="bt.bedtime" type="time" :label="t('bedtime.settings.bedtime')" data-testid="settings-bedtime-time" @update:model-value="saveBedtime({ bedtime: $event })" />
              <TextField class="grow" :model-value="bt.wake" type="time" :label="t('bedtime.settings.wake')" data-testid="settings-bedtime-wake" @update:model-value="saveBedtime({ wake: $event })" />
            </div>
            <div class="row"><div class="grow"><span class="lab">{{ t('bedtime.settings.weekend.label') }}</span><span class="sub">{{ t('bedtime.settings.weekend.hint') }}</span></div><Switch :model-value="bt.weekendDifferent" :label="t('bedtime.settings.weekend.label')" data-testid="settings-bedtime-weekend" @update:model-value="saveBedtime({ weekendDifferent: $event })" /></div>
            <div v-if="bt.weekendDifferent" class="row">
              <TextField class="grow" :model-value="bt.weekendBedtime" type="time" :label="t('bedtime.settings.weekendBedtime')" data-testid="settings-bedtime-weekend-time" @update:model-value="saveBedtime({ weekendBedtime: $event })" />
              <TextField class="grow" :model-value="bt.weekendWake" type="time" :label="t('bedtime.settings.weekendWake')" data-testid="settings-bedtime-weekend-wake" @update:model-value="saveBedtime({ weekendWake: $event })" />
            </div>
            <template v-if="bt.mode === 'dynamic'">
              <p class="sub note" data-testid="settings-bedtime-dynamic-hint">{{ t('bedtime.settings.dynamicHint') }}</p>
              <div class="row"><Select class="fw" :model-value="String(bt.sleepMinutes)" :options="sleepOptions" :label="t('bedtime.settings.sleep.label')" data-testid="settings-bedtime-sleep" @update:model-value="saveBedtime({ sleepMinutes: Number($event) })" /></div>
              <div class="row"><Select class="fw" :model-value="String(bt.leadMinutes)" :options="leadOptions" :label="t('bedtime.settings.lead.label')" data-testid="settings-bedtime-lead" @update:model-value="saveBedtime({ leadMinutes: Number($event) })" /></div>
            </template>
            <div class="row"><Select class="fw" :model-value="String(bt.reminderMinutes)" :options="reminderOptions" :label="t('bedtime.settings.reminder.label')" data-testid="settings-bedtime-reminder" @update:model-value="saveBedtime({ reminderMinutes: Number($event) })" /></div>
          </template>
        </section>

        <section id="s-notifications" class="card" data-testid="settings-section" data-section="notifications" aria-labelledby="h-notifications">
          <h2 id="h-notifications">{{ title('notifications') }}</h2>
          <button type="button" class="row link" data-testid="settings-reminders" @click="router.push('/settings/reminders')">
            <span class="grow"><span class="lab">{{ t('settings.reminders.label') }}</span><span class="sub">{{ t('settings.reminders.hint') }}</span></span>
            <IconNext aria-hidden="true" />
          </button>
          <p class="sub note" data-testid="settings-notify-hint">{{ t('settings.notifications.hint') }}</p>
          <div class="row"><span class="lab grow">{{ t('settings.notifications.bedtime') }}</span><Switch :model-value="nt.bedtime" :label="t('settings.notifications.bedtime')" data-testid="settings-notify-bedtime" @update:model-value="saveNotify({ bedtime: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.notifications.events.label') }}</span><span class="sub">{{ t('settings.notifications.events.hint') }}</span></div><Switch :model-value="nt.events" :label="t('settings.notifications.events.label')" data-testid="settings-notify-events" @update:model-value="saveNotify({ events: $event })" /></div>
          <div class="row"><span class="lab grow">{{ t('settings.notifications.tasklists') }}</span><Switch :model-value="nt.tasklists" :label="t('settings.notifications.tasklists')" data-testid="settings-notify-tasklists" @update:model-value="saveNotify({ tasklists: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.notifications.morning.label') }}</span><span class="sub">{{ t('settings.notifications.morning.hint') }}</span></div><Switch :model-value="nt.morning" :label="t('settings.notifications.morning.label')" data-testid="settings-notify-morning" @update:model-value="saveNotify({ morning: $event })" /></div>
          <div v-if="nt.morning" class="row"><TextField class="grow" :model-value="nt.morningTime" type="time" :label="t('settings.notifications.morning.time')" data-testid="settings-notify-morning-time" @update:model-value="saveNotify({ morningTime: $event })" /></div>
        </section>

        <section id="s-labs" class="card" data-testid="settings-section" data-section="labs" aria-labelledby="h-labs">
          <h2 id="h-labs">{{ title('labs') }}</h2>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.labs.experimental.label') }}</span><span class="sub">{{ t('settings.labs.experimental.hint') }}</span></div><Switch :model-value="labs.labs" :label="t('settings.labs.experimental.label')" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" /></div>
          <template v-if="labs.labs">
            <span class="lab sublab">{{ t('settings.labs.views.title') }}</span>
            <div v-for="v in LABS_VIEWS" :key="v.id" class="row"><div class="grow"><span class="lab">{{ t(v.labelKey) }}</span></div><Switch :model-value="isLabsViewOn(v.id, labs.labsViews)" :label="t(v.labelKey)" :data-testid="`settings-labs-view-${v.id}`" @update:model-value="savePrefs({ labsViews: { [v.id]: $event } })" /></div>
            <div class="row"><div class="grow"><span class="lab">{{ t('settings.ownThemes.label') }}</span><span class="sub">{{ t('settings.ownThemes.hint') }}</span></div><Switch :model-value="labs.labsOwnThemes" :label="t('settings.ownThemes.label')" data-testid="settings-labs-own-themes" @update:model-value="savePrefs({ labsOwnThemes: $event })" /></div>
            <div class="row"><div class="grow"><span class="lab">{{ t('settings.labs.growCards.label') }}</span><span class="sub">{{ t('settings.labs.growCards.hint') }}</span></div><Switch :model-value="labs.labsGrowCards" :label="t('settings.labs.growCards.label')" data-testid="settings-labs-grow-cards" @update:model-value="savePrefs({ labsGrowCards: $event })" /></div>
            <div class="row"><div class="grow"><span class="lab">{{ t('settings.labs.weekTwoRow.label') }}</span><span class="sub">{{ t('settings.labs.weekTwoRow.hint') }}</span></div><Switch :model-value="labs.weekTwoRow" :label="t('settings.labs.weekTwoRow.label')" data-testid="settings-week-two-row" @update:model-value="savePrefs({ weekTwoRow: $event })" /></div>
            <div v-if="labs.weekTwoRow" class="row col"><span class="lab">{{ t('settings.labs.weekTwoRow.split') }}</span><SegmentedButton :model-value="String(labs.weekTwoRowTop)" :options="weekSplitOptions" :label="t('settings.labs.weekTwoRow.split')" data-testid="settings-week-two-row-split" @update:model-value="savePrefs({ weekTwoRowTop: $event === '3' ? 3 : 4 })" /></div>
          </template>
        </section>

        <section id="s-account" class="card" data-testid="settings-section" data-section="account" aria-labelledby="h-account">
          <h2 id="h-account">{{ title('account') }}</h2>
          <div v-if="auth.status === 'in'" class="row"><div class="grow"><span class="lab">{{ t('settings.account.signedIn') }}</span><span class="sub">{{ auth.email }}</span></div><Button variant="outlined" data-testid="settings-signout" @click="auth.signOut()">{{ t('settings.account.signOut') }}</Button></div>
          <div v-if="auth.status === 'in'" class="row"><div class="grow"><span class="lab">{{ t('settings.account.signOutAll.label') }}</span><span class="sub">{{ t('settings.account.signOutAll.hint') }}</span></div><Button variant="outlined" data-testid="settings-signout-all" @click="auth.signOutAll()">{{ t('settings.account.signOutAll.button') }}</Button></div>
          <div v-if="auth.calendarMissing" class="row"><div class="grow"><span class="lab">{{ t('settings.account.calendarAccess.label') }}</span><span class="sub">{{ t('settings.account.calendarAccess.hint') }}</span></div><Button variant="tonal" data-testid="settings-calendar-access" @click="auth.grantCalendar()">{{ t('settings.account.calendarAccess.grant') }}</Button></div>
          <template v-if="backup.status?.available">
            <div v-if="backup.status.permission === 'missing'" class="row">
              <div class="grow" data-testid="settings-backup-status" data-state="off"><span class="lab">{{ t('backup.allow.label') }}</span><span class="sub">{{ t('backup.allow.hint') }}</span></div>
              <Button variant="outlined" data-testid="settings-backup-allow" @click="backup.allow()">{{ t('backup.allow.button') }}</Button>
            </div>
            <template v-else>
              <div class="row"><div class="grow" data-testid="settings-backup-status" :data-state="backup.status.state" :data-last-backup="backup.status.lastBackupAt ?? ''"><span class="lab">{{ t('backup.label') }}</span><span class="sub">{{ backupText }}</span></div></div>
              <div class="row wrap">
                <Button variant="outlined" :disabled="backup.busy !== null" data-testid="settings-backup-now" @click="runBackup">{{ t('backup.now') }}</Button>
                <Button variant="outlined" :disabled="backup.busy !== null" data-testid="settings-backup-restore" @click="confirmRestore = true">{{ t('backup.restore') }}</Button>
              </div>
            </template>
          </template>
          <div v-if="isMock" class="row"><div class="grow"><span class="lab">{{ t('settings.account.resetDemo.label') }}</span><span class="sub">{{ t('settings.account.resetDemo.hint') }}</span></div><Button variant="outlined" :disabled="resetting" data-testid="settings-reset-demo" @click="resetDemo">{{ t('settings.account.resetDemo.button') }}</Button></div>
          <div v-if="showIosInstall" class="row"><div class="grow"><span class="lab">{{ t('settings.account.installApp.label') }}</span><span class="sub">{{ t('settings.account.installApp.hint') }}</span></div><Button variant="tonal" data-testid="settings-install-app" @click="installing = true">{{ t('settings.account.installApp.button') }}</Button></div>
          <div v-if="!isIos" class="row"><div class="grow"><span class="lab">{{ t(androidAppLabelKey(isNativeApp())) }}</span><span class="sub">{{ t('settings.account.androidApp.hint') }}</span></div><Button variant="tonal" data-testid="settings-android-app" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button></div>
          <div class="row"><div class="grow" data-testid="settings-version"><span class="lab">{{ t('settings.account.version', { version: build.version }) }}</span><span v-if="build.sha" class="sub">{{ build.sha }}</span></div></div>
          <div v-if="clock.config.apk?.certSha256" class="row"><div class="grow" data-testid="settings-app-cert"><span class="lab">{{ t('settings.account.appCert.label') }}</span><span class="sub cert">{{ clock.config.apk.certSha256 }}</span><span class="sub">{{ t('settings.account.appCert.hint') }}</span></div></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.account.whatsNew.label') }}</span><span class="sub">{{ t('settings.account.whatsNew.hint') }}</span></div><Button variant="outlined" data-testid="settings-whats-new" @click="ui.openDialog('whats-new')">{{ t('settings.account.whatsNew.button') }}</Button></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.account.versionCorner.label') }}</span><span class="sub">{{ t('settings.account.versionCorner.hint') }}</span></div><Switch :model-value="labs.versionInCorner" :label="t('settings.account.versionCorner.label')" data-testid="settings-version-corner" @update:model-value="savePrefs({ versionInCorner: $event })" /></div>
        </section>
      </div>
    </div>
    <IosInstallSheet v-if="installing" @close="installing = false" />
    <ConfirmDialog :open="confirmRestore" :title="t('backup.restoreDialog.title')" :message="t('backup.restoreDialog.message')" :ok-label="t('backup.restoreDialog.ok')" @ok="runRestore" @cancel="confirmRestore = false" />
    <CategoryDialog v-if="adding" @close="adding = false" />
    <CategoryDialog v-if="editing" :category="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.layout { max-width: 900px; margin: 0 auto; }
.toc { display: none; }
@media (min-width: 900px) {
  .layout { display: grid; grid-template-columns: 200px minmax(0, 640px); gap: 24px; padding: 0 12px; justify-content: center; }
  .toc { display: flex; flex-direction: column; gap: 2px; position: sticky; top: calc(var(--safe-top) + 64px); align-self: start; padding-top: 4px; }
}
.tocitem { padding: 10px 16px; border-radius: var(--md-sys-shape-corner-full); color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); text-decoration: none; }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .tocitem:hover { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); } }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; width: 100%; margin: 0 auto; }
.card { scroll-margin-top: calc(var(--safe-top) + 64px); background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 4px 8px; }
h2 { margin: 0; padding: 12px 16px 4px; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 16px; min-height: 56px; }
.row.wrap { flex-wrap: wrap; }
.row.col { flex-direction: column; align-items: stretch; gap: 8px; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fw { width: 100%; }
.link { width: 100%; text-align: left; color: inherit; border-radius: var(--md-sys-shape-corner-large); }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .link:hover { background: var(--md-sys-color-surface-container-high); } }
.sublab { display: block; padding: 4px 16px; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.note { margin: 0; padding: 0 16px; }
.hours { flex: none; width: 104px; }
.lab { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.sub.cert { display: block; font-family: ui-monospace, monospace; font-size: 12px; overflow-wrap: anywhere; }
.val { font: var(--md-sys-typescale-title-medium); }
.cats { list-style: none; margin: 0; padding: 0; }
.cat { display: flex; align-items: center; padding: 0 8px 0 16px; }
.catmain { flex: 1; min-height: 52px; display: flex; align-items: center; gap: 10px; text-align: left; min-width: 0; }
.dot { width: 16px; height: 16px; border-radius: 50%; flex: none; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--md-sys-typescale-body-large); }
/* Left-handed mode (phone, touch tablet): the switch or trailing control at the left start of the row, the label after it. */
html[data-hand='left'][data-touch] .row:not(.col, .link) { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .cat { flex-direction: row-reverse; padding: 0 16px 0 8px; }
</style>
