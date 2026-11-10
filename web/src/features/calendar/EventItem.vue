<script setup lang="ts">
/**
 * Event renderer (registered for kind 'event'): dot / chip (month) / allday bar / proportional time-grid block.
 * Title first: narrow or short blocks drop the time line, titles wrap to 2 lines before clipping; room left over shows location, then description lines. Past events of
 * today are dimmed, the running one gets a ring. Draggable through `useCalendarDrag` (long press on touch).
 */
import { useChipTimes } from '@/composables/useMonthZoom';
import Pressable from '@/components/m3/Pressable.vue';
import { elOf } from '@/lib/elOf';
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { onColor } from '@/api/colors';
import type { CalendarEvent } from '@/api/types';
import type { ItemRendererProps } from '@/extensions/registry';
import { isPhone } from '@/composables/useViewport';
import { inPreview } from '@/composables/usePreview';
import { specialMarker } from '@/lib/items';
import { vRipple } from '@/lib/ripple';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { entryBorderPx, entryStyle } from '@/theme/entryStyle';
import { useUiStore } from '@/stores/ui';
import { cardClick, useCalendarDrag } from './dnd';
import ResizeHandles from './ResizeHandles.vue';
import { showsHandles } from './resize';
import { blockBudget } from '@/lib/lineBudget';
import { formatDuration } from './timeline';
import { t } from '@/i18n';

const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: [] }>();
const clock = useClockStore();
const ui = useUiStore();
const prefs = usePrefsStore();
const rootRef = ref<unknown>(null);
/** The root `Pressable`'s element (a template ref points at the component). */
const root = computed(() => elOf(rootRef.value));
const ev = computed(() => props.segment.item as CalendarEvent);
// a preview copy (swipe neighbour) is inert: no drag handlers
// birthdays and events that are not the person's own (invitations, other people's calendars) are read-only: they do not drag
const marker = computed(() => specialMarker(ev.value));
if (!inPreview()) useCalendarDrag(root, () => props.segment, () => props.variant, () => !!ev.value.special || !!ev.value.readOnly);
/** Resize handles show after a release without moving (time grid blocks only). */
const resizing = computed(() => showsHandles(ui.resizing, props.segment, props.variant));

const endText = computed(() => (props.segment.endTime === '24:00' ? '00:00' : props.segment.endTime));
const isToday = computed(() => props.segment.date === clock.today);
const past = computed(() => isToday.value && !props.segment.allDay && props.segment.endMin <= clock.minutesNow);
const current = computed(() => isToday.value && !props.segment.allDay && props.segment.startMin <= clock.minutesNow && clock.minutesNow < props.segment.endMin);
const h = computed(() => props.height ?? 0);
// only a time grid block's look depends on its width: chips are not observed (a month holds hundreds, and each mount read forces a layout)
// One border-box observer per block: the border box does not change with the padding or the entry
// style's border, so the narrow look (tight padding and smaller type together) cannot flip back and forth or disagree.
const { width: boxWidth } = useElementSize(computed(() => (props.variant === 'block' ? root.value : null)), undefined, { box: 'border-box' });
/** Narrow blocks (border box <= 84 px) use the tight padding and the smaller type (--entry-meta, 13 px lines). */
const narrow = computed(() => boxWidth.value > 0 && boxWidth.value <= 84);
/** Left plus right border of the page's entry style (0 solid, 3 tinted, 4 outline), reactive so a live style change counts. */
const border = computed(() => entryBorderPx(entryStyle.value));
/** The content width the title wraps in: the border box less the padding (2 + 3 px narrow, 5 + 6 px otherwise) and border. */
const width = computed(() => (boxWidth.value ? Math.max(0, boxWidth.value - (narrow.value ? 5 : 11) - border.value) : 0));
const budget = computed(() => blockBudget({
  title: ev.value.title, height: h.value, width: width.value || 120, padV: 4, lineH: narrow.value ? 13 : 16, timeH: 14,
  charW: narrow.value ? 5.6 : 6.9, padH: narrow.value ? 6 : 12,
}));
const showTime = computed(() => props.variant === 'block' && !!props.segment.startTime && budget.value.time);
/** Room left under the time row (px): location, then description lines, fill it in that order. */
const spare = computed(() => (budget.value.time ? Math.max(0, h.value - 4 - budget.value.lines * (narrow.value ? 13 : 16) - 14) : 0));
const showLocation = computed(() => showTime.value && !!ev.value.location && spare.value >= 14);
const descLines = computed(() => (showLocation.value && ev.value.description ? Math.floor((spare.value - 14) / 14) : 0));
const showDuration = computed(() => showTime.value && h.value >= 58);
const lines = computed(() => budget.value.lines);
const duration = computed(() => formatDuration(props.segment.endMin - props.segment.startMin));
/** The running entry's time left, shown on its own time line when the Approaching card does not carry it (card or its time-left line off). */
const timeLeft = computed(() => (current.value && !(prefs.approachingCard && prefs.approachTimeLeft) ? t('calendar.nowNext.left', { left: formatDuration(props.segment.endMin - clock.minutesNow) }) : ''));
const timeText = computed(() => {
  const s = props.segment;
  if (!s.startTime) return '';
  return props.variant === 'block' ? `${s.startTime}–${endText.value}` : s.startTime;
});
/** Start time on a chip: on wide screens, and on a phone in a zoomed-in month (feature month-zoom). */
const chipTimes = useChipTimes();
const showChipTime = computed(() => props.variant === 'chip' && (!isPhone.value || chipTimes.value) && !!props.segment.startTime);
</script>

