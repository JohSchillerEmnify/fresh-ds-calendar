<script setup lang="ts">
/**
 * Theme menu (`/settings/theme`): a live preview and three sections, in this order: Presets (a gallery of ready
 * themes, each a real mini week under that theme's attributes), Scene (the top bar background, one choice) and
 * Fine-tuning (theme mode, seed colour and options that each show a sample of their look). Picking applies at once
 * and is saved in the background by the theme store; there is no save button. The scene is a theme attribute. Theme
 * mode and seed colour are settings (`PATCH /api/settings`) that live only here (ARCHITECTURE "Settings").
 */
import { createReusableTemplate } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import IconBack from '~icons/material-symbols/arrow-back';
import IconDelete from '~icons/material-symbols/delete-outline';
import IconExport from '~icons/material-symbols/download';
import { ApiError, type StoredTheme } from '@/api/client';
import { isHexColor, MORDOR_SEED, MSG_INVALID_COLOR, SEED_PRESETS } from '@/api/colors';
import type { ThemeMode } from '@/api/types';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import TextField from '@/components/m3/TextField.vue';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import ThemeImport from '@/components/settings/ThemeImport.vue';
import ThemeSample from '@/components/settings/ThemeSample.vue';
import SeasonScene from '@/features/motivation/SeasonScene.vue';
import { useClockStore } from '@/stores/clock';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { docToResolved, PRESET_NAMES, resolveTheme, type PresetName, type ResolvedTheme, type ThemeAttrs } from '@/theme/presets';

const router = useRouter();
const theme = useThemeStore();
const settings = useSettingsStore();
const clock = useClockStore();
const pending = usePendingDeletesStore();
const attrs = computed(() => theme.resolved.attrs);

/** Every preset as the gallery shows it today (Automatic = the season's). */
const presetThemes = computed(() => Object.fromEntries(PRESET_NAMES.map((n) => [n, resolveTheme({ preset: n, overrides: {} }, clock.today)])) as Record<PresetName, ResolvedTheme>);

/** Downloads a theme's document as a `.json` file. */
function exportTheme(t: StoredTheme) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(t.doc, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${t.doc.name.replace(/[^\w-]+/g, '-')}.theme.json` });
  a.click();
  URL.revokeObjectURL(url);
}

const groups: { setting: keyof ThemeAttrs; label: string; options: { value: string; label: string }[] }[] = [
  { setting: 'glow', label: 'Glow', options: [{ value: 'off', label: 'Off' }, { value: 'soft', label: 'Soft' }, { value: 'neon', label: 'Neon' }] },
  { setting: 'entries', label: 'Entries', options: [{ value: 'solid', label: 'Solid' }, { value: 'tinted', label: 'Tinted' }, { value: 'outline', label: 'Outline' }] },
  { setting: 'corners', label: 'Corners', options: [{ value: 'square', label: 'Square' }, { value: 'round', label: 'Round' }, { value: 'pill', label: 'Pill' }] },
];
/** The Scene choice has its own section; its options look and behave like the fine-tuning ones. */
const sceneGroup: (typeof groups)[number] = { setting: 'scene', label: 'Scene', options: [{ value: 'season', label: 'Season' }, { value: 'sunflowers', label: 'Sunflower field' }, { value: 'mordor', label: 'Mordor' }, { value: 'none', label: 'None' }] };
/** One option group (label + option cards) is drawn in two sections, so its template is defined once. */
const [DefineGroup, ReuseGroup] = createReusableTemplate<{ g: (typeof groups)[number] }>();
const SEASONS = ['spring', 'summer', 'fall', 'winter', 'halloween'];
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

// --- mode, seed colour (settings, not theme prefs) ---------------------------
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
      <DefineGroup v-slot="{ g }">
        <div class="group" role="group" :aria-label="g.label">
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
      </DefineGroup>
      <section class="card preview" aria-labelledby="h-prev" data-testid="theme-preview">
        <h2 id="h-prev">Preview</h2>
        <div class="stage">
          <div class="pv"><ThemeSample kind="event" title="Dentist" data-testid="theme-preview-event" /></div>
          <div class="pv"><ThemeSample kind="tasklist" color="#0b8043" title="Groceries" /></div>
          <div class="pv cbs"><ThemeSample kind="checkbox" color="#3f51b5" checked /><ThemeSample kind="checkbox" color="#3f51b5" /></div>
        </div>
      </section>

      <section class="card" aria-labelledby="h-gal" data-testid="theme-section" data-section="presets">
        <h2 id="h-gal">Presets</h2>
        <div class="gallery">
          <ThemeCard
            v-for="n in PRESET_NAMES" :key="n" :name="n" :theme="presetThemes[n]" :pressed="theme.pref.preset === n"
            :sub="n === 'Automatic' ? presetThemes[n].name : undefined" @choose="theme.choose(n)"
          />
          <ThemeCard v-for="t in theme.themes" :key="t.id" :name="t.doc.name" :theme="docToResolved(t.doc)" :pressed="theme.pref.preset === `theme:${t.id}`" @choose="theme.choose(`theme:${t.id}`)">
            <template #actions>
              <IconButton label="Export theme" data-testid="theme-export" @click="exportTheme(t)"><IconExport /></IconButton>
              <IconButton label="Delete theme" data-testid="theme-delete" @click="pending.deleteTheme(t.id, t.doc.name)"><IconDelete /></IconButton>
            </template>
          </ThemeCard>
        </div>
        <ThemeImport />
      </section>

      <section class="card" aria-labelledby="h-scene" data-testid="theme-section" data-section="scene">
        <h2 id="h-scene">Scene</h2>
        <ReuseGroup :g="sceneGroup" />
      </section>

      <section class="card" aria-labelledby="h-fine" data-testid="theme-section" data-section="fine-tuning">
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
        <ReuseGroup v-for="g in groups" :key="g.setting" :g="g" />
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
.b-sunflowers { background: linear-gradient(180deg, color-mix(in srgb, #8ec9f2 40%, transparent) 55%, color-mix(in srgb, #7fbf6a 45%, transparent) 55%); }
.scenebox :deep(.s-ev) { position: relative; }
.ol { font: var(--md-sys-typescale-label-large); }
.hex { margin-top: 10px; }
</style>
