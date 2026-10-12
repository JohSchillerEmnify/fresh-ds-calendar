<script setup lang="ts">
/**
 * Solid bar for a multi-day event, one segment per week row (month) or per visible range (week / day).
 * The parent places it in a 7-column grid (`--c0`, `--c1`, `--lane`). Tap opens the event; dragging moves the whole
 * event by whole days: the shift is the drop cell minus the day cell the bar was grabbed on.
 */
import { computed, ref } from 'vue';
import { onColor } from '@/api/colors';
import { openItem } from '@/extensions/registry';
import { vRipple } from '@/lib/ripple';
import { barSegment, type Bar } from '@/lib/spans';
import { useCalendarDrag } from './dnd';

const props = defineProps<{ bar: Bar; dates: string[] }>();
const root = ref<HTMLElement | null>(null);
const ev = computed(() => props.bar.item);
let grab = props.bar.startDate;
function onDown(e: PointerEvent) {
  const r = root.value!.getBoundingClientRect();
  const n = props.bar.endCol - props.bar.startCol + 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / (r.width || 1)) * n)));
  grab = props.dates[props.bar.startCol + i];
}
useCalendarDrag(root, () => barSegment(ev.value, grab), () => 'allday');
let dragged = false;
function onClick(e: MouseEvent) {
  e.stopPropagation();
  if (!dragged) openItem(ev.value);
}
</script>

<template>
  <button
    ref="root" v-ripple class="bar skin" :class="{ from: bar.continuedFromPrev, next: bar.continuesToNext }" type="button" data-testid="event-bar"
    :data-event-id="ev.id" :data-title="ev.title" :data-start="bar.startDate" :data-end="bar.endDate" :data-lane="bar.lane" :data-all-day="ev.allDay"
    :data-color="ev.color" :style="{ '--c': ev.color, '--on-solid': onColor(ev.color), gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`, gridRow: bar.lane + 1 }"
    :aria-label="`${ev.title}, ${bar.startDate} to ${bar.endDate}`" @pointerdown.capture="onDown" @click="onClick"
  >
    <span v-if="bar.continuedFromPrev" class="arr" aria-hidden="true">◂</span>
    <span class="title" data-testid="event-bar-title">{{ ev.title }}</span>
    <span v-if="bar.continuesToNext" class="arr" aria-hidden="true">▸</span>
  </button>
</template>

<style scoped>
.bar {
  display: flex; align-items: center; gap: 3px; min-width: 0; height: var(--bar-h, 20px); margin: 0 1px; padding: 0 6px; overflow: hidden;
  font: var(--md-sys-typescale-label-medium); text-align: left; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; pointer-events: auto; z-index: 2;
}
.bar.from { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: 0; }
.bar.next { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: 0; }
.bar[data-dragging='true'] { cursor: grabbing; z-index: 30; }
.title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.arr { flex: none; font-size: 9px; opacity: 0.85; }
html[data-calm='true'] .bar { filter: saturate(0.6); }
@media (max-width: 767.98px) { .bar { font-size: 10px; padding: 0 3px; } }
</style>
