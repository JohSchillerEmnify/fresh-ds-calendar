<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import IconBack from '~icons/material-symbols/arrow-back';
import IconUp from '~icons/material-symbols/keyboard-arrow-up';
import IconDown from '~icons/material-symbols/keyboard-arrow-down';
import IconAdd from '~icons/material-symbols/add';
import IconNext from '~icons/material-symbols/chevron-right';
import { api, ApiError } from '@/api/client';
import { EVENT_COLOR_OPTIONS } from '@/api/colors';
import type { AnimationLevel, ApproachWindowHours, Category, Motivation, Prefs, SunflowersMode, SupportCatSetting, ViewName } from '@/api/types';
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
/** The Theme row's value: the preset name, for Automatic with the seasonal theme in use ("Automatic · Fall"). */
const themeLabel = computed(() => (theme.pref.preset === 'Automatic' ? `Automatic · ${theme.resolved.name}` : theme.pref.preset));
const build = shownVersion();

/** Persist a per-person preference (Labs switch, support cat, tasks calendar); a refusal rolls back in the store and shows a snackbar. */
async function savePrefs(p: Partial<Prefs>) {
  try { await labs.set(p); } catch (e) { ui.notify(e instanceof ApiError ? e.userMessage : 'Could not save settings'); }
}

/** Persist a patch; failures roll back in the store and surface as the banner or a snackbar. */
async function save(p: Parameters<typeof settings.patch>[0]) {
  try {
    await settings.patch(p);
  } catch (e) {
    if (e instanceof ApiError && e.isUnavailable) sync.reportError(e);
    else ui.notify(e instanceof ApiError ? e.userMessage : 'Could not save settings');
  }
}

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/');
}

