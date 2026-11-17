<script setup lang="ts">
/**
 * A gallery card of the theme menu: the sample calendar (`ThemePreview`, the real top bar and week grid) under the theme's own
 * attributes and colours, scaled down (a preset, an imported theme, or the preview of one about to be imported). Choosing is the
 * card button; `actions` adds a row (export, delete) of imported themes; `nameAction` puts one lone action on the name's line.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { computed, onMounted, shallowRef } from 'vue';
import ThemePreview from '@/components/settings/ThemePreview.vue';
import { useSettingsStore } from '@/stores/settings';
import { resolveTheme as resolveMode } from '@/theme';
import type { ResolvedTheme } from '@/theme/presets';

const props = defineProps<{ name: string; label?: string; theme: ResolvedTheme; pressed?: boolean; sub?: string }>();
defineEmits<{ choose: [] }>();

const settings = useSettingsStore();

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
        :data-corners="theme.attrs.corners" :data-scene="theme.attrs.scene" aria-hidden="true"
      >
        <ThemePreview :theme="theme" :dark="dark" still />
      </span>
      <span class="nm" :class="{ withact: $slots.nameAction }">{{ label ?? name }}<small v-if="sub"> · {{ sub }}</small></span>
    </Pressable>
    <div v-if="$slots.nameAction" class="name-act"><slot name="nameAction" /></div>
    <div v-if="$slots.actions" class="acts"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.item { display: flex; flex-direction: column; min-width: 0; }
.tcard { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 6px; border-radius: var(--md-sys-shape-corner-large); border: 2px solid transparent; background: var(--md-sys-color-surface-container); transition: border-color 150ms, transform 150ms var(--md-sys-motion-spring), box-shadow 150ms; }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .tcard:hover { transform: translateY(-1px); } }
.tcard[aria-pressed='true'] { border-color: var(--md-sys-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent); }
.scope { display: block; border-radius: var(--md-sys-shape-corner-medium); overflow: hidden; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
.nm { font: var(--md-sys-typescale-label-large); padding: 0 4px 2px; }
.nm small { font-weight: 400; color: var(--md-sys-color-on-surface-variant); }
/* one lone action sits on the name's line: no row of its own */
.item { position: relative; }
.nm.withact { display: flex; align-items: center; min-height: 44px; padding-right: 48px; }
.name-act { position: absolute; right: 8px; bottom: 8px; }
.acts { display: flex; justify-content: flex-end; }
</style>
