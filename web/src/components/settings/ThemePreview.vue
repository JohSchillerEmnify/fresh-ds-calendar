<script setup lang="ts">
/** Sample calendar of the app's own top bar and week grid, scaled to its width and inert (feature theme-menu). */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import AppTopBar from '@/components/shell/AppTopBar.vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import { hourHeight } from '@/composables/useHourHeight';
import { providePreview } from '@/composables/usePreview';
import { t } from '@/i18n';
import { useAnimationLevel } from '@/motion';
import type { ResolvedTheme } from '@/theme/presets';
import { SAMPLE_DAYS, SAMPLE_GRID_HOURS, SAMPLE_GRID_START, previewScale, sampleSegmentsOf } from './themeLivePreviewSample';

/** Width the sample is laid out at before it is scaled to the available width. */
const DESIGN_WIDTH = 420;
/** The week's day heads and all-day row above the hour grid, in pixels. */
const GRID_CHROME_PX = 100;

const props = defineProps<{ theme: ResolvedTheme; dark: boolean; barOnly?: boolean; /** A still picture at every animation level (the gallery cards: many at once). */ still?: boolean }>();
const level = useAnimationLevel();
/** Animations run only at the Full animation level; below it the preview is a still picture. */
const stopped = computed(() => props.still || level.value !== 'full');
providePreview(true, {
  segments: (date) => sampleSegmentsOf(date, (k) => t(k)),
  get theme() { return props.theme; },
  get dark() { return props.dark; },
  get still() { return stopped.value; },
  gridStart: SAMPLE_GRID_START,
});
const dates = SAMPLE_DAYS.map((d) => new Date(`${d}T12:00:00`));
const gridHeight = computed(() => `${GRID_CHROME_PX + SAMPLE_GRID_HOURS * hourHeight.value}px`);

const frame = ref<HTMLElement | null>(null);
const inner = ref<HTMLElement | null>(null);
const { width: frameWidth } = useElementSize(frame);
const { height: naturalHeight } = useElementSize(inner);
const scale = computed(() => previewScale(frameWidth.value, DESIGN_WIDTH));
/** The frame is as tall as the scaled content (a transform does not change the layout box). */
const frameStyle = computed(() => (naturalHeight.value > 0 ? { height: `${naturalHeight.value * scale.value}px` } : undefined));
</script>

<template>
  <div ref="frame" class="frame" :class="{ still: stopped }" :style="frameStyle">
    <div ref="inner" class="scaled" :style="{ width: `${DESIGN_WIDTH}px`, transform: `scale(${scale})` }" inert aria-hidden="true">
      <AppTopBar />
      <div v-if="!barOnly" class="grid" :style="{ height: gridHeight }"><TimeGrid mode="week" :dates="dates" /></div>
    </div>
  </div>
</template>

<style scoped>
.frame { position: relative; overflow: hidden; pointer-events: none; }
.scaled { --safe-top: 0px; transform-origin: top left; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
.grid { display: flex; flex-direction: column; overflow: hidden; }
/* below the Full animation level the preview is a still picture */
.still :deep(*), .still :deep(*::before), .still :deep(*::after) { animation: none !important; transition: none !important; }
</style>
