<script setup lang="ts">
/**
 * Approach bar (Labs): the now card's "Next" line as an absolute time track. Now at the left end, now + the chosen
 * window at the right end, HH:MM ticks thinned to fit, the next timed entries of today as blocks as long as their
 * duration at their start time (the month view's compact chip: colour, skin, tap opens), the title inside when it
 * fits, else right after the block; an entry beyond the window waits at the end with "in 5 h".
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import ItemView from '@/components/calendar/ItemView.vue';
import { openItem } from '@/extensions/registry';
import type { Segment } from '@/lib/items';
import { formatDuration } from '@/features/calendar/timeline';
import { approachLayout, approachTicks, type ApproachSizes } from './approach';

const props = defineProps<{ entries: Segment[]; atEnd: boolean; nowMin: number; windowMin: number }>();
/** Width of the waiting entry at the end of the track. */
const CHIP_PX = 96;
/** Room a chip needs around its title (padding and border). */
const CHIP_PAD_PX = 12;
const ROW_PX = 20;
const TICK_PX = 12;
/** Room one HH:MM label needs, gap included. */
const LABEL_PX = 40;
/** Chips start right of the now dot, so a chip about to start never hides it. */
const NOW_PX = 12;
const el = ref<HTMLElement | null>(null);
const { width } = useElementSize(el);
const track = computed(() => Math.max(0, width.value - NOW_PX));
let ctx: CanvasRenderingContext2D | null | undefined;
/** Width of a chip title in px (canvas text metrics in the chip's font, else a rough estimate). */
function textPx(text: string): number {
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
    if (ctx) ctx.font = `500 12px ${getComputedStyle(document.body).fontFamily}`;
  }
  return ctx ? ctx.measureText(text).width : text.length * 7;
}
const sizes: ApproachSizes = { titlePx: (s) => textPx(s.item.title) + CHIP_PAD_PX, endChipPx: CHIP_PX, minBlockPx: 4, gapPx: 4, minTitlePx: 24 };
const layout = computed(() => approachLayout(props.entries, props.nowMin, props.windowMin, track.value, sizes, props.atEnd));
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
        :data-at-end="atEnd ? 'true' : undefined" :data-running="c.running ? 'true' : undefined" :data-title-outside="c.titleOutside ? 'true' : undefined"
        :style="{ left: `${NOW_PX + c.x}px`, top: `${TICK_PX + c.row * ROW_PX + 1}px`, zIndex: i + 2 }"
      >
        <div class="block" :class="{ bare: c.titleOutside }" data-testid="approach-block" :style="{ width: `${c.width}px` }">
          <ItemView :segment="c.segment" variant="chip" />
        </div>
        <!-- the block carries the entry's label; the title beside it is a second tap target only -->
        <span
          v-if="c.titleOutside && c.titleWidth > 0" class="title" data-testid="approach-title" aria-hidden="true"
          :style="{ maxWidth: `${c.titleWidth}px` }" @click="openItem(c.segment.item)"
        >{{ c.segment.item.title }}</span>
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
.item { position: absolute; display: flex; align-items: center; gap: 4px; height: 18px; transition: left 300ms ease; }
.block { flex: none; display: flex; height: 18px; overflow: hidden; transition: width 300ms ease; }
.block > * { flex: 1 1 auto; min-width: 0; }
/* the track shows when an entry starts: no time in the chip */
.block :deep(.time) { display: none; }
/* title outside: the block is just the entry's colour */
.block.bare > :deep(*) { padding: 0; }
.block.bare > :deep(*) > * { visibility: hidden; }
.title { flex: none; min-width: 0; font-size: 11px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
  /* The card colour behind the title cuts a gap into the track line, so the title never reads as struck through. */
  position: relative; z-index: 1; padding: 0 4px; border-radius: 4px; background: var(--approach-bg, var(--md-sys-color-secondary-container)); }
.item.faded { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12px); mask-image: linear-gradient(90deg, transparent, #000 12px); }
html[data-motion='off'] .item, html[data-motion='reduced'] .item, html[data-motion='off'] .block, html[data-motion='reduced'] .block { transition: none; }
</style>
