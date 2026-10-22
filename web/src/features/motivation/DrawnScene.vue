<script setup lang="ts">
/**
 * A drawn theme scene (feature theme-import): a vertical gradient with decor the app draws from
 * building blocks. In dark mode the gradient is dimmed (`dark` picks it; without it the page's `data-theme` does).
 * The decor moves subtly, only at the Full animation level.
 */
import { computed } from 'vue';
import type { ThemeDecor, ThemeDensity } from '@calendar/shared';
import { drawDecor, SCENE_H, SCENE_W } from './drawnScene';

// `dark` stays undefined (not false) when absent: that is what selects the page's theme
const props = withDefaults(defineProps<{ gradient: string[]; decor?: ThemeDecor; density?: ThemeDensity; dark?: boolean }>(), { decor: undefined, density: 'medium', dark: undefined });
const shapes = computed(() => (props.decor ? drawDecor(props.decor, props.density, props.gradient) : []));
const background = computed(() => `linear-gradient(to bottom, ${props.gradient.join(', ')})`);
</script>

<template>
  <span class="ds" data-testid="drawn-scene" :data-decor="decor ?? 'none'" :data-dark="dark === undefined ? undefined : String(dark)" :style="{ background }" aria-hidden="true">
    <svg v-if="shapes.length" :viewBox="`0 0 ${SCENE_W} ${SCENE_H}`" preserveAspectRatio="xMidYMid slice" focusable="false">
      <component :is="s.tag" v-for="(s, i) in shapes" :key="i" v-bind="s.attrs" :class="s.motion" :style="{ '--d': `${s.delay}s` }" />
    </svg>
    <span class="dim" />
  </span>
</template>

<style>
.ds { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.ds svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.ds svg > * { transform-box: fill-box; transform-origin: center; }
.ds .dim { position: absolute; inset: 0; display: none; background: rgb(0 0 0 / 0.4); }
:root[data-theme='dark'] .ds:not([data-dark]) .dim, .ds[data-dark='true'] .dim { display: block; }
html[data-motion='full'] .ds .tw { animation: ds-twinkle 3s ease-in-out infinite alternate; animation-delay: var(--d); }
html[data-motion='full'] .ds .fl { animation: ds-float 5s ease-in-out infinite alternate; animation-delay: var(--d); }
html[data-motion='full'] .ds .dr { animation: ds-drift 9s ease-in-out infinite alternate; animation-delay: var(--d); }
@keyframes ds-twinkle { from { opacity: 0.35; } to { opacity: 1; } }
@keyframes ds-float { from { transform: translateY(2px); } to { transform: translateY(-3px); } }
@keyframes ds-drift { from { transform: translateX(-12px); } to { transform: translateX(12px); } }
</style>
