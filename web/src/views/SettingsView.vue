<script setup lang="ts">
import { isIos as detectIos, isStandalone } from '@/pwa/install';
import IosInstallSheet from '@/components/settings/IosInstallSheet.vue';
// iPhones and iPads cannot install the Android app, so the download row is hidden there; they get the Home Screen instructions instead
const isIos = detectIos();
const showIosInstall = isIos && !isStandalone();
const installing = ref(false);
/** Starts the APK download (`GET /app.apk`, served by the server, excluded from the service worker's fallback). */
function downloadApk(): void { location.href = '/app.apk'; }
import { androidAppLabelKey, isNativeApp } from '@/native/app';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IconArrowBack as IconBack, IconKeyboardArrowUp as IconUp, IconKeyboardArrowDown as IconDown, IconAdd, IconChevronRight as IconNext } from '@/components/icons';
import { api, ApiError } from '@/api/client';
import { EVENT_COLOR_OPTIONS } from '@/api/colors';
import type { AnimationLevel, ApproachWindowHours, BedtimeMode, BedtimePrefs, Category, Motivation, Prefs, SunflowersMode, SupportCatSetting, UndatedDone, ViewName } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import Select from '@/components/m3/Select.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import TextField from '@/components/m3/TextField.vue';
import CategoryDialog from '@/components/settings/CategoryDialog.vue';
import { StreakFlame } from '@/features/motivation';
import { useMotivationStore } from '@/features/motivation/store';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useItemsStore } from '@/stores/items';
import { systemReducedMotion } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { shownVersion } from '@/pwa/version';
import { googleColorLabel, presetLabel, themeLabel as nameOfTheme } from '@/theme/labels';
import { automaticPreset } from '@/theme/presets';
import { LANGUAGE_NAMES, LANGUAGES, t, type LanguagePref } from '@/i18n';

const router = useRouter();
const settings = useSettingsStore();
const clock = useClockStore();
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

