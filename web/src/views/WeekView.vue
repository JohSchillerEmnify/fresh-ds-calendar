<script setup lang="ts">
import { computed } from 'vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import { toIsoDate, weekDays } from '@/lib/dates';
import { providePreview } from '@/composables/usePreview';
import { useDaySegments } from '@/composables/useDaySegments';
import { useCalendarStore } from '@/stores/calendar';
import { usePrefsStore } from '@/stores/prefs';

/** `anchor`/`preview`: a light copy for another period (swipe neighbour), see `usePreview`. */
const props = defineProps<{ anchor?: Date; preview?: boolean }>();
providePreview(props.preview);
const cal = useCalendarStore();
const prefs = usePrefsStore();
const segs = useDaySegments();
const days = computed(() => weekDays(props.anchor ?? cal.anchor));

/**
 * Two-row week overview (experimental): the whole week in two rows that each fill half the height, so it all fits one
 * screen. Each row is a normal `TimeGrid` in fit-to-height mode over one shared active window, so blocks, the all-day
 * band and inline task-list expansion are reused as-is — no parallel layout.
 */
const fit = computed(() => {
  const timed = days.value.flatMap((d) => segs(toIsoDate(d))).filter((s) => !s.allDay && s.startTime !== null);
  if (!timed.length) return { start: 8 * 60, end: 20 * 60 };
  const start = Math.min(...timed.map((s) => s.startMin));
  let end = Math.max(...timed.map((s) => s.endMin));
  if (end - start < 60) end = Math.min(1440, start + 60);
  return { start, end };
});
const rows = computed(() => {
  const top = prefs.weekTwoRowTop === 3 ? 3 : 4;
  return [days.value.slice(0, top), days.value.slice(top)];
});
</script>

<template>
  <section class="v" data-testid="week-view" :data-week-start="toIsoDate(days[0])">
    <template v-if="prefs.weekTwoRow">
      <TimeGrid
        v-for="(rowDates, i) in rows" :key="i" class="row"
        mode="week" :dates="rowDates" :fit="fit" data-testid="week-overview-row" :data-row="i"
      />
    </template>
    <TimeGrid v-else mode="week" :dates="days" />
  </section>
</template>

<style scoped>
.v { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.v > .row { flex: 1; min-height: 0; }
.v > .row + .row { border-top: 1px solid var(--md-sys-color-outline-variant); }
</style>
