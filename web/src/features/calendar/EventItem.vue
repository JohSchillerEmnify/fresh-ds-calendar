<script setup lang="ts">
/**
 * Event renderer (registered for kind 'event'): dot / chip (month) / allday bar / proportional time-grid block.
 * Title first: narrow or short blocks drop the time line, titles wrap to 2 lines before clipping. Past events of
 * today are dimmed, the running one gets a ring. Draggable through `useCalendarDrag` (long press on touch).
 */
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { onColor } from '@/api/colors';
import type { CalendarEvent } from '@/api/types';
import type { ItemRendererProps } from '@/extensions/registry';
import { isPhone } from '@/composables/useViewport';
import { vRipple } from '@/lib/ripple';
import { useClockStore } from '@/stores/clock';
import { cardClick, useCalendarDrag } from './dnd';
import { blockBudget } from './lineBudget';
import { formatDuration } from './timeline';

const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: [] }>();
const clock = useClockStore();
const root = ref<HTMLElement | null>(null);
const ev = computed(() => props.segment.item as CalendarEvent);
useCalendarDrag(root, () => props.segment, () => props.variant);

const endText = computed(() => (props.segment.endTime === '24:00' ? '00:00' : props.segment.endTime));
const isToday = computed(() => props.segment.date === clock.today);
const past = computed(() => isToday.value && !props.segment.allDay && props.segment.endMin <= clock.minutesNow);
const current = computed(() => isToday.value && !props.segment.allDay && props.segment.startMin <= clock.minutesNow && clock.minutesNow < props.segment.endMin);
const h = computed(() => props.height ?? 0);
const { width } = useElementSize(root);
/** Narrow (<= 76 px) blocks use 11 px / 13 px type; the budget is derived from the real box, not fixed. */
const narrow = computed(() => width.value > 0 && width.value <= 76);
const budget = computed(() => blockBudget({
  title: ev.value.title, height: h.value, width: width.value || 120, padV: 4, lineH: narrow.value ? 13 : 16, timeH: 14,
  charW: narrow.value ? 5.6 : 6.9, padH: narrow.value ? 6 : 12,
}));
const showTime = computed(() => props.variant === 'block' && !!props.segment.startTime && budget.value.time);
const showDuration = computed(() => showTime.value && h.value >= 58);
const lines = computed(() => budget.value.lines);
const duration = computed(() => formatDuration(props.segment.endMin - props.segment.startMin));
const timeText = computed(() => {
  const s = props.segment;
  if (!s.startTime) return '';
  return props.variant === 'block' ? `${s.startTime}–${endText.value}` : s.startTime;
});
const showChipTime = computed(() => props.variant === 'chip' && !isPhone.value && !!props.segment.startTime);
</script>

<template>
  <button
    ref="root" v-ripple class="ev" :class="[variant, { cont: !segment.first || !segment.last, nofirst: !segment.first, nolast: !segment.last, past, current }]"
    type="button" data-testid="event-chip" :data-event-id="ev.id" :data-title="ev.title" :data-date="segment.date" :data-all-day="ev.allDay"
    :data-start-time="segment.startTime ?? ''" :data-end-time="segment.endTime ?? ''" :data-color="ev.color" :data-past="past || undefined" :data-current="current || undefined"
    :style="{ '--c': ev.color, '--on': onColor(ev.color), '--lines': lines }" :aria-label="`${ev.title}${segment.startTime ? ', ' + timeText : ''}`" @click="cardClick($event, () => emit('open'))"
  >
    <template v-if="variant === 'dot'"><span class="dotc" /></template>
    <template v-else-if="variant === 'block'">
      <span class="title" data-testid="event-chip-title">{{ ev.title }}</span>
      <span v-if="showTime" class="meta">
        <span class="time" data-testid="event-chip-time">{{ timeText }}</span><span v-if="showDuration" class="dur"> · {{ duration }}</span>
      </span>
    </template>
    <template v-else>
      <span v-if="showChipTime" class="time" data-testid="event-chip-time">{{ timeText }}</span>
      <span class="title" data-testid="event-chip-title">{{ ev.title }}</span>
    </template>
  </button>
</template>

<style scoped>
.ev {
  --bg: color-mix(in srgb, var(--c) 26%, var(--md-sys-color-surface));
  display: flex; min-width: 0; width: 100%; text-align: left; color: var(--md-sys-color-on-surface); background: var(--bg);
  border-radius: var(--md-sys-shape-corner-extra-small); font: var(--md-sys-typescale-label-medium); border-left: 3px solid var(--c);
  padding: 1px 4px; overflow: hidden; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.ev[data-dragging='true'] { cursor: grabbing; }
.ev.past { opacity: 0.62; }
.ev.current { box-shadow: 0 0 0 1.5px var(--c); }
html[data-calm='true'] .ev { --bg: color-mix(in srgb, var(--c) 13%, var(--md-sys-color-surface)); filter: saturate(0.55); }

.chip { min-height: 18px; align-items: center; gap: 4px; line-height: 16px; border-left-width: 2px; }
.chip .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; flex: 1; }
.chip .time { flex: none; font-weight: 500; opacity: 0.85; font-variant-numeric: tabular-nums; }
.dot { width: 8px; min-height: 8px; height: 8px; padding: 0; border: 0; background: var(--c); border-radius: 50%; }

.allday { min-height: 22px; align-items: center; background: var(--c); color: var(--on); border-left: 0; padding: 1px 6px; }
.allday .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.allday.nofirst { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.allday.nolast { border-top-right-radius: 0; border-bottom-right-radius: 0; }

.block { container-type: inline-size; height: 100%; flex-direction: column; justify-content: flex-start; gap: 0; padding: 2px 5px 2px 6px; border-radius: 7px; box-shadow: 0 0 0 1px var(--md-sys-color-surface), 0 1px 3px rgb(0 0 0 / 0.28); --bg: color-mix(in srgb, var(--c) 30%, var(--md-sys-color-surface)); }
.block .title {
  font: var(--md-sys-typescale-label-large); font-size: 13px; line-height: 16px; display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--lines); line-clamp: var(--lines); overflow: hidden; overflow-wrap: break-word; word-break: normal; hyphens: auto; white-space: normal; flex: none;
}
.block .meta { font: var(--md-sys-typescale-label-small); font-size: 11px; line-height: 14px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; font-variant-numeric: tabular-nums; }
.block.nofirst { border-top-left-radius: 0; border-top-right-radius: 0; }
.block.nolast { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
@container (max-width: 76px) {
  .block { padding: 1px 2px 1px 3px; border-left-width: 2px; }
  .block .title { font-size: 11px; line-height: 13px; letter-spacing: -0.2px; }
  .block .dur { display: none; }
}

/* phones: smaller type, tight padding, no ellipsis in the month: clip with a fade instead */
@media (max-width: 767.98px) {
  .chip { font: var(--md-sys-typescale-label-small); font-size: 10px; line-height: 14px; min-height: 16px; padding: 0 2px 0 3px; border-radius: 3px; }
  .chip .title { text-overflow: clip; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); }
  .allday { font-size: 10px; line-height: 14px; min-height: 18px; padding: 0 3px; }
  .allday .title { text-overflow: clip; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); }
}
</style>