<template>
  <Pressable
    ref="rootRef" v-ripple class="ev skin" :class="[variant, { cont: !segment.first || !segment.last, nofirst: !segment.first, nolast: !segment.last, past, current, resizing, narrow }]"
    type="button" data-testid="event-chip" :data-event-id="ev.id" :data-calendar-id="ev.calendarId" :data-title="ev.title" :data-date="segment.date" :data-all-day="ev.allDay"
    :data-start-time="segment.startTime ?? ''" :data-end-time="segment.endTime ?? ''" :data-color="ev.color" :data-special="ev.special" :data-past="past || undefined" :data-current="current || undefined"
    :style="{ '--c': ev.color, '--on-solid': onColor(ev.color), '--lines': lines }" :aria-label="`${ev.special ? t(`calendar.item.${ev.special}`) + ': ' : ''}${ev.title}${segment.startTime ? ', ' + timeText : ''}`" @click="cardClick($event, () => emit('open'))"
  >
    <template v-if="variant === 'dot'"><span class="dotc" /></template>
    <template v-else-if="variant === 'block'">
      <span class="title" data-testid="event-chip-title"><span v-if="marker" class="mark" data-testid="event-marker" aria-hidden="true">{{ marker }}</span>{{ ev.title }}</span>
      <span v-if="showTime" class="meta">
        <span class="time" data-testid="event-chip-time">{{ timeText }}<template v-if="timeLeft"> · {{ timeLeft }}</template></span><span v-if="!timeLeft && showDuration" class="dur"> · {{ duration }}</span>
      </span>
      <span v-if="showLocation" class="meta" data-testid="event-chip-location">{{ ev.location }}</span>
      <span v-if="descLines > 0" class="desc" data-testid="event-chip-description" :style="{ '--dlines': descLines }">{{ ev.description }}</span>
      <ResizeHandles v-if="resizing" :segment="segment" />
    </template>
    <template v-else>
      <span v-if="showChipTime" class="time" data-testid="event-chip-time">{{ timeText }}</span>
      <span class="title" data-testid="event-chip-title"><span v-if="marker" class="mark" data-testid="event-marker" aria-hidden="true">{{ marker }}</span>{{ ev.title }}</span>
    </template>
  </Pressable>
</template>

<style scoped>
.ev {
  display: flex; min-width: 0; width: 100%; text-align: left;
  font: var(--entry-font);
  padding: var(--entry-pad-chip); overflow: hidden; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.ev[data-dragging='true'] { cursor: grabbing; }
.mark { margin-right: 3px; font-size: var(--entry-mark); }
/* the handles stick out of the block: the title and meta lines clip themselves */
.ev.resizing { position: relative; overflow: visible; }
.ev.past { opacity: 0.62; }
.ev.current { box-shadow: 0 0 0 1.5px var(--md-sys-color-surface), 0 0 0 3px var(--c), var(--glow-sh); }
html[data-calm='true'] .ev { filter: saturate(0.55); }

.chip { min-height: 18px; align-items: center; gap: 4px; }
.chip .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; flex: 1; }
.chip .time { flex: none; font-weight: 500; opacity: 0.85; font-variant-numeric: tabular-nums; }
.dot { width: 8px; min-height: 8px; height: 8px; padding: 0; border: 0; background: var(--c); border-radius: 50%; }

.allday { min-height: 22px; align-items: center; padding: var(--entry-pad-allday); }
.allday .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.allday.nofirst { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.allday.nolast { border-top-right-radius: 0; border-bottom-right-radius: 0; }

.block { height: 100%; flex-direction: column; justify-content: flex-start; gap: 0; padding: var(--entry-pad-block); border-radius: var(--r-block); box-shadow: var(--block-sh); }
.block .title {
  font-size: var(--entry-title-lg); line-height: 16px; display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--lines); line-clamp: var(--lines); overflow: hidden; overflow-wrap: break-word; word-break: normal; hyphens: auto; white-space: normal; flex: none;
}
.block .meta { font-size: var(--entry-meta); font-weight: var(--entry-weight); line-height: 14px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; font-variant-numeric: tabular-nums; }
.block .desc { font-size: var(--entry-meta); line-height: 14px; opacity: 0.8; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--dlines); line-clamp: var(--dlines); overflow: hidden; overflow-wrap: break-word; flex: none; }
.block.nofirst { border-top-left-radius: 0; border-top-right-radius: 0; }
.block.nolast { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.block.narrow { padding: var(--entry-pad-block-narrow); }
.block.narrow .title { font-size: var(--entry-meta); line-height: 13px; letter-spacing: -0.2px; }
.block.narrow .dur { display: none; }

/* phones: tighter boxes (type and padding come from the --entry-* tokens); clip with a fade instead of an ellipsis */
@media (max-width: 767.98px) {
  .chip { min-height: 16px; }
  .chip .title { text-overflow: clip; -webkit-mask-image: var(--fade-end); mask-image: var(--fade-end); }
  .allday { min-height: 18px; }
  .allday .title { text-overflow: clip; -webkit-mask-image: var(--fade-end); mask-image: var(--fade-end); }
}
</style>
