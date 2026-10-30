<script setup lang="ts">
/**
 * Grid layer: the block being drawn on the empty grid, and kept behind the "new" dialog it opened (feature event-editing,
 * design C1-C3): one piece per day column it covers, the first one labelled with the drawn time.
 */
import { computed } from 'vue';
import type { GridLayerProps } from '@/extensions/registry';
import { minutesToTime } from '@/lib/dates';
import { t } from '@/i18n';
import { drawnPiece, drawPreview } from './draw';
import { minutesToPx } from './timeline';

const props = defineProps<GridLayerProps>();
const piece = computed(() => drawnPiece(props.date));
/** The end of a day is written 24:00 (the next day starts at 00:00). */
const hm = (m: number) => (m >= 1440 ? '24:00' : minutesToTime(m));
const label = computed(() => {
  const p = drawPreview.value;
  if (!p || !piece.value || p.dates.indexOf(props.date) !== Math.floor(p.range.start / 1440)) return '';
  const day = (m: number) => m % 1440 === 0 && m > p.range.start ? '24:00' : minutesToTime(m % 1440);
  return t('calendar.drag.newBlock', { from: day(p.range.start), to: day(p.range.end) });
});
const style = computed(() => (piece.value
  ? { top: minutesToPx(piece.value.start, props.hourHeight) + 'px', height: minutesToPx(piece.value.end - piece.value.start, props.hourHeight) + 'px' }
  : undefined));
</script>

<template>
  <div v-if="piece" class="draw" data-testid="draw-block" :data-start-time="hm(piece.start)" :data-end-time="hm(piece.end)" :style="style" aria-hidden="true">
    <span v-if="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.draw {
  position: absolute; left: 2px; right: 2px; z-index: 4; pointer-events: none; box-sizing: border-box; overflow: hidden;
  border-radius: var(--md-sys-shape-corner-small); border: 2px dashed var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary-container) 70%, transparent);
}
span {
  display: block; padding: 2px 6px; font: var(--md-sys-typescale-label-large); font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; color: var(--md-sys-color-on-primary-container); font-variant-numeric: tabular-nums;
}
</style>
