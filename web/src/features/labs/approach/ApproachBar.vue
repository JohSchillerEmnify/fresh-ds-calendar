<script setup lang="ts">
/**
 * Approach bar: the Approaching card's "Next" line as an absolute time track. Now at the left end, now + the chosen
 * window at the right end, HH:MM ticks thinned to fit, the next timed entries of today as blocks as long as their
 * duration at their start time (the entry's colour and skin like its card, tap opens; only the title, no time,
 * estimate or count), the title inside when it fits, else right after the block; an entry beyond the window waits at the end with "in 5 h".
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { onColor } from '@/api/colors';
import { openItem } from '@/extensions/registry';
import { displayTitle, type Segment } from '@/lib/items';
import { formatDuration } from '@/features/calendar/timeline';
import BedtimeTrack from '@/features/bedtime/BedtimeTrack.vue';
import type { TrackBand } from '@/features/bedtime/bedtime';
import { approachLayout, approachTicks, type ApproachSizes } from './approach';
import { t } from '@/i18n';

const props = defineProps<{ entries: Segment[]; atEnd: boolean; nowMin: number; windowMin: number; bands?: TrackBand[] }>();
/** Width of the waiting entry at the end of the track. */
const CHIP_PX = 96;
/** Room a block needs around its title (padding and border). */
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
const sizes: ApproachSizes = { titlePx: (s) => textPx(displayTitle(s.item)) + CHIP_PAD_PX, endChipPx: CHIP_PX, minBlockPx: 4, gapPx: 4, minTitlePx: 24 };
const layout = computed(() => approachLayout(props.entries, props.nowMin, props.windowMin, track.value, sizes, props.atEnd));
const ticks = computed(() => approachTicks(props.nowMin, props.windowMin, track.value, LABEL_PX));
</script>

<template>
  <div
    ref="el" class="approach" data-testid="approach-bar" role="group" :aria-label="t('calendar.now.track')" :data-window-hours="windowMin / 60"
    :style="{ height: `${TICK_PX + layout.rows * ROW_PX}px` }"
  >
    <BedtimeTrack v-if="bands?.length" :bands="bands" :offset-px="NOW_PX" />
    <span v-for="t in ticks" :key="t.min" class="tick" data-testid="approach-tick" :style="{ left: `${NOW_PX + t.x}px` }">{{ t.label }}</span>
    <span class="line" />
    <span class="now" data-testid="approach-now" />
    <template v-for="(c, i) in layout.chips" :key="c.segment.item.id + c.segment.date">
      <span v-if="atEnd" class="in" :style="{ right: `${c.width + 4}px`, top: `${TICK_PX}px` }">{{ t('calendar.now.inDuration', { duration: formatDuration(c.minutes) }) }}</span>
      <div
        class="item" :class="{ faded: c.faded }" data-testid="approach-item" :data-title="c.segment.item.title" :data-minutes="c.minutes"
        :data-at-end="atEnd ? 'true' : undefined" :data-running="c.running ? 'true' : undefined" :data-title-outside="c.titleOutside ? 'true' : undefined"
        :style="{ left: `${NOW_PX + c.x}px`, top: `${TICK_PX + c.row * ROW_PX + 1}px`, zIndex: i + 2 }"
      >
        <button
          type="button" class="block skin" :class="{ bare: c.titleOutside }" data-testid="approach-block" :aria-label="displayTitle(c.segment.item)"
          :style="{ width: `${c.width}px`, '--c': c.segment.item.color, '--on-solid': onColor(c.segment.item.color) }" @click="openItem(c.segment.item)"
        ><span v-if="!c.titleOutside" class="label">{{ displayTitle(c.segment.item) }}</span></button>
        <!-- the block carries the entry's label; the title beside it is a second tap target only -->
        <span
          v-if="c.titleOutside && c.titleWidth > 0" class="title" data-testid="approach-title" aria-hidden="true"
          :style="{ maxWidth: `${c.titleWidth}px` }" @click="openItem(c.segment.item)"
        >{{ displayTitle(c.segment.item) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.approach { position: relative; flex: none; min-width: 0; overflow: hidden; }
.tick { position: absolute; top: 0; transform: translateX(-50%); font-size: 10px; line-height: 12px; opacity: 0.7; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }
.line { position: absolute; left: 0; right: 0; top: 21px; height: 2px; border-radius: 1px; background: color-mix(in srgb, currentColor 30%, transparent); }
.now { position: absolute; left: 0; top: 17px; width: 10px; height: 10px; border-radius: 50%; background: var(--md-sys-color-primary); z-index: 1; }
/* like .title: the card colour behind "in 5 h" cuts a gap into the track line, so it never reads as struck through */
.in { position: absolute; z-index: 1; padding: 0 4px; border-radius: 4px; background: var(--approach-bg, var(--md-sys-color-secondary-container));
  font-size: 11px; line-height: 20px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.item { position: absolute; display: flex; align-items: center; gap: 4px; height: 18px; transition: left 300ms ease; }
.block { flex: none; display: flex; align-items: center; box-sizing: border-box; height: 18px; min-width: 0; margin: 0; padding: 0 4px; overflow: hidden;
  font: inherit; font-size: 12px; font-weight: 500; line-height: 16px; text-align: left; cursor: pointer; transition: width 300ms ease; }
/* the track shows when an entry starts, so the block carries only the title */
/* title outside: the block is just the entry's colour, however short */
.block.bare { padding: 0; }
.label { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.title { flex: none; min-width: 0; font-size: 11px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
  /* The card colour behind the title cuts a gap into the track line, so the title never reads as struck through. */
  position: relative; z-index: 1; padding: 0 4px; border-radius: 4px; background: var(--approach-bg, var(--md-sys-color-secondary-container)); }
.item.faded { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12px); mask-image: linear-gradient(90deg, transparent, #000 12px); }
html[data-motion='off'] .item, html[data-motion='reduced'] .item, html[data-motion='off'] .block, html[data-motion='reduced'] .block { transition: none; }
</style>
