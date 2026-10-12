<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import IconBack from '~icons/material-symbols/arrow-back';
import IconUp from '~icons/material-symbols/keyboard-arrow-up';
import IconDown from '~icons/material-symbols/keyboard-arrow-down';
import IconAdd from '~icons/material-symbols/add';
import { api, ApiError } from '@/api/client';
import { EVENT_COLOR_OPTIONS, isHexColor, MORDOR_SEED, MSG_INVALID_COLOR, SEED_PRESETS } from '@/api/colors';
import type { AnimationLevel, ApproachWindowHours, Category, GardenStyle, Motivation, Prefs, SceneName, SupportCatSetting, ThemeMode, ViewName } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
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
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const settings = useSettingsStore();
const clock = useClockStore();
const auth = useAuthStore();
const sync = useSyncStore();
const ui = useUiStore();
const items = useItemsStore();
const s = computed(() => settings.settings);
const labs = usePrefsStore();

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

// --- appearance -------------------------------------------------------------------------
const modes = [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] as const;
const seed = computed(() => s.value.seedColor.toLowerCase());
const presetNames = SEED_PRESETS.map((p) => p.hex);
const isMordor = computed(() => seed.value === MORDOR_SEED);
const isCustom = computed(() => !presetNames.includes(seed.value) && !isMordor.value);
const swatches = computed(() => [
  ...SEED_PRESETS.map((p) => ({ value: p.hex, name: p.name, color: p.hex, testid: 'settings-seed-preset' })),
  { value: 'custom', name: 'Custom', color: isCustom.value ? seed.value : '#9e9e9e', testid: 'settings-seed-preset' },
]);
const swatchValue = computed(() => (isCustom.value ? 'custom' : isMordor.value ? null : seed.value));
const hex = ref(seed.value);
const hexError = ref('');
watch(seed, (v) => { hex.value = v; hexError.value = ''; });
function pickSwatch(v: string) {
  if (v === 'custom') { document.querySelector<HTMLInputElement>('[data-testid="settings-seed-custom"]')?.focus(); return; }
  void save({ seedColor: v });
}
function commitHex() {
  const v = hex.value.trim();
  if (!isHexColor(v)) { hexError.value = MSG_INVALID_COLOR; return; }
  hexError.value = '';
  if (v.toLowerCase() !== seed.value) void save({ seedColor: v.toLowerCase() });
}

