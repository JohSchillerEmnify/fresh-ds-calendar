<script setup lang="ts">
/**
 * Theme menu (`/settings/theme`): a gallery of ready themes (each a real mini week under that theme's attributes),
 * fine-tuning options that each show a sample of their look, and a live preview. Picking applies at once and is
 * saved in the background by the theme store; there is no save button. Theme mode, seed colour, top bar scene and
 * the Mordor shortcut are settings (`PATCH /api/settings`) that live only here (ARCHITECTURE "Settings").
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import IconBack from '~icons/material-symbols/arrow-back';
import { ApiError } from '@/api/client';
import { isHexColor, MORDOR_SEED, MSG_INVALID_COLOR, SEED_PRESETS } from '@/api/colors';
import type { SceneName, ThemeMode } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import TextField from '@/components/m3/TextField.vue';
import ThemeSample from '@/components/settings/ThemeSample.vue';
import SeasonScene from '@/features/motivation/SeasonScene.vue';
import { useClockStore } from '@/stores/clock';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { resolveTheme as resolveMode } from '@/theme';
import { PRESET_NAMES, presetFor, type PresetName, type ThemeAttrs } from '@/theme/presets';

const router = useRouter();
const theme = useThemeStore();
const settings = useSettingsStore();
const clock = useClockStore();
const attrs = computed(() => theme.resolved.attrs);
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The color library loads lazily; until then the cards show the current palette. */
const scheme = shallowRef<typeof import('@/theme/scheme') | null>(null);
onMounted(async () => { scheme.value = await import('@/theme/scheme'); });

/** Color roles of a preset, applied to its gallery card only. */
function cardStyle(name: PresetName): Record<string, string> {
  const p = presetFor(name, clock.today);
  const dark = resolveMode(p.mode ?? settings.settings.themeMode) === 'dark';
  if (!scheme.value) return {};
  return { ...scheme.value.schemeVars(p.seed ?? settings.settings.seedColor, dark), colorScheme: dark ? 'dark' : 'light' };
}

const groups: { setting: keyof ThemeAttrs; label: string; options: { value: string; label: string }[] }[] = [
  { setting: 'glow', label: 'Glow', options: [{ value: 'off', label: 'Off' }, { value: 'soft', label: 'Soft' }, { value: 'neon', label: 'Neon' }] },
  { setting: 'entries', label: 'Entries', options: [{ value: 'solid', label: 'Solid' }, { value: 'tinted', label: 'Tinted' }, { value: 'outline', label: 'Outline' }] },
  { setting: 'corners', label: 'Corners', options: [{ value: 'square', label: 'Square' }, { value: 'round', label: 'Round' }, { value: 'pill', label: 'Pill' }] },
  { setting: 'scene', label: 'Scene', options: [{ value: 'none', label: 'None' }, { value: 'mordor', label: 'Mordor' }, { value: 'season', label: 'Season' }] },
];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const isSeason = (s: string) => SEASONS.includes(s);

function pressed(setting: keyof ThemeAttrs, value: string): boolean {
  const cur = attrs.value[setting];
  return setting === 'scene' && value === 'season' ? isSeason(cur) : cur === value;
}
function pickOption(setting: keyof ThemeAttrs, value: string) {
  if (setting === 'scene') void theme.pick('scene', (value === 'season' ? theme.todaysSeasonScene : value) as ThemeAttrs['scene']);
  else void theme.pick(setting, value as never);
}
/** Attributes for an option's sample: the current look with this one option swapped in. */
function sampleAttrs(setting: keyof ThemeAttrs, value: string): Record<string, string> {
  const a: Record<string, string> = { 'data-glow': attrs.value.glow, 'data-entries': attrs.value.entries, 'data-corners': attrs.value.corners };
  if (setting !== 'scene') a[`data-${setting}`] = value;
  return a;
}
const sceneOf = (value: string) => (value === 'season' ? theme.todaysSeasonScene : value);

// --- mode, seed colour, top bar scene, Mordor (settings, not theme prefs) ---------------------------
const sync = useSyncStore();
const ui = useUiStore();
const s = computed(() => settings.settings);
/** Persist a patch; failures roll back in the store and surface as the banner or a snackbar. */
async function save(p: Parameters<typeof settings.patch>[0]) {
  try {
    await settings.patch(p);
  } catch (e) {
    if (e instanceof ApiError && e.isUnavailable) sync.reportError(e);
    else ui.notify(e instanceof ApiError ? e.userMessage : 'Could not save settings');
  }
}
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

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/settings');
}
</script>

