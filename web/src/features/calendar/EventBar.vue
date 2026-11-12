<script setup lang="ts">
/**
 * Solid bar for a multi-day event, one segment per week row (month) or per visible range (week / day).
 * The parent places it in a 7-column grid (`--c0`, `--c1`, `--lane`). Tap opens the event; dragging moves the whole
 * event by whole days (`chip`: month view, drawn like a chip of that cell, no continuation arrows): the shift is the drop cell minus the day cell the bar was grabbed on.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { elOf } from '@/lib/elOf';
import { computed, ref } from 'vue';
import { onColor } from '@/api/colors';
import { openItem } from '@/extensions/registry';
import { inPreview } from '@/composables/usePreview';
import { specialMarker } from '@/lib/items';
import { vRipple } from '@/lib/ripple';
import { vFade } from '@/lib/fade';
import { barSegment, type Bar } from '@/lib/spans';
import { useCalendarDrag } from './dnd';
import { t } from '@/i18n';

const props = defineProps<{ bar: Bar; dates: string[]; chip?: boolean }>();
const rootRef = ref<unknown>(null);
/** The `Pressable`'s element (a template ref points at the component). */
const root = computed(() => elOf(rootRef.value));
const ev = computed(() => props.bar.item);
let grab = props.bar.startDate;
function onDown(e: PointerEvent) {
  const r = root.value!.getBoundingClientRect();
  const n = props.bar.endCol - props.bar.startCol + 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / (r.width || 1)) * n)));
  grab = props.dates[props.bar.startCol + i];
}
// a preview copy (swipe neighbour) is inert: no drag handlers
if (!inPreview()) useCalendarDrag(root, () => barSegment(ev.value, grab), () => 'allday', () => !!ev.value.special || !!ev.value.readOnly);
const marker = computed(() => specialMarker(ev.value));
let dragged = false;
function onClick(e: MouseEvent) {
  e.stopPropagation();
  if (!dragged) openItem(ev.value);
}
</script>

<template>
  <Pressable
    ref="rootRef" v-ripple class="bar skin" :class="{ from: bar.continuedFromPrev, next: bar.continuesToNext, chip }" type="button" data-testid="event-bar"
    :data-event-id="ev.id" :data-title="ev.title" :data-start="bar.startDate" :data-end="bar.endDate" :data-lane="bar.lane" :data-all-day="ev.allDay"
    :data-color="ev.color" :data-special="ev.special" :style="{ '--c': ev.color, '--on-solid': onColor(ev.color), gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`, gridRow: bar.lane + 1 }"
    :aria-label="t('calendar.item.range', { title: ev.title, start: bar.startDate, end: bar.endDate })" @pointerdown.capture="onDown" @click="onClick"
  >
    <span v-if="!chip && bar.continuedFromPrev" class="arr" aria-hidden="true">◂</span>
    <span v-fade:x class="title" data-testid="event-bar-title"><span v-if="marker" class="mark" data-testid="event-marker" aria-hidden="true">{{ marker }}</span>{{ ev.title }}</span>
    <span v-if="!chip && bar.continuesToNext" class="arr" aria-hidden="true">▸</span>
  </Pressable>
</template>

<style scoped>
.bar {
  display: flex; align-items: center; gap: 3px; min-width: 0; height: var(--bar-h, 20px); margin: 0 1px; padding: var(--entry-pad-bar); overflow: hidden;
  font: var(--entry-font); text-align: left; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; pointer-events: auto; z-index: 2;
}
.bar.from { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: 0; }
.bar.next { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: 0; }
.bar[data-dragging='true'] { cursor: grabbing; z-index: 30; }
.title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mark { margin-right: 3px; font-size: var(--entry-mark); }
.arr { flex: none; font-size: var(--entry-micro); opacity: 0.85; }
html[data-calm='true'] .bar { filter: saturate(0.6); }
@media (max-width: 767.98px) { .bar .title { text-overflow: clip; } .bar .title[data-cut='true'] { -webkit-mask-image: var(--fade-end); mask-image: var(--fade-end); } }
/* month view: same height (from the row), padding, type and radius as an entry chip; the margin is the cell padding so the ends line up with chips */
.bar.chip { gap: 4px; margin: 0 var(--pad, 1px); }
.bar.chip.from { margin-left: 0; }
.bar.chip.next { margin-right: 0; }
</style>
