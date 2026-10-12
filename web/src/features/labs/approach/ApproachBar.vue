<script setup lang="ts">
/**
 * Approach bar (Labs): the now card's "Next" line as an absolute time track. Now at the left end, now + the chosen
 * window at the right end, HH:MM ticks thinned to fit, the next timed entries of today as the month view's compact
 * chips at their start time; an entry beyond the window waits at the end with "in 5 h".
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import ItemView from '@/components/calendar/ItemView.vue';
import type { Segment } from '@/lib/items';
import { formatDuration } from '@/features/calendar/timeline';
import { approachLayout, approachTicks } from './approach';

const props = defineProps<{ entries: Segment[]; atEnd: boolean; nowMin: number; windowMin: number }>();
const CHIP_PX = 96;
const MIN_CHIP_PX = 40;
const ROW_PX = 20;
const TICK_PX = 12;
/** Room one HH:MM label needs, gap included. */
const LABEL_PX = 40;
/** Chips start right of the now dot, so a chip about to start never hides it. */
const NOW_PX = 12;
const el = ref<HTMLElement | null>(null);
const { width } = useElementSize(el);
const track = computed(() => Math.max(0, width.value - NOW_PX));
const layout = computed(() => approachLayout(props.entries, props.nowMin, props.windowMin, track.value, CHIP_PX, MIN_CHIP_PX, props.atEnd));
const ticks = computed(() => approachTicks(props.nowMin, props.windowMin, track.value, LABEL_PX));
</script>

<template>
  <!-- .stop: a tap or key on a chip opens the entry, it does not collapse the now card -->
  <div
    ref="el" class="approach" data-testid="approach-bar" role="group" aria-label="Next" :data-window-hours="windowMin / 60"
    :style="{ height: `${TICK_PX + layout.rows * ROW_PX}px` }" @click.stop @keydown.enter.stop @keydown.space.stop
  >
    <span v-for="t in ticks" :key="t.min" class="tick" data-testid="approach-tick" :style="{ left: `${NOW_PX + t.x}px` }">{{ t.label }}</span>
    <span class="line" />
    <span class="now" data-testid="approach-now" />
    <template v-for="(c, i) in layout.chips" :key="c.segment.item.id + c.segment.date">
      <span v-if="atEnd" class="in" :style="{ right: `${c.width + 4}px`, top: `${TICK_PX}px` }">in {{ formatDuration(c.minutes) }}</span>
      <div
        class="item" :class="{ faded: c.faded }" data-testid="approach-item" :data-title="c.segment.item.title" :data-minutes="c.minutes"
        :data-at-end="atEnd ? 'true' : undefined"
        :style="{ left: `${NOW_PX + c.x}px`, top: `${TICK_PX + c.row * ROW_PX + 1}px`, width: `${c.width}px`, zIndex: i + 2 }"
      >
        <ItemView :segment="c.segment" variant="chip" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.approach { position: relative; flex: none; min-width: 0; overflow: hidden; }
.tick { position: absolute; top: 0; transform: translateX(-50%); font-size: 10px; line-height: 12px; opacity: 0.7; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }
.line { position: absolute; left: 0; right: 0; top: 21px; height: 2px; border-radius: 1px; background: color-mix(in srgb, currentColor 30%, transparent); }
.now { position: absolute; left: 0; top: 17px; width: 10px; height: 10px; border-radius: 50%; background: var(--md-sys-color-primary); z-index: 1; }
.in { position: absolute; font-size: 11px; line-height: 20px; opacity: 0.85; white-space: nowrap; font-variant-numeric: tabular-nums; }
.item { position: absolute; display: flex; min-width: 0; height: 18px; overflow: hidden; transition: left 300ms ease, width 300ms ease; }
.item > * { flex: 1 1 auto; min-width: 0; }
.item.faded { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12px); mask-image: linear-gradient(90deg, transparent, #000 12px); }
html[data-motion='off'] .item, html[data-motion='reduced'] .item { transition: none; }
</style>