<template>
  <section class="page" data-testid="theme-view">
    <header class="bar">
      <IconButton label="Back" data-testid="theme-back" @click="back"><IconBack /></IconButton>
      <h1>Theme</h1>
    </header>
    <div class="content">
      <section class="card preview" aria-labelledby="h-prev" data-testid="theme-preview">
        <h2 id="h-prev">Preview</h2>
        <div class="stage">
          <div class="pv"><ThemeSample kind="event" title="Dentist" data-testid="theme-preview-event" /></div>
          <div class="pv"><ThemeSample kind="tasklist" color="#0b8043" title="Groceries" /></div>
          <div class="pv cbs"><ThemeSample kind="checkbox" color="#3f51b5" checked /><ThemeSample kind="checkbox" color="#3f51b5" /></div>
        </div>
      </section>

      <section class="card" aria-labelledby="h-gal">
        <h2 id="h-gal">Themes</h2>
        <div class="gallery">
          <button
            v-for="n in PRESET_NAMES" :key="n" type="button" class="tcard" data-testid="theme-card" :data-name="n" :aria-pressed="theme.pref.preset === n"
            @click="theme.choose(n)"
          >
            <span
              class="scope" :style="cardStyle(n)" :data-glow="presetFor(n, clock.today).attrs.glow" :data-entries="presetFor(n, clock.today).attrs.entries"
              :data-corners="presetFor(n, clock.today).attrs.corners" :data-scene="presetFor(n, clock.today).attrs.scene" aria-hidden="true"
            >
              <span class="hdr" :class="{ ember: presetFor(n, clock.today).attrs.scene === 'mordor' }">
                <SeasonScene v-if="isSeason(presetFor(n, clock.today).attrs.scene)" :season="presetFor(n, clock.today).attrs.scene as 'spring'" />
                <span v-for="(d, i) in DAYS" :key="i" class="day">{{ d }}</span>
              </span>
              <span class="mini">
                <ThemeSample kind="event" color="var(--md-sys-color-primary)" on="var(--md-sys-color-on-primary)" title="Meet" class="m1" />
                <ThemeSample kind="tasklist" color="var(--md-sys-color-tertiary)" on="var(--md-sys-color-on-tertiary)" title="To-do" class="m2" />
              </span>
            </span>
            <span class="nm">{{ n }}<small v-if="n === 'Automatic'"> · {{ presetFor(n, clock.today).name }}</small></span>
          </button>
        </div>
      </section>

      <section class="card" aria-labelledby="h-fine">
        <h2 id="h-fine">Fine-tuning</h2>
        <div class="group">
          <span class="lab">Theme mode</span>
          <SegmentedButton :model-value="s.themeMode" :options="[...modes]" label="Theme mode" data-testid="settings-theme-mode" @update:model-value="save({ themeMode: $event as ThemeMode })" />
        </div>
        <div class="group">
          <span class="lab">Seed color</span>
          <ColorSwatchPicker :swatches="swatches" :model-value="swatchValue" label="Seed color" @update:model-value="pickSwatch" />
          <TextField v-model="hex" class="hex" label="Custom color (hex)" data-testid="settings-seed-custom" :error="hexError" error-testid="settings-seed-error" autocomplete="off" autocapitalize="off" @commit="commitHex" />
        </div>
        <div v-for="g in groups" :key="g.setting" class="group" role="group" :aria-label="g.label">
          <span class="lab">{{ g.label }}</span>
          <div class="opts">
            <button
              v-for="o in g.options" :key="o.value" type="button" class="opt" data-testid="theme-option" :data-setting="g.setting" :data-value="o.value"
              :aria-pressed="pressed(g.setting, o.value)" @click="pickOption(g.setting, o.value)"
            >
              <span v-if="g.setting !== 'scene'" class="sample" v-bind="sampleAttrs(g.setting, o.value)"><ThemeSample kind="event" title="Dentist" /></span>
              <span v-else class="sample scenebox" v-bind="sampleAttrs(g.setting, o.value)">
                <span class="back" :class="[`b-${sceneOf(o.value)}`]"><SeasonScene v-if="isSeason(sceneOf(o.value))" :season="sceneOf(o.value) as 'spring'" /></span>
                <ThemeSample kind="event" title="Dentist" />
              </span>
              <span class="ol">{{ o.label }}</span>
            </button>
          </div>
        </div>
        <div class="group">
          <span class="lab">Top bar scene</span>
          <SegmentedButton :model-value="settings.scene" :options="[...scenes]" label="Top bar scene" data-testid="settings-scene" @update:model-value="save({ scene: $event as SceneName })" />
        </div>
        <div class="group mordor">
          <span class="grow"><span class="lab">Mordor</span><span class="sub">Ember seed, dark mode and the Mordor scene</span></span>
          <Button :variant="isMordor && s.themeMode === 'dark' ? 'filled' : 'tonal'" data-testid="settings-theme-mordor" :aria-pressed="isMordor" data-name="Mordor" :data-color="MORDOR_SEED" @click="settings.applyMordor().catch((e) => sync.reportError(e))">
            {{ isMordor ? 'Active' : 'Use Mordor' }}
          </Button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 720px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 12px 14px; }