const scenes = [{ value: 'sunflowers', label: 'Sunflower field' }, { value: 'mordor', label: 'Mordor' }, { value: 'none', label: 'None' }] as const;
const views = [{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }] as const;
const colorOptions = [{ value: '', label: 'Calendar color' }, ...EVENT_COLOR_OPTIONS.map((c) => ({ value: c.id, label: c.name }))];
const approachWindows = [{ value: '3', label: '3 hours' }, { value: '6', label: '6 hours' }, { value: '12', label: '12 hours' }] as const;
const levels = [{ value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }] as const;
const warns = [{ value: '0', label: 'Off' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }] as const;
const gardens = [{ value: 'plant', label: 'Single plant' }, { value: 'sunflowers', label: 'Sunflower field' }, { value: 'off', label: 'Off' }] as const;
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
    <div class="content">
      <section class="card" aria-labelledby="h-appearance">
        <h2 id="h-appearance">Appearance</h2>
        <div class="row">
          <div class="grow"><span class="lab">Theme</span><span class="sub">Ready themes, glow, entries, corners and scene</span></div>
          <Button variant="tonal" data-testid="settings-theme" @click="router.push('/settings/theme')">Open</Button>
        </div>
        <div class="row col">
          <span class="lab">Theme mode</span>
          <SegmentedButton :model-value="s.themeMode" :options="[...modes]" label="Theme mode" data-testid="settings-theme-mode" @update:model-value="save({ themeMode: $event as ThemeMode })" />
        </div>
        <div class="row col">
          <span class="lab">Seed color</span>
          <ColorSwatchPicker :swatches="swatches" :model-value="swatchValue" label="Seed color" @update:model-value="pickSwatch" />
          <TextField v-model="hex" label="Custom color (hex)" data-testid="settings-seed-custom" :error="hexError" error-testid="settings-seed-error" autocomplete="off" autocapitalize="off" @commit="commitHex" />
        </div>
        <div class="row">
          <div class="grow"><span class="lab">Mordor</span><span class="sub">Ember seed, dark mode and the Mordor scene</span></div>
          <Button :variant="isMordor && s.themeMode === 'dark' ? 'filled' : 'tonal'" data-testid="settings-theme-mordor" :aria-pressed="isMordor" data-name="Mordor" :data-color="MORDOR_SEED" @click="settings.applyMordor().catch((e) => sync.reportError(e))">
            {{ isMordor ? 'Active' : 'Use Mordor' }}
          </Button>
        </div>
        <div class="row col">
          <span class="lab">Top bar scene</span>
          <SegmentedButton :model-value="settings.scene" :options="[...scenes]" label="Top bar scene" data-testid="settings-scene" @update:model-value="save({ scene: $event as SceneName })" />
        </div>
      </section>

      <section class="card" aria-labelledby="h-labs">
        <h2 id="h-labs">Labs</h2>
        <div class="row"><div class="grow"><span class="lab">Experimental views</span><span class="sub">Clock, Timeline and Strip in the view switcher</span></div><Switch :model-value="labs.labs" label="Experimental views" data-testid="settings-labs" @update:model-value="savePrefs({ labs: $event })" /></div>
        <div class="row"><div class="grow"><span class="lab">Approach bar</span><span class="sub">What comes next today as a track in the now card</span></div><Switch :model-value="labs.approachBar" label="Approach bar" data-testid="settings-approach-bar" @update:model-value="savePrefs({ approachBar: $event })" /></div>
        <div class="row"><Select class="fw" :model-value="String(labs.approachWindowHours)" :options="[...approachWindows]" label="Approach bar reaches ahead" data-testid="settings-approach-window" @update:model-value="savePrefs({ approachWindowHours: Number($event) as ApproachWindowHours })" /></div>
      </section>

      <section class="card" aria-labelledby="h-cal">
        <h2 id="h-cal">Calendar</h2>
        <div class="row"><Select class="fw" :model-value="s.defaultView" :options="[...views]" label="Default view" data-testid="settings-default-view" @update:model-value="save({ defaultView: $event as ViewName })" /></div>
        <div class="row"><Select class="fw" :model-value="s.defaultEventColorId ?? ''" :options="colorOptions" label="Default event color" data-testid="settings-default-event-color" @update:model-value="save({ defaultEventColorId: $event || null })" /></div>
        <div class="row"><div class="grow"><span class="lab">Show tasks calendar in Google</span><span class="sub">Task lists stay in the app either way</span></div><Switch :model-value="labs.tasksCalendarVisible" label="Show tasks calendar in Google" data-testid="settings-tasks-calendar-visible" @update:model-value="savePrefs({ tasksCalendarVisible: $event })" /></div>
      </section>

      <section class="card" aria-labelledby="h-focus">
        <h2 id="h-focus">Motion and motivation</h2>
        <div class="row col"><span class="lab">Animations</span><SegmentedButton :model-value="s.animationLevel" :options="[...levels]" label="Animations" data-testid="settings-animation-level" @update:model-value="save({ animationLevel: $event as AnimationLevel })" /></div>
        <p v-if="systemReducedMotion" class="sub" data-testid="settings-system-reduced-motion">Your device asks for less motion, so animations are capped at Reduced.</p>
        <div class="row"><div class="grow"><span class="lab">Ignore the device setting</span><span class="sub">Use the animation level above even if the device asks for less motion</span></div><Switch :model-value="s.ignoreSystemMotion" label="Ignore the device setting" data-testid="settings-ignore-system-motion" @update:model-value="save({ ignoreSystemMotion: $event })" /></div>
        <div class="row"><span class="lab grow">Sounds</span><Switch :model-value="s.sounds" label="Sounds" data-testid="settings-sounds" @update:model-value="save({ sounds: $event })" /></div>
        <div class="row"><div class="grow"><span class="lab">Calm mode</span><span class="sub">Fewer details, quieter colors, reduced motion</span></div><Switch :model-value="s.calmMode" label="Calm mode" data-testid="settings-calm-mode" @update:model-value="save({ calmMode: $event })" /></div>
        <div class="row col"><span class="lab">Warn before an event starts</span><SegmentedButton :model-value="String(s.transitionWarningMinutes)" :options="[...warns]" label="Transition warning" data-testid="settings-transition-warning" @update:model-value="save({ transitionWarningMinutes: Number($event) as 0 | 5 | 10 | 15 })" /></div>
        <div class="row"><span class="lab grow">Streak flame</span><Switch :model-value="s.streakFlame" label="Streak flame" data-testid="settings-streak-flame" @update:model-value="save({ streakFlame: $event })" /></div>
        <div class="row col"><span class="lab">Garden</span><SegmentedButton :model-value="s.garden" :options="[...gardens]" label="Garden" data-testid="settings-garden" @update:model-value="save({ garden: $event as GardenStyle })" /></div>
        <div class="row col"><span class="lab">Support cat</span><SegmentedButton :model-value="labs.supportCat" :options="[...supportCats]" label="Support cat" data-testid="settings-support-cat" @update:model-value="savePrefs({ supportCat: $event as SupportCatSetting })" /></div>
        <div v-if="currentStreak !== null" class="row"><span class="lab grow">Current streak</span><StreakFlame :count="currentStreak" /></div>
        <div class="row"><span class="lab grow">Best streak</span><span class="val" data-testid="settings-best-streak">{{ best ?? '–' }}</span></div>
      </section>

      <section class="card" aria-labelledby="h-cats">
        <h2 id="h-cats">Task list categories</h2>
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

      <section v-if="auth.status === 'in'" class="card" aria-labelledby="h-account">
        <h2 id="h-account">Account</h2>
        <div class="row"><div class="grow"><span class="lab">Signed in with Google</span><span class="sub">{{ auth.email }}</span></div><Button variant="outlined" data-testid="settings-signout" @click="auth.signOut()">Sign out</Button></div>
      </section>

      <section v-if="isMock" class="card" aria-labelledby="h-data">
        <h2 id="h-data">Demo data</h2>
        <div class="row"><div class="grow"><span class="lab">Reset demo data</span><span class="sub">Replaces the mock calendar with fresh demo events</span></div><Button variant="outlined" :disabled="resetting" data-testid="settings-reset-demo" @click="resetDemo">Reset</Button></div>
      </section>
    </div>
    <CategoryDialog v-if="adding" @close="adding = false" />
    <CategoryDialog v-if="editing" :category="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 4px 8px; }
h2 { margin: 0; padding: 12px 16px 4px; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 16px; min-height: 56px; }
.row.col { flex-direction: column; align-items: stretch; gap: 8px; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fw { width: 100%; }
.lab { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.val { font: var(--md-sys-typescale-title-medium); }
.cats { list-style: none; margin: 0; padding: 0; }
.cat { display: flex; align-items: center; padding: 0 8px 0 16px; }
.catmain { flex: 1; min-height: 52px; display: flex; align-items: center; gap: 10px; text-align: left; min-width: 0; }
.dot { width: 16px; height: 16px; border-radius: 50%; flex: none; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--md-sys-typescale-body-large); }
</style>
