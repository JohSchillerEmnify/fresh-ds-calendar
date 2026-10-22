<script setup lang="ts">
/**
 * Theme menu (`/settings/theme`): a live preview and three sections, in this order: Presets (a gallery of ready
 * themes, each a real mini week under that theme's attributes), Scene (the top bar background, one choice) and
 * Fine-tuning (theme mode, seed colour, options that each show a sample of their look, a slider for the values between
 * the glow, corner and tint steps, density and the checkbox choices). Picking applies at once
 * and is saved in the background by the theme store; there is no save button. The scene is a theme attribute. Theme
 * mode and seed colour are settings (`PATCH /api/settings`) that live only here (feature settings).
 */
import { createReusableTemplate } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IconArrowBack as IconBack, IconClose, IconEditOutline, IconSettingsOutline, IconDeleteOutline as IconDelete, IconDownload as IconExport } from '@/components/icons';
import { ApiError, type StoredTheme } from '@/api/client';
import { isHexColor, MORDOR_SEED, SEED_PRESETS } from '@/api/colors';
import type { ThemeMode } from '@/api/types';
import Button from '@/components/m3/Button.vue';
import ColorSwatchPicker from '@/components/m3/ColorSwatchPicker.vue';
import IconButton from '@/components/m3/IconButton.vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Slider from '@/components/m3/Slider.vue';
import TextField from '@/components/m3/TextField.vue';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import ThemeLivePreview from '@/components/settings/ThemeLivePreview.vue';
import SaveThemeDialog from '@/components/settings/SaveThemeDialog.vue';
import ThemeImport from '@/components/settings/ThemeImport.vue';
import ThemeSample from '@/components/settings/ThemeSample.vue';
import SeasonScene from '@/features/motivation/SeasonScene.vue';
import { BACKDROP_SCENES } from '@/features/motivation/types';
import { useClockStore } from '@/stores/clock';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useThemeStore } from '@/stores/theme';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import {
  CHECK_FILLS, CHECK_GLYPHS, CHECKBOXES, DEFAULT_TINT, DENSITIES, GLOW_STEPS, ICON_SETS, RADIUS_STEPS, RANGES,
} from '@/theme/fine';
import { presetLabel, seedLabel } from '@/theme/labels';
import { automaticPreset, docToResolved, PRESET_NAMES, resolveTheme, type PresetName, type ResolvedTheme, type Seasonal, type ThemeAttrs } from '@/theme/presets';

const router = useRouter();
const theme = useThemeStore();
const settings = useSettingsStore();
const clock = useClockStore();
const pending = usePendingDeletesStore();
const prefs = usePrefsStore();
const savingOwn = ref(false);
const attrs = computed(() => theme.resolved.attrs);

/** Every preset as the gallery shows it: its own look, whatever the seasons & holidays setting is. */
const presetThemes = computed(() => Object.fromEntries(PRESET_NAMES.map((n) => [n, resolveTheme({ preset: n, overrides: {}, seasonal: 'off' }, clock.today)])) as Record<PresetName, ResolvedTheme>);