/** Persist a patch; failures roll back in the store and surface as the banner or a snackbar. */
async function save(p: Parameters<typeof settings.patch>[0]) {
  try {
    await settings.patch(p);
  } catch (e) {
    if (e instanceof ApiError && e.isUnavailable) sync.reportError(e);
    else ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/');
}

// --- sections -------------------------------------------------------------------------------
/** Every setting lives in exactly one section (ARCHITECTURE "Settings"); the desktop list links to them. */
const SECTION_IDS = ['appearance', 'calendar', 'tasklists', 'motivation', 'motion', 'bedtime', 'labs', 'account'] as const;
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
const warns = computed(() => [{ value: '0', label: t('common.off') }, ...[5, 10, 15].map((m) => ({ value: String(m), label: t('settings.motivation.minutes', { count: m }) }))]);
/** The sunflowers setting only has an effect on the Sunflower field scene; otherwise it is shown but inactive. */
const fieldActive = computed(() => settings.effectiveScene === 'sunflowers');
const sunflowerModes = computed(() => [{ value: 'grow', label: t('settings.sunflowers.grow') }, { value: 'full', label: t('settings.sunflowers.full') }]);
const undatedDoneOptions = computed(() => [
  { value: 'calendar', label: t('settings.tasklists.undatedDone.calendar'), testid: 'settings-undated-done-calendar' },
  { value: 'archive', label: t('settings.tasklists.undatedDone.archive'), testid: 'settings-undated-done-archive' },
]);
// --- bedtime ------------------------------------------------------------------------------------
const bt = computed(() => labs.bedtime);
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
  api.motivation().then((m: Motivation) => { best.value = m.streak.best; }, () => { best.value = null; });
});
onBeforeUnmount(() => motivation.stop());
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
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.approachingCard.label') }}</span><span class="sub">{{ t('settings.calendar.approachingCard.hint') }}</span></div><Switch :model-value="labs.approachingCard" :label="t('settings.calendar.approachingCard.label')" data-testid="settings-approaching-card" @update:model-value="savePrefs({ approachingCard: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.approachBar.label') }}</span><span class="sub">{{ t('settings.calendar.approachBar.hint') }}</span></div><Switch :model-value="labs.approachBar" :label="t('settings.calendar.approachBar.label')" data-testid="settings-approach-bar" @update:model-value="savePrefs({ approachBar: $event })" /></div>
          <div class="row">
            <Select class="grow" :model-value="approachChoice" :options="approachWindows" :label="t('settings.calendar.approachWindow.label')" data-testid="settings-approach-window" @update:model-value="pickApproachWindow" />
            <TextField v-if="approachChoice === 'custom'" v-model="customHours" class="hours" type="number" inputmode="numeric" min="1" max="24" step="1" :label="t('settings.calendar.approachWindow.customLabel')" data-testid="settings-approach-window-custom" :error="customHoursError" @commit="commitCustomHours" />
          </div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.calendar.tasksCalendar.label') }}</span><span class="sub">{{ t('settings.calendar.tasksCalendar.hint') }}</span></div><Switch :model-value="labs.tasksCalendarVisible" :label="t('settings.calendar.tasksCalendar.label')" data-testid="settings-tasks-calendar-visible" @update:model-value="savePrefs({ tasksCalendarVisible: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.leftHanded.label') }}</span><span class="sub">{{ t('settings.leftHanded.hint') }}</span></div><Switch :model-value="labs.leftHanded" :label="t('settings.leftHanded.label')" data-testid="settings-left-handed" @update:model-value="savePrefs({ leftHanded: $event })" /></div>
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
          <div class="row col"><span class="lab">{{ t('settings.tasklists.undatedDone.label') }}</span><SegmentedButton :model-value="labs.undatedDone" :options="undatedDoneOptions" :label="t('settings.tasklists.undatedDone.label')" data-testid="settings-undated-done" @update:model-value="savePrefs({ undatedDone: $event as UndatedDone })" /></div>
          <div v-if="labs.taskCategories" class="row"><Button variant="tonal" data-testid="settings-category-add" @click="adding = true"><template #icon><IconAdd /></template>{{ t('settings.tasklists.addCategory') }}</Button></div>
        </section>

        <section id="s-motivation" class="card" data-testid="settings-section" data-section="motivation" aria-labelledby="h-focus">
          <h2 id="h-focus">{{ title('motivation') }}</h2>
          <div class="row col"><span class="lab">{{ t('settings.motivation.warnBefore') }}</span><SegmentedButton :model-value="String(s.transitionWarningMinutes)" :options="warns" :label="t('settings.motivation.transitionWarning')" data-testid="settings-transition-warning" @update:model-value="save({ transitionWarningMinutes: Number($event) as 0 | 5 | 10 | 15 })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.motivation.calmMode.label') }}</span><span class="sub">{{ t('settings.motivation.calmMode.hint') }}</span></div><Switch :model-value="s.calmMode" :label="t('settings.motivation.calmMode.label')" data-testid="settings-calm-mode" @update:model-value="save({ calmMode: $event })" /></div>
          <div class="row"><span class="lab grow">{{ t('settings.motivation.streakFlame') }}</span><Switch :model-value="s.streakFlame" :label="t('settings.motivation.streakFlame')" data-testid="settings-streak-flame" @update:model-value="save({ streakFlame: $event })" /></div>
          <div class="row"><span class="lab grow">{{ t('settings.plant') }}</span><Switch :model-value="s.plant" :label="t('settings.plant')" data-testid="settings-plant" @update:model-value="save({ plant: $event })" /></div>
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

        <section id="s-labs" class="card" data-testid="settings-section" data-section="labs" aria-labelledby="h-labs">
          <h2 id="h-labs">{{ title('labs') }}</h2>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.labs.experimental.label') }}</span><span class="sub">{{ t('settings.labs.experimental.hint') }}</span></div><Switch :model-value="labs.labs" :label="t('settings.labs.experimental.label')" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" /></div>
        </section>

        <section id="s-account" class="card" data-testid="settings-section" data-section="account" aria-labelledby="h-account">
          <h2 id="h-account">{{ title('account') }}</h2>
          <div v-if="auth.status === 'in'" class="row"><div class="grow"><span class="lab">{{ t('settings.account.signedIn') }}</span><span class="sub">{{ auth.email }}</span></div><Button variant="outlined" data-testid="settings-signout" @click="auth.signOut()">{{ t('settings.account.signOut') }}</Button></div>
          <div v-if="auth.calendarMissing" class="row"><div class="grow"><span class="lab">{{ t('settings.account.calendarAccess.label') }}</span><span class="sub">{{ t('settings.account.calendarAccess.hint') }}</span></div><Button variant="tonal" data-testid="settings-calendar-access" @click="auth.grantCalendar()">{{ t('settings.account.calendarAccess.grant') }}</Button></div>
          <div v-if="isMock" class="row"><div class="grow"><span class="lab">{{ t('settings.account.resetDemo.label') }}</span><span class="sub">{{ t('settings.account.resetDemo.hint') }}</span></div><Button variant="outlined" :disabled="resetting" data-testid="settings-reset-demo" @click="resetDemo">{{ t('settings.account.resetDemo.button') }}</Button></div>
          <div v-if="showIosInstall" class="row"><div class="grow"><span class="lab">{{ t('settings.account.installApp.label') }}</span><span class="sub">{{ t('settings.account.installApp.hint') }}</span></div><Button variant="tonal" data-testid="settings-install-app" @click="installing = true">{{ t('settings.account.installApp.button') }}</Button></div>
          <div v-if="!isIos" class="row"><div class="grow"><span class="lab">{{ t(androidAppLabelKey(isNativeApp())) }}</span><span class="sub">{{ t('settings.account.androidApp.hint') }}</span></div><Button variant="tonal" data-testid="settings-android-app" @click="downloadApk">{{ t('settings.account.androidApp.download') }}</Button></div>
          <div class="row"><div class="grow" data-testid="settings-version"><span class="lab">{{ t('settings.account.version', { version: build.version }) }}</span><span v-if="build.sha" class="sub">{{ build.sha }}</span></div></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.ownThemes.label') }}</span><span class="sub">{{ t('settings.ownThemes.hint') }}</span></div><Switch :model-value="labs.labsOwnThemes" :label="t('settings.ownThemes.label')" data-testid="settings-labs-own-themes" @update:model-value="savePrefs({ labsOwnThemes: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">{{ t('settings.account.versionCorner.label') }}</span><span class="sub">{{ t('settings.account.versionCorner.hint') }}</span></div><Switch :model-value="labs.versionInCorner" :label="t('settings.account.versionCorner.label')" data-testid="settings-version-corner" @update:model-value="savePrefs({ versionInCorner: $event })" /></div>
        </section>
      </div>
    </div>
    <IosInstallSheet v-if="installing" @close="installing = false" />
    <CategoryDialog v-if="adding" @close="adding = false" />
    <CategoryDialog v-if="editing" :category="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.layout { max-width: 900px; margin: 0 auto; }
.toc { display: none; }
@media (min-width: 900px) {
  .layout { display: grid; grid-template-columns: 200px minmax(0, 640px); gap: 24px; padding: 0 12px; justify-content: center; }
  .toc { display: flex; flex-direction: column; gap: 2px; position: sticky; top: calc(var(--safe-top) + 64px); align-self: start; padding-top: 4px; }
}
.tocitem { padding: 10px 16px; border-radius: var(--md-sys-shape-corner-full); color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); text-decoration: none; }
.tocitem:hover { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; width: 100%; margin: 0 auto; }
.card { scroll-margin-top: calc(var(--safe-top) + 64px); background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 4px 8px; }
h2 { margin: 0; padding: 12px 16px 4px; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 16px; min-height: 56px; }
.row.col { flex-direction: column; align-items: stretch; gap: 8px; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fw { width: 100%; }
.link { width: 100%; text-align: left; color: inherit; border-radius: var(--md-sys-shape-corner-large); }
.link:hover { background: var(--md-sys-color-surface-container-high); }
.sublab { display: block; padding: 4px 16px; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.note { margin: 0; padding: 0 16px; }
.hours { flex: none; width: 104px; }
.lab { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
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
