<script setup lang="ts">
/**
 * Approach bar (Labs): the now card's "Next" line as a track. Now at the left end, the next timed entries of today as
 * the month view's compact chips, placed by how far away they start; the track ends at the last one.
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import ItemView from '@/components/calendar/ItemView.vue';
import type { Segment } from '@/lib/items';
import { approachLayout } from './approach';

const props = defineProps<{ entries: Segment[]; nowMin: number }>();
const CHIP_PX = 96;
const ROW_PX = 20;
/** Chips start right of the now dot, so a chip about to start never hides it. */
const NOW_PX = 12;
const el = ref<HTMLElement | null>(null);
const { width } = useElementSize(el);
const layout = computed(() => approachLayout(props.entries, props.nowMin, Math.max(0, width.value - NOW_PX), CHIP_PX));
</script>

<template>
  <!-- .stop: a tap or key on a chip opens the entry, it does not collapse the now card -->
  <div ref="el" class="approach" data-testid="approach-bar" role="group" aria-label="Next" :style="{ height: `${layout.rows * ROW_PX}px` }" @click.stop @keydown.enter.stop @keydown.space.stop>
    <span class="line" />
    <span class="now" data-testid="approach-now" />
    <div
      v-for="c in layout.chips" :key="c.segment.item.id + c.segment.date" class="item" data-testid="approach-item"
      :data-title="c.segment.item.title" :data-minutes="c.minutes"
      :style="{ left: `${NOW_PX + c.x}px`, top: `${c.row * ROW_PX + 1}px`, width: `${CHIP_PX}px` }"
    >
      <ItemView :segment="c.segment" variant="chip" />
    </div>
  </div>
</template>

<style scoped>
.approach { position: relative; flex: none; min-width: 0; }
.line { position: absolute; left: 0; right: 0; top: 9px; height: 2px; border-radius: 1px; background: color-mix(in srgb, currentColor 30%, transparent); }
.now { position: absolute; left: 0; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--md-sys-color-primary); z-index: 1; }
.item { position: absolute; display: flex; min-width: 0; transition: left 300ms ease; }
.item > * { flex: 1 1 auto; min-width: 0; }
html[data-motion='off'] .item, html[data-motion='reduced'] .item { transition: none; }
</style>
