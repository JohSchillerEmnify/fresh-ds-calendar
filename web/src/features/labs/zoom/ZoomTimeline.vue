<script setup lang="ts">
/**
 * Mini day timeline of one big zoom month cell: an upper band with the all-day and untimed entries (task lists as full
 * cards, so every item shows) over a time grid whose timed blocks sit at their real time and are as tall as they last. The grid
 * covers only the hours its week row's items span (`rowSpan`, passed in; else the day's own `timeSpan`), so the room goes to the items, not to an empty night. It measures its
 * own border box (its height does not depend on its content: no measuring loop) and derives the pixels per hour from it.
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import ItemView from '@/components/calendar/ItemView.vue';
import { timeSpan } from './zoom';
import { blockGeometry, MIN_BLOCK_PX, packColumns, STACK_INDENT_PX, type Segment } from '@/lib/items';

const props = defineProps<{ segments: Segment[]; span?: { start: number; end: number } | null }>();
const grid = ref<HTMLElement | null>(null);
const { height } = useElementSize(grid, undefined, { box: 'border-box' });
/** The minutes of the day the grid covers (a day without timed items shows the whole day). */
const span = computed(() => props.span ?? timeSpan(props.segments) ?? { start: 0, end: 24 * 60 });
const hours = computed(() => Array.from({ length: (span.value.end - span.value.start) / 60 }, (_, i) => i));
/** Pixels per hour of the grid (an unmeasured grid counts as 1 so nothing divides by zero). */
const hh = computed(() => Math.max(1, height.value) / ((span.value.end - span.value.start) / 60));
const top = computed(() => props.segments.filter((s) => s.allDay || s.startTime === null));
const placed = computed(() => packColumns(props.segments, (MIN_BLOCK_PX / hh.value) * 60));
const geo = (startMin: number, endMin: number) => blockGeometry(startMin - span.value.start, endMin - span.value.start, hh.value);
const variantOf = (s: Segment) => (s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip');
</script>

<template>
  <div class="zt" data-testid="zoom-timeline" :data-start-hour="span.start / 60">
    <div v-if="top.length" class="band">
      <div v-for="s in top" :key="s.item.id + s.date" class="row" data-zoom-nopan><ItemView :segment="s" :variant="variantOf(s)" /></div>
    </div>
    <div ref="grid" class="grid">
      <span v-for="h in hours" :key="h" class="hl" :style="{ top: h * hh + 'px', height: hh + 'px' }" />
      <div
        v-for="p in placed" :key="p.seg.item.id + p.seg.date" class="blk" data-zoom-nopan
        :style="{ top: geo(p.top, p.top + p.height).top + 'px', height: geo(p.top, p.top + p.height).height + 'px', left: `calc(100% * ${p.col / p.cols} + ${p.level * STACK_INDENT_PX}px)`, width: `calc(100% * ${p.span / p.cols} - ${p.level * STACK_INDENT_PX}px)`, '--z': 1 + p.level }"
      >
        <ItemView :segment="p.seg" variant="block" :height="geo(p.top, p.top + p.height).height" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.zt { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 2px; min-height: 0; }
.band { flex: 0 1 auto; max-height: 45%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
.band > .row { flex: none; display: flex; }
.band > .row > :deep(*) { flex: 1; min-width: 0; }
.grid { position: relative; flex: 1 1 0; min-height: 0; overflow: hidden; }
.hl { position: absolute; left: 0; right: 0; box-sizing: border-box; border-bottom: 1px solid var(--md-sys-color-outline-variant); opacity: 0.6; }
.blk { position: absolute; padding: 0 1px 1px; box-sizing: border-box; z-index: var(--z, 1); min-width: 0; display: flex; }
.blk > :deep(*) { flex: 1; min-width: 0; }
</style>
