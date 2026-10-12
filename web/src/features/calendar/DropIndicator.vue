<script setup lang="ts">
/** Grid layer: snapped drop preview (15 min) while an event or task list is dragged over this day column. */
import { computed } from 'vue';
import type { GridLayerProps } from '@/extensions/registry';
import { minutesToTime } from '@/lib/dates';
import { dragPreview } from './dnd';
import { MIN_BLOCK_PX, minutesToPx } from './timeline';

const props = defineProps<GridLayerProps>();
const p = computed(() => (dragPreview.value?.date === props.date ? dragPreview.value : null));
const style = computed(() => (p.value
  ? { top: minutesToPx(p.value.minutes, props.hourHeight) + 'px', height: Math.max(minutesToPx(p.value.durationMin, props.hourHeight), MIN_BLOCK_PX) + 'px' }
  : undefined));
</script>

<template>
  <div v-if="p" class="drop" data-testid="drop-indicator" :data-time="minutesToTime(p.minutes)" :style="style"><span>{{ minutesToTime(p.minutes) }}</span></div>
</template>

<style scoped>
.drop {
  position: absolute; left: 1px; right: 1px; z-index: 3; pointer-events: none; border-radius: var(--md-sys-shape-corner-small);
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent); border: 2px dashed var(--md-sys-color-primary);
}
span { position: absolute; top: 1px; left: 4px; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-primary); font-variant-numeric: tabular-nums; }
</style>