/** Downloads a theme's document as a `.json` file. */
function exportTheme(th: StoredTheme) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(th.doc, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${th.doc.name.replace(/[^\w-]+/g, '-')}.theme.json` });
  a.click();
  URL.revokeObjectURL(url);
}

interface OptionGroup { setting: keyof ThemeAttrs; label: string; options: { value: string; label: string }[] }
const groups = computed<OptionGroup[]>(() => [
  { setting: 'glow', label: t('theme.glow.label'), options: [{ value: 'off', label: t('common.off') }, { value: 'soft', label: t('theme.glow.soft') }, { value: 'neon', label: t('theme.glow.neon') }] },
  { setting: 'entries', label: t('theme.entries.label'), options: [{ value: 'solid', label: t('theme.entries.solid') }, { value: 'tinted', label: t('theme.entries.tinted') }, { value: 'outline', label: t('theme.entries.outline') }] },
  { setting: 'corners', label: t('theme.corners.label'), options: [{ value: 'square', label: t('theme.corners.square') }, { value: 'round', label: t('theme.corners.round') }, { value: 'pill', label: t('theme.corners.pill') }] },
]);
/** The Scene choice has its own section; its options look and behave like the fine-tuning ones. */
const sceneGroup = computed<OptionGroup>(() => ({ setting: 'scene', label: t('theme.scene.title'), options: [
  { value: 'spring', label: t('theme.scene.spring') }, { value: 'easter', label: t('theme.scene.easter') }, { value: 'summer', label: t('theme.scene.summer') },
  { value: 'summerholidays', label: t('theme.scene.summerholidays') }, { value: 'fall', label: t('theme.scene.fall') }, { value: 'halloween', label: t('theme.scene.halloween') },
  { value: 'christmas', label: t('theme.scene.christmas') }, { value: 'newyearseve', label: t('theme.scene.newyearseve') }, { value: 'newyear', label: t('theme.scene.newyear') },
  { value: 'winter', label: t('theme.scene.winter') }, { value: 'sunflowers', label: t('theme.scene.sunflowers') }, { value: 'mordor', label: t('theme.scene.mordor') }, { value: 'none', label: t('theme.scene.none') },
] }));
/** One option group (label + option cards) is drawn in two sections, so its template is defined once. */
const [DefineGroup, ReuseGroup] = createReusableTemplate<{ g: OptionGroup }>();
const isSeason = (s: string) => (BACKDROP_SCENES as readonly string[]).includes(s);

// --- Seasons & holidays (one setting for all of them) ----------------------------------------------------------------
const seasonalOptions = computed<{ value: Seasonal; label: string }[]>(() => [{ value: 'off', label: t('theme.seasonal.off') }, { value: 'header', label: t('theme.seasonal.header') }, { value: 'all', label: t('theme.seasonal.all') }]);
/** What applies today, in words: the calendar's theme and which parts of it. */
const seasonalToday = computed(() => {
  const name = presetLabel(automaticPreset(clock.today));
  return theme.pref.seasonal === 'all' ? t('theme.seasonal.todayAll', { name }) : theme.pref.seasonal === 'header' ? t('theme.seasonal.todayHeader', { name }) : t('theme.seasonal.todayNone');
});
/** The scene option shown as pressed: the person's pick, or the theme's own scene while the calendar is off (none while it drives the header). */
const sceneChoice = computed(() => theme.pref.overrides.scene ?? (theme.pref.seasonal === 'off' ? attrs.value.scene : null));
/** Glow and corners are a step and a slider value in one: a step is pressed only while the slider is exactly on its value. */
const STEP_VALUES = { glow: GLOW_STEPS, corners: RADIUS_STEPS } as Record<string, Record<string, number>>;
const STEP_FIELD = { glow: 'glowStrength', corners: 'radius' } as const;
const fine = computed(() => theme.resolved.fine);
/** The slider values in use: the fine-tuned number, else the chosen step's value (tint: the default). */
const values = computed(() => ({
  glowStrength: fine.value.glowStrength ?? GLOW_STEPS[attrs.value.glow],
  radius: fine.value.radius ?? RADIUS_STEPS[attrs.value.corners],
  tint: fine.value.tint ?? DEFAULT_TINT,
}));
function pressed(setting: keyof ThemeAttrs, value: string): boolean {
  if (setting === 'scene') return sceneChoice.value === value;
  const steps = STEP_VALUES[setting];
  return steps ? values.value[STEP_FIELD[setting as 'glow' | 'corners']] === steps[value] : attrs.value[setting] === value;
}
function pickOption(setting: keyof ThemeAttrs, value: string) {
  const steps = STEP_VALUES[setting];
  // a step also sets its slider value, so the number of an earlier slider move does not outlive the pick
  if (steps) void theme.pickMany({ [setting]: value, [STEP_FIELD[setting as 'glow' | 'corners']]: steps[value] } as never);
  else void theme.pick(setting, value as never);
}

// --- sliders (live while moving, saved when the move ends) and the other fine-tuning choices ---------------------------
type SliderKey = 'glowStrength' | 'radius' | 'tint';
const sliders = computed<Record<string, { key: SliderKey; label: string; testid: string }>>(() => ({
  glow: { key: 'glowStrength', label: t('theme.slider.glowStrength'), testid: 'theme-slider-glow' },
  corners: { key: 'radius', label: t('theme.slider.radius'), testid: 'theme-slider-radius' },
  entries: { key: 'tint', label: t('theme.slider.tint'), testid: 'theme-slider-tint' },
}));
/** Text shown next to a slider: `4 px`, `30 %`, glow strength without a unit. */
function sliderText(kind: SliderKey, value: number): string {
  return kind === 'radius' ? t('theme.fine.px', { value }) : kind === 'tint' ? t('theme.fine.percent', { value }) : String(value);
}
const live = (key: SliderKey, v: number) => theme.preview({ [key]: v });
const commit = (key: SliderKey, v: number) => theme.pickMany({ [key]: v });
/** The tint is only used by tinted entries, so the other styles disable its slider. */
const tintOff = computed(() => attrs.value.entries !== 'tinted');
const choices = computed<{ key: 'density' | 'checkbox' | 'checkFill' | 'check' | 'icons'; label: string; testid: string; options: { value: string; label: string }[]; fallback: string }[]>(() => [
  { key: 'density', label: t('theme.density.label'), testid: 'theme-density', fallback: 'comfortable', options: DENSITIES.map((v) => ({ value: v, label: t(`theme.density.${v}`) })) },
  { key: 'checkbox', label: t('theme.checkboxShape.label'), testid: 'theme-checkbox-shape', fallback: 'rounded', options: CHECKBOXES.map((v) => ({ value: v, label: t(`theme.checkboxShape.${v}`) })) },
  { key: 'checkFill', label: t('theme.checkFill.label'), testid: 'theme-check-fill', fallback: 'filled', options: CHECK_FILLS.map((v) => ({ value: v, label: t(`theme.checkFill.${v}`) })) },
  { key: 'check', label: t('theme.checkGlyph.label'), testid: 'theme-check-glyph', fallback: 'tick', options: CHECK_GLYPHS.map((v) => ({ value: v, label: t(`theme.checkGlyph.${v}`) })) },
  { key: 'icons', label: t('theme.iconSet.label'), testid: 'theme-icon-set', fallback: 'outlined', options: ICON_SETS.map((v) => ({ value: v, label: t(`theme.iconSet.${v}`) })) },
]);
/** The sample icons shown in each option of the icon set control, drawn in that option's own set. */
const SAMPLE_ICONS = [IconSettingsOutline, IconEditOutline, IconClose];
const choiceValue = (c: (typeof choices.value)[number]) => (fine.value as Record<string, string | undefined>)[c.key] ?? c.fallback;
/** Attributes for an option's sample: the current look with this one option swapped in. */
function sampleAttrs(setting: keyof ThemeAttrs, value: string): Record<string, string> {
  const a: Record<string, string> = { 'data-glow': attrs.value.glow, 'data-entries': attrs.value.entries, 'data-corners': attrs.value.corners };
  if (setting !== 'scene') a[`data-${setting}`] = value;
  return a;
}

// --- mode (a setting) and seed colour (fine-tuning on top of the chosen theme, like the other options) ----------------
const sync = useSyncStore();
const ui = useUiStore();
const s = computed(() => settings.settings);
/** Persist a settings patch; failures roll back in the store and surface as the banner or a snackbar. */
async function save(p: Parameters<typeof settings.patch>[0]) {
  try {
    await settings.patch(p);
  } catch (e) {
    if (e instanceof ApiError && e.isUnavailable) sync.reportError(e);
    else ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}
const modes = computed(() => [{ value: 'system', label: t('theme.mode.system') }, { value: 'light', label: t('theme.mode.light') }, { value: 'dark', label: t('theme.mode.dark') }]);
const seed = computed(() => (theme.resolved.seed ?? s.value.seedColor).toLowerCase());
const presetNames = SEED_PRESETS.map((p) => p.hex);
const isMordor = computed(() => seed.value === MORDOR_SEED);
const isCustom = computed(() => !presetNames.includes(seed.value) && !isMordor.value);
const swatches = computed(() => [
  ...SEED_PRESETS.map((p) => ({ value: p.hex, name: seedLabel(p.name), color: p.hex, testid: 'settings-seed-preset' })),
  { value: 'custom', name: t('theme.fine.custom'), color: isCustom.value ? seed.value : '#9e9e9e', testid: 'settings-seed-preset' },
]);
const swatchValue = computed(() => (isCustom.value ? 'custom' : isMordor.value ? null : seed.value));
const hex = ref(seed.value);
const hexError = ref('');
watch(seed, (v) => { hex.value = v; hexError.value = ''; });
function pickSwatch(v: string) {
  if (v === 'custom') { document.querySelector<HTMLInputElement>('[data-testid="settings-seed-custom"]')?.focus(); return; }
  void theme.pick('seed', v);
}
function commitHex() {
  const v = hex.value.trim();
  if (!isHexColor(v)) { hexError.value = t('theme.fine.invalidColor'); return; }
  hexError.value = '';
  if (v.toLowerCase() !== seed.value) void theme.pick('seed', v.toLowerCase());
}

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/settings');
}
</script>

<template>
  <section class="page" data-testid="theme-view">
    <header class="bar">
      <IconButton :label="t('settings.back')" data-testid="theme-back" @click="back"><IconBack /></IconButton>
      <h1>{{ t('theme.title') }}</h1>
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
              <span v-if="g.setting !== 'scene'" class="sample" v-bind="sampleAttrs(g.setting, o.value)"><ThemeSample kind="event" /></span>
              <span v-else class="sample scenebox" v-bind="sampleAttrs(g.setting, o.value)">
                <span class="back" :class="[`b-${o.value}`]"><SeasonScene v-if="isSeason(o.value)" :season="o.value as 'spring'" /></span>
                <ThemeSample kind="event" />
              </span>
              <span class="ol">{{ o.label }}</span>
            </button>
          </div>
        </div>
      </DefineGroup>
      <ThemeLivePreview class="live-slot" />

      <section class="card" aria-labelledby="h-cal" data-testid="theme-section" data-section="calendar">
        <h2 id="h-cal">{{ t('theme.seasonal.title') }}</h2>
        <SegmentedButton :model-value="theme.pref.seasonal" :options="seasonalOptions" :label="t('theme.seasonal.title')" data-testid="theme-seasonal" @update:model-value="theme.setSeasonal" />
        <p class="today" data-testid="theme-seasonal-today">{{ seasonalToday }}</p>
      </section>

      <section class="card" aria-labelledby="h-gal" data-testid="theme-section" data-section="presets">
        <h2 id="h-gal">{{ t('theme.gallery.title') }}</h2>
        <div class="gallery">
          <ThemeCard
            v-for="n in PRESET_NAMES" :key="n" :name="n" :label="presetLabel(n)" :theme="presetThemes[n]" :pressed="theme.pref.preset === n"
            @choose="theme.choose(n)"
          />
          <ThemeCard v-for="th in theme.themes" :key="th.id" :name="th.doc.name" :theme="docToResolved(th.doc, th.picture)" :pressed="theme.pref.preset === `theme:${th.id}`" @choose="theme.choose(`theme:${th.id}`)">
            <template #actions>
              <IconButton :label="t('theme.export')" data-testid="theme-export" @click="exportTheme(th)"><IconExport /></IconButton>
              <IconButton :label="t('theme.delete')" data-testid="theme-delete" @click="pending.deleteTheme(th.id, th.doc.name)"><IconDelete /></IconButton>
            </template>
          </ThemeCard>
        </div>
        <ThemeImport :ai="prefs.labs && prefs.labsOwnThemes" />
      </section>

      <section class="card" aria-labelledby="h-scene" data-testid="theme-section" data-section="scene">
        <h2 id="h-scene">{{ t('theme.scene.title') }}</h2>
        <ReuseGroup :g="sceneGroup" />
      </section>

      <section class="card" aria-labelledby="h-fine" data-testid="theme-section" data-section="fine-tuning">
        <h2 id="h-fine">{{ t('theme.fine.title') }}</h2>
        <div class="group">
          <span class="lab">{{ t('theme.fine.mode') }}</span>
          <SegmentedButton :model-value="s.themeMode" :options="modes" :label="t('theme.fine.mode')" data-testid="settings-theme-mode" @update:model-value="save({ themeMode: $event as ThemeMode })" />
        </div>
        <div class="group">
          <span class="lab">{{ t('theme.fine.seed') }}</span>
          <ColorSwatchPicker :swatches="swatches" :model-value="swatchValue" :label="t('theme.fine.seed')" @update:model-value="pickSwatch" />
          <TextField v-model="hex" class="hex" :label="t('theme.fine.customHex')" data-testid="settings-seed-custom" :error="hexError" error-testid="settings-seed-error" autocomplete="off" autocapitalize="off" @commit="commitHex" />
        </div>
        <template v-for="g in groups" :key="g.setting">
          <ReuseGroup :g="g" />
          <div v-if="sliders[g.setting]" class="group">
            <Slider
              :model-value="values[sliders[g.setting].key]" :min="RANGES[sliders[g.setting].key][0]" :max="RANGES[sliders[g.setting].key][1]"
              :label="sliders[g.setting].label" :value-text="sliderText(sliders[g.setting].key, values[sliders[g.setting].key])"
              :testid="sliders[g.setting].testid" :disabled="sliders[g.setting].key === 'tint' && tintOff"
              @update:model-value="live(sliders[g.setting].key, $event)" @commit="commit(sliders[g.setting].key, $event)"
            />
            <span v-if="sliders[g.setting].key === 'tint' && tintOff" class="sub">{{ t('theme.fine.tintOnly') }}</span>
          </div>
        </template>
        <div v-for="c in choices" :key="c.key" class="group">
          <span class="lab">{{ c.label }}</span>
          <SegmentedButton :model-value="choiceValue(c)" :options="c.options" :label="c.label" :data-testid="c.testid" @update:model-value="theme.pick(c.key, $event as never)">
            <template v-if="c.key === 'icons'" #option="{ option }">
              <span class="isamp" aria-hidden="true"><component :is="ic.variants[option.value as 'sharp']" v-for="(ic, n) in SAMPLE_ICONS" :key="n" /></span>
            </template>
          </SegmentedButton>
        </div>
        <div class="group">
          <Button variant="tonal" data-testid="theme-save-own" @click="savingOwn = true">{{ t('theme.saveOwn.button') }}</Button>
        </div>
      </section>
      <SaveThemeDialog v-if="savingOwn" @close="savingOwn = false" />
    </div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 720px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 12px 14px; }
h2 { margin: 0; padding: 12px 4px 8px; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); }
/* desktop: settings left, the live preview sticky in a right column (it spans the four section rows) */
@media (min-width: 900px) {
  .content { display: grid; grid-template-columns: minmax(0, 1fr) 340px; column-gap: 16px; align-items: start; max-width: 1100px; }
  .content > * { grid-column: 1; }
  .content > .live-slot { grid-column: 2; grid-row: 1 / span 4; }
}

.gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (min-width: 560px) { .gallery { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.group { padding: 4px 0 8px; }
.lab { display: block; font: var(--md-sys-typescale-body-large); padding: 4px 4px 6px; }
.opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
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
.isamp { display: inline-flex; gap: 2px; }
.isamp :deep(svg) { width: 16px; height: 16px; }

.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.today { margin: 8px 4px 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
