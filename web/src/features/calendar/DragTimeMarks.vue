<script setup lang="ts">
/** Hour column marks (feature drag-and-drop): the start and end time a moved, resized or drawn entry lands on, with a dashed line to it. */
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { drawPreview } from './draw';
import { dragPreview } from './dnd';
import { landingMarks } from './landing';
import { resizePreview } from './resize';

const props = defineProps<{ dates: string[]; hourHeight: number }>();
const ui = useUiStore();
// the block kept behind the "new" dialog is no longer in motion
const marks = computed(() => landingMarks(
  { drag: dragPreview.value, resize: resizePreview.value, draw: ui.dialog ? null : drawPreview.value },
  props.dates,
));
const top = (minutes: number) => (minutes / 60) * props.hourHeight + 'px';
</script>

<template>
  <div v-for="m in marks" :key="m.edge" class="mark" :style="{ top: top(m.minutes), '--cols': m.col + 1 }" aria-hidden="true">
    <span class="label" data-testid="drag-time-mark" :data-edge="m.edge" :data-time="m.time">{{ m.time }}</span>
    <i class="line" />
  </div>
</template>

<style scoped>
.mark {
  position: absolute; left: 0; right: 0; height: 0; z-index: 25; pointer-events: none;
  display: grid; grid-template-columns: var(--gw) repeat(var(--n), minmax(0, 1fr));
}
.label {
  grid-column: 1; justify-self: start; width: max-content; transform: translateY(-50%); box-sizing: border-box; padding: 1px 4px; white-space: nowrap;
  border-radius: var(--md-sys-shape-corner-small); background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary);
  font: var(--md-sys-typescale-label-small); font-variant-numeric: tabular-nums;
}
.line { grid-column: 2 / span var(--cols); align-self: start; border-top: 2px dashed var(--md-sys-color-primary); transform: translateY(-1px); }
</style>