// --- sections -------------------------------------------------------------------------------
/** Every setting lives in exactly one section (ARCHITECTURE "Settings"); the desktop list links to them. */
const sections = [
  { id: 'appearance', title: 'Appearance' },
  { id: 'calendar', title: 'Calendar' },
  { id: 'tasklists', title: 'Task lists' },
  { id: 'motivation', title: 'Focus & motivation' },
  { id: 'motion', title: 'Motion & sound' },
  { id: 'labs', title: 'Labs' },
  { id: 'account', title: 'Account & data' },
] as const;
type SectionId = (typeof sections)[number]['id'];
const title = (id: SectionId) => sections.find((x) => x.id === id)!.title;
/** Scrolls inside the page instead of changing the URL hash (the router owns the URL). */
function jump(id: SectionId) {
  document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const views = [{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }] as const;
const colorOptions = [{ value: '', label: 'Calendar color' }, ...EVENT_COLOR_OPTIONS.map((c) => ({ value: c.id, label: c.name }))];
/** 3, 6 and 12 hours, plus "Custom…" which reveals the hours field. */
const PRESET_WINDOWS = [3, 6, 12];
const approachWindows = [...PRESET_WINDOWS.map((v) => ({ value: String(v), label: `${v} hours` })), { value: 'custom', label: 'Custom…' }];
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
  if (!Number.isInteger(h) || h < 1 || h > 24) { customHoursError.value = 'Enter a whole number from 1 to 24'; return; }
  customHoursError.value = '';
  if (h !== labs.approachWindowHours) void savePrefs({ approachWindowHours: h });
}
const levels = [{ value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }] as const;
const warns = [{ value: '0', label: 'Off' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }] as const;
const sunflowerModes = [{ value: 'grow', label: 'Grow with points' }, { value: 'full', label: 'Full field' }] as const;
const supportCats = [{ value: 'off', label: 'Off' }, { value: 'sometimes', label: 'Sometimes' }, { value: 'always', label: 'Every time' }] as const;

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
    ui.notify('Demo data restored');
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : 'Could not reset demo data');
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <section class="page" data-testid="settings-view">
    <header class="bar">
      <IconButton label="Back" data-testid="settings-back" @click="back"><IconBack /></IconButton>
      <h1>Settings</h1>
    </header>
    <div class="layout">
      <nav class="toc" aria-label="Settings sections" data-testid="settings-toc">
        <a v-for="x in sections" :key="x.id" :href="`#s-${x.id}`" class="tocitem" @click.prevent="jump(x.id)">{{ x.title }}</a>
      </nav>
      <div class="content">
        <section id="s-appearance" class="card" data-testid="settings-section" data-section="appearance" aria-labelledby="h-appearance">
          <h2 id="h-appearance">{{ title('appearance') }}</h2>
          <button type="button" class="row link" data-testid="settings-theme" @click="router.push('/settings/theme')">
            <span class="grow"><span class="lab">Theme</span><span class="sub">Mode, colour, glow, entries, corners and scene</span></span>
            <span class="val" data-testid="settings-theme-name">{{ themeLabel }}</span>
            <IconNext aria-hidden="true" />
          </button>
        </section>

        <section id="s-calendar" class="card" data-testid="settings-section" data-section="calendar" aria-labelledby="h-cal">
          <h2 id="h-cal">{{ title('calendar') }}</h2>
          <div class="row"><Select class="fw" :model-value="s.defaultView" :options="[...views]" label="Default view" data-testid="settings-default-view" @update:model-value="save({ defaultView: $event as ViewName })" /></div>
          <div class="row"><Select class="fw" :model-value="s.defaultEventColorId ?? ''" :options="colorOptions" label="Default event color" data-testid="settings-default-event-color" @update:model-value="save({ defaultEventColorId: $event || null })" /></div>
          <div class="row"><div class="grow"><span class="lab">Approaching card</span><span class="sub">What is on now and next, above the calendar</span></div><Switch :model-value="labs.approachingCard" label="Approaching card" data-testid="settings-approaching-card" @update:model-value="savePrefs({ approachingCard: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">Approaching track</span><span class="sub">What comes next today as a track in the Approaching card</span></div><Switch :model-value="labs.approachBar" label="Approaching track" data-testid="settings-approach-bar" @update:model-value="savePrefs({ approachBar: $event })" /></div>
          <div class="row">
            <Select class="grow" :model-value="approachChoice" :options="approachWindows" label="Track reaches ahead" data-testid="settings-approach-window" @update:model-value="pickApproachWindow" />
            <TextField v-if="approachChoice === 'custom'" v-model="customHours" class="hours" type="number" inputmode="numeric" min="1" max="24" step="1" label="Hours" data-testid="settings-approach-window-custom" :error="customHoursError" @commit="commitCustomHours" />
          </div>
          <div class="row"><div class="grow"><span class="lab">Show tasks calendar in Google</span><span class="sub">Task lists stay in the app either way</span></div><Switch :model-value="labs.tasksCalendarVisible" label="Show tasks calendar in Google" data-testid="settings-tasks-calendar-visible" @update:model-value="savePrefs({ tasksCalendarVisible: $event })" /></div>
          <div class="row"><div class="grow"><span class="lab">Left-handed mode</span><span class="sub">Mirrors the phone layout so the main controls sit under the left thumb</span></div><Switch :model-value="labs.leftHanded" label="Left-handed mode" data-testid="settings-left-handed" @update:model-value="savePrefs({ leftHanded: $event })" /></div>
        </section>

        <section id="s-tasklists" class="card" data-testid="settings-section" data-section="tasklists" aria-labelledby="h-cats">
          <h2 id="h-cats">{{ title('tasklists') }}</h2>
          <span class="lab sublab">Categories</span>
          <ul class="cats">
            <li v-for="(c, i) in settings.categories" :key="c.id" class="cat" data-testid="settings-category" :data-category-id="c.id" :data-name="c.name" :data-color="c.color">
              <button class="catmain" type="button" :aria-label="`Edit ${c.name}`" @click="editing = c">
                <i class="dot" :style="{ background: c.color }" /><span v-if="c.icon" class="em">{{ c.icon }}</span><span class="nm">{{ c.name }}</span>
              </button>
              <IconButton :label="`Move ${c.name} up`" :disabled="i === 0" data-testid="settings-category-up" @click="move(c.id, -1)"><IconUp /></IconButton>
              <IconButton :label="`Move ${c.name} down`" :disabled="i === settings.categories.length - 1" data-testid="settings-category-down" @click="move(c.id, 1)"><IconDown /></IconButton>
            </li>
          </ul>
          <div class="row"><Button variant="tonal" data-testid="settings-category-add" @click="adding = true"><template #icon><IconAdd /></template>Add category</Button></div>
        </section>

        <section id="s-motivation" class="card" data-testid="settings-section" data-section="motivation" aria-labelledby="h-focus">
          <h2 id="h-focus">{{ title('motivation') }}</h2>
          <div class="row col"><span class="lab">Warn before an event starts</span><SegmentedButton :model-value="String(s.transitionWarningMinutes)" :options="[...warns]" label="Transition warning" data-testid="settings-transition-warning" @update:model-value="save({ transitionWarningMinutes: Number($event) as 0 | 5 | 10 | 15 })" /></div>
          <div class="row"><div class="grow"><span class="lab">Calm mode</span><span class="sub">Fewer details, quieter colors, reduced motion</span></div><Switch :model-value="s.calmMode" label="Calm mode" data-testid="settings-calm-mode" @update:model-value="save({ calmMode: $event })" /></div>
          <div class="row"><span class="lab grow">Streak flame</span><Switch :model-value="s.streakFlame" label="Streak flame" data-testid="settings-streak-flame" @update:model-value="save({ streakFlame: $event })" /></div>
          <div class="row"><span class="lab grow">Plant</span><Switch :model-value="s.plant" label="Plant" data-testid="settings-plant" @update:model-value="save({ plant: $event })" /></div>
          <div class="row col"><span class="lab">Sunflowers</span><SegmentedButton :model-value="s.sunflowers" :options="[...sunflowerModes]" label="Sunflowers" data-testid="settings-sunflowers" @update:model-value="save({ sunflowers: $event as SunflowersMode })" /></div>
          <div v-if="currentStreak !== null" class="row"><span class="lab grow">Current streak</span><StreakFlame :count="currentStreak" /></div>
          <div class="row"><span class="lab grow">Best streak</span><span class="val" data-testid="settings-best-streak">{{ best ?? '–' }}</span></div>
          <div class="row col"><span class="lab">Support cat</span><SegmentedButton :model-value="labs.supportCat" :options="[...supportCats]" label="Support cat" data-testid="settings-support-cat" @update:model-value="savePrefs({ supportCat: $event as SupportCatSetting })" /></div>
        </section>

        <section id="s-motion" class="card" data-testid="settings-section" data-section="motion" aria-labelledby="h-motion">
          <h2 id="h-motion">{{ title('motion') }}</h2>
          <div class="row col"><span class="lab">Animations</span><SegmentedButton :model-value="s.animationLevel" :options="[...levels]" label="Animations" data-testid="settings-animation-level" @update:model-value="save({ animationLevel: $event as AnimationLevel })" /></div>
          <p v-if="systemReducedMotion" class="sub note" data-testid="settings-system-reduced-motion">Your device asks for less motion, so animations are capped at Reduced.</p>
          <div class="row"><div class="grow"><span class="lab">Ignore the device setting</span><span class="sub">Use the animation level above even if the device asks for less motion</span></div><Switch :model-value="s.ignoreSystemMotion" label="Ignore the device setting" data-testid="settings-ignore-system-motion" @update:model-value="save({ ignoreSystemMotion: $event })" /></div>
          <div class="row"><span class="lab grow">Sounds</span><Switch :model-value="s.sounds" label="Sounds" data-testid="settings-sounds" @update:model-value="save({ sounds: $event })" /></div>
        </section>

        <section id="s-labs" class="card" data-testid="settings-section" data-section="labs" aria-labelledby="h-labs">
          <h2 id="h-labs">{{ title('labs') }}</h2>
          <div class="row"><div class="grow"><span class="lab">Experimental views</span><span class="sub">Clock, Timeline and Strip in the view switcher</span></div><Switch :model-value="labs.labs" label="Experimental views" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" /></div>
        </section>

        <section id="s-account" class="card" data-testid="settings-section" data-section="account" aria-labelledby="h-account">
          <h2 id="h-account">{{ title('account') }}</h2>
          <div v-if="auth.status === 'in'" class="row"><div class="grow"><span class="lab">Signed in with Google</span><span class="sub">{{ auth.email }}</span></div><Button variant="outlined" data-testid="settings-signout" @click="auth.signOut()">Sign out</Button></div>
          <div v-if="isMock" class="row"><div class="grow"><span class="lab">Reset demo data</span><span class="sub">Replaces the mock calendar with fresh demo events</span></div><Button variant="outlined" :disabled="resetting" data-testid="settings-reset-demo" @click="resetDemo">Reset</Button></div>
          <div class="row"><div class="grow" data-testid="settings-version"><span class="lab">Version {{ build.version }}</span><span v-if="build.sha" class="sub">{{ build.sha }}</span></div></div>
          <div class="row"><div class="grow"><span class="lab">Show version in the corner</span><span class="sub">A small label in a bottom corner</span></div><Switch :model-value="labs.versionInCorner" label="Show version in the corner" data-testid="settings-version-corner" @update:model-value="savePrefs({ versionInCorner: $event })" /></div>
        </section>
      </div>
    </div>
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
/* Left-handed mode (phone): the switch or trailing control at the left start of the row, the label after it. */
@media (max-width: 767.98px) {
  html[data-hand='left'] .row:not(.col, .link) { flex-direction: row-reverse; }
  html[data-hand='left'] .cat { flex-direction: row-reverse; padding: 0 16px 0 8px; }
}
</style>
