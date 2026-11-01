<script setup lang="ts">
/**
 * A gallery card of the theme menu: a real mini week under the theme's own attributes and colours (a preset, an
 * imported theme, or the preview of one about to be imported). Choosing is the card button; `actions` adds a row
 * (export, delete) of imported themes.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { computed, onMounted, shallowRef } from 'vue';
import ThemeSample from '@/components/settings/ThemeSample.vue';
import DrawnScene from '@/features/motivation/DrawnScene.vue';
import SceneImage from '@/features/motivation/SceneImage.vue';
import SeasonScene from '@/features/motivation/SeasonScene.vue';
import { BACKDROP_SCENES } from '@/features/motivation/types';
import { dateLocale, language, t } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { resolveTheme as resolveMode } from '@/theme';
import type { ResolvedTheme } from '@/theme/presets';

const props = defineProps<{ name: string; label?: string; theme: ResolvedTheme; pressed?: boolean; sub?: string }>();
defineEmits<{ choose: [] }>();

const settings = useSettingsStore();
/** The initials of Monday to Sunday in the active language (the sample's mini week). */
const DAYS = computed(() => {
  const f = new Intl.DateTimeFormat(dateLocale(language.value), { weekday: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))));
});
const scene = computed(() => props.theme.attrs.scene);

/** The color library loads lazily; until then the card shows the current palette. */
const scheme = shallowRef<typeof import('@/theme/scheme') | null>(null);
onMounted(async () => { scheme.value = await import('@/theme/scheme'); });

const dark = computed(() => resolveMode(props.theme.mode ?? settings.settings.themeMode) === 'dark');
/** Color roles of the theme, applied to this card only. */
const style = computed<Record<string, string>>(() => {
  const t = props.theme;
  if (!scheme.value) return {};
  return { ...scheme.value.schemeVars(t.seed ?? settings.settings.seedColor, dark.value, 0, t.roles?.[dark.value ? 'dark' : 'light']), colorScheme: dark.value ? 'dark' : 'light' };
});
</script>

<template>
  <div class="item" data-testid="theme-item" :data-name="name">
    <Pressable type="button" class="tcard" data-testid="theme-card" :data-name="name" :aria-pressed="pressed" @click="$emit('choose')">
      <span
        class="scope" :style="style" :data-glow="theme.attrs.glow" :data-entries="theme.attrs.entries"
        :data-corners="theme.attrs.corners" :data-scene="scene" aria-hidden="true"
      >
        <span class="hdr" :class="{ ember: scene === 'mordor' }">
          <SeasonScene v-if="(BACKDROP_SCENES as readonly string[]).includes(scene)" :season="scene as 'spring'" />
          <template v-else-if="scene === 'custom'">
            <SceneImage v-if="theme.sceneSvg" :svg="theme.sceneSvg" :dark="dark" />
            <DrawnScene v-else-if="theme.sceneDraw" v-bind="theme.sceneDraw" :dark="dark" />
          </template>
          <span v-for="(d, i) in DAYS" :key="i" class="day">{{ d }}</span>
        </span>
        <span class="mini">
          <ThemeSample kind="event" color="var(--md-sys-color-primary)" on="var(--md-sys-color-on-primary)" :title="t('theme.sample.meet')" class="m1" />
          <ThemeSample kind="tasklist" color="var(--md-sys-color-tertiary)" on="var(--md-sys-color-on-tertiary)" :title="t('theme.sample.todo')" class="m2" />
        </span>
      </span>
      <span class="nm">{{ label ?? name }}<small v-if="sub"> · {{ sub }}</small></span>
    </Pressable>
    <div v-if="$slots.actions" class="acts"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.item { display: flex; flex-direction: column; min-width: 0; }
.tcard { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 6px; border-radius: var(--md-sys-shape-corner-large); border: 2px solid transparent; background: var(--md-sys-color-surface-container); transition: border-color 150ms, transform 150ms var(--md-sys-motion-spring), box-shadow 150ms; }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .tcard:hover { transform: translateY(-1px); } }
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
.acts { display: flex; justify-content: flex-end; }
</style>