h2 { margin: 0; padding: 12px 4px 8px; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); }
.stage { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; align-items: start; padding: 14px; border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-surface); }
.pv { display: flex; flex-direction: column; min-width: 0; }
.cbs { flex-direction: row; gap: 12px; align-items: center; }

.gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 560px) { .gallery { grid-template-columns: repeat(4, 1fr); } }
.tcard { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 6px; border-radius: var(--md-sys-shape-corner-large); border: 2px solid transparent; background: var(--md-sys-color-surface-container); transition: border-color 150ms, transform 150ms var(--md-sys-motion-spring), box-shadow 150ms; }
.tcard:hover { transform: translateY(-1px); }
.tcard[aria-pressed='true'] { border-color: var(--md-sys-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent); }
.scope { display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-medium); overflow: hidden; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); height: 104px; }
.hdr { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); padding: 4px 4px 3px; font-size: 9px; text-align: center; background: var(--md-sys-color-surface-container-high); overflow: hidden; }
.hdr.ember { background: linear-gradient(90deg, #3b0d00, #c43e00 60%, #ff8f00); color: #ffd7b0; }
.day { position: relative; }
.mini { position: relative; flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 7px 6px; min-height: 0; }
.mini .m1 { width: 62%; margin-left: 14%; font-size: 10px; }
.mini .m2 { width: 66%; margin-left: 30%; }
.mini .m2 :deep(.it:nth-of-type(n + 3)) { display: none; }
.nm { font: var(--md-sys-typescale-label-large); padding: 0 4px 2px; }
.nm small { font-weight: 400; color: var(--md-sys-color-on-surface-variant); }

.group { padding: 4px 0 8px; }
.lab { display: block; font: var(--md-sys-typescale-body-large); padding: 4px 4px 6px; }
.opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.opt { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 8px; border-radius: var(--md-sys-shape-corner-medium); border: 2px solid transparent; background: var(--md-sys-color-surface-container); text-align: center; transition: border-color 150ms, box-shadow 150ms; }
.opt[aria-pressed='true'] { border-color: var(--md-sys-color-primary); background: color-mix(in srgb, var(--md-sys-color-primary) 10%, var(--md-sys-color-surface-container)); }
.sample { display: flex; align-items: center; justify-content: center; min-height: 40px; border-radius: var(--md-sys-shape-corner-small); background: var(--md-sys-color-surface); padding: 6px; min-width: 0; overflow: hidden; }
.sample :deep(.s-ev) { font-size: 11px; padding: 2px 8px; gap: 5px; }
.scenebox { position: relative; }
.back { position: absolute; inset: 0; overflow: hidden; }
.b-mordor { background: linear-gradient(90deg, #3b0d00, #c43e00 60%, #ff8f00); }
.scenebox :deep(.s-ev) { position: relative; }
.ol { font: var(--md-sys-typescale-label-large); }
.hex { margin-top: 10px; }
.mordor { display: flex; align-items: center; gap: 12px; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); padding: 0 4px; }
</style>
