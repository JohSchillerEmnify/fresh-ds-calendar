<script setup lang="ts">
/**
 * Labs: one horizontal axis across days, items placed by time (ARCHITECTURE "Labs"). Reads the items store,
 * loads a range around today (extendable at both edges), marks now with the app clock, zooms with wheel/pinch.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { addDays, format } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { parseIsoDate, toIsoDate } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useCalendarsStore } from '@/stores/calendars';
import { useSyncStore } from '@/stores/sync';

const DAYS_BEFORE = 2;
const DAYS_AFTER = 14;
const EXTEND_DAYS = 7;
const MIN_PX_PER_HOUR = 8;
const MAX_PX_PER_HOUR = 240;
const HEAD_H = 32;
const ALLDAY_H = 28;
const MIN_LANE_H = 34;
const MAX_LANE_H = 140;
const MIN_W = 14;

const clock = useClockStore();
const items = useItemsStore();
const cals = useCalendarsStore();
const sync = useSyncStore();

const startDate = ref(addDays(clock.todayDate, -DAYS_BEFORE));
const dayCount = ref(DAYS_BEFORE + DAYS_AFTER);
const pxPerHour = ref(90);
const viewH = ref(600);
const scroller = ref<HTMLElement | null>(null);

const pxPerMin = computed(() => pxPerHour.value / 60);
const width = computed(() => dayCount.value * 1440 * pxPerMin.value);
const days = computed(() => Array.from({ length: dayCount.value }, (_, i) => addDays(startDate.value, i)));
const startIso = computed(() => toIsoDate(startDate.value));
const dayX = (date: string): number => {
  const d = parseIsoDate(date);
  return d ? Math.round((d.getTime() - startDate.value.getTime()) / 86_400_000) * 1440 : 0;
};

/** Load the shown range through the shared items store (same path as the other views). */
function load() {
  const from = startIso.value;
  const to = toIsoDate(addDays(startDate.value, dayCount.value));
  items.setVisible(from, to).then(() => { if (sync.error) sync.clearError(); }, (e) => sync.reportError(e));
}

interface Placed { seg: Segment; x: number; w: number; lane: number }
/** Greedy lanes: an item goes to the first lane that is free at its start. */
function lane(base: Array<{ seg: Segment; x: number; w: number }>): Placed[] {
  const laneEnd: number[] = [];
  return base.sort((a, b) => a.x - b.x || a.seg.item.title.localeCompare(b.seg.item.title)).map((b) => {
    let l = laneEnd.findIndex((e) => e <= b.x);
    if (l < 0) l = laneEnd.length;
    laneEnd[l] = b.x + b.w + 4;
    return { ...b, lane: l };
  });
}
const isAllDay = (s: Segment) => s.allDay || s.startTime === null;
/** All visible segments of the loaded range. */
const segments = computed<Segment[]>(() => {
  const from = startIso.value;
  const to = toIsoDate(addDays(startDate.value, dayCount.value));
  const segs: Segment[] = [];
  for (const [date, list] of items.byDate) {
    if (date < from || date >= to) continue;
    for (const s of list) if (!cals.isHidden(s.item.calendarId)) segs.push(s);
  }
  return segs;
});
/** Timed items, as long as they last (time blindness: never equal sizes). */
const placed = computed<Placed[]>(() => lane(segments.value.filter((s) => !isAllDay(s)).map((seg) => ({
  seg, x: (dayX(seg.date) + seg.startMin) * pxPerMin.value, w: Math.max((seg.endMin - seg.startMin) * pxPerMin.value, MIN_W),
}))));
/** All-day / untimed entries: one day wide each, in their own band on top. */
const alldays = computed<Placed[]>(() => lane(segments.value.filter(isAllDay).map((seg) => ({
  seg, x: dayX(seg.date) * pxPerMin.value + 2, w: 1440 * pxPerMin.value - 4,
}))));
const bandH = computed(() => (alldays.value.length ? Math.max(...alldays.value.map((p) => p.lane + 1)) * ALLDAY_H + 8 : 0));
const lanes = computed(() => Math.max(1, ...placed.value.map((p) => p.lane + 1)));
const timedTop = computed(() => HEAD_H + bandH.value);
/** Lanes share the remaining viewport height, so the view uses all of it. */
const laneH = computed(() => Math.min(MAX_LANE_H, Math.max(MIN_LANE_H, Math.floor((viewH.value - timedTop.value - 12) / lanes.value))));
const axisH = computed(() => Math.max(viewH.value, timedTop.value + lanes.value * laneH.value + 12));

const nowX = computed(() => (dayX(clock.today) + clock.minutesNow) * pxPerMin.value);
const nowInRange = computed(() => nowX.value >= 0 && nowX.value <= width.value);
const nowLabel = computed(() => `${String(Math.floor(clock.minutesNow / 60)).padStart(2, '0')}:${String(clock.minutesNow % 60).padStart(2, '0')}`);

/** Keep the time under `anchorPx` (viewport x) fixed while the scale changes. */
function zoomTo(next: number, anchorPx: number) {
  const el = scroller.value;
  const clamped = Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, next));
  if (!el || clamped === pxPerHour.value) return;
  const minAt = (el.scrollLeft + anchorPx) / pxPerMin.value;
  pxPerHour.value = clamped;
  nextTick(() => { el.scrollLeft = minAt * pxPerMin.value - anchorPx; });
}
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // plain horizontal scroll
  e.preventDefault();
  const rect = scroller.value!.getBoundingClientRect();
  zoomTo(pxPerHour.value * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - rect.left);
}
const pointers = new Map<number, number>();
let pinchStart: { dist: number; zoom: number } | null = null;
function onPointerDown(e: PointerEvent) { pointers.set(e.pointerId, e.clientX); }
function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, e.clientX);
  if (pointers.size !== 2) return;
  const [a, b] = [...pointers.values()];
  const dist = Math.abs(a - b);
  pinchStart ??= { dist, zoom: pxPerHour.value };
  const rect = scroller.value!.getBoundingClientRect();
  if (pinchStart.dist > 0) zoomTo(pinchStart.zoom * (dist / pinchStart.dist), (a + b) / 2 - rect.left);
}
function onPointerUp(e: PointerEvent) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null; }

/** Grow the axis when the edge is near; keeps the view still when growing to the left. */
function onScroll() {
  const el = scroller.value;
  if (!el) return;
  const edge = el.clientWidth;
  if (el.scrollLeft + el.clientWidth > el.scrollWidth - edge) {
    dayCount.value += EXTEND_DAYS;
    load();
  } else if (el.scrollLeft < edge) {
    const add = EXTEND_DAYS * 1440 * pxPerMin.value;
    startDate.value = addDays(startDate.value, -EXTEND_DAYS);
    dayCount.value += EXTEND_DAYS;
    nextTick(() => { el.scrollLeft += add; });
    load();
  }
}

/** Open with now about a third in from the left. */
function scrollToNow() {
  const el = scroller.value;
  if (el) el.scrollLeft = Math.max(0, nowX.value - el.clientWidth / 3);
}
let ro: ResizeObserver | undefined;
onMounted(() => {
  load();
  nextTick(scrollToNow);
  if (scroller.value) {
    viewH.value = scroller.value.clientHeight;
    ro = new ResizeObserver(() => { viewH.value = scroller.value?.clientHeight ?? viewH.value; });
    ro.observe(scroller.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());
watch(() => clock.today, () => nextTick(scrollToNow), { once: true });
</script>

<template>
  <section class="tl" data-testid="timeline-view">
    <div
      ref="scroller" class="scroll" data-scroll-area data-testid="timeline-scroll" :data-px-per-hour="pxPerHour"
      @wheel="onWheel" @scroll.passive="onScroll" @pointerdown="onPointerDown" @pointermove="onPointerMove"
      @pointerup="onPointerUp" @pointercancel="onPointerUp"
    >
      <div class="axis" :style="{ width: width + 'px', height: axisH + 'px' }">
        <div
          v-for="(d, i) in days" :key="i" class="day" :class="{ today: toIsoDate(d) === clock.today }"
          :style="{ left: i * 1440 * pxPerMin + 'px', width: 1440 * pxPerMin + 'px' }" data-testid="timeline-day" :data-date="toIsoDate(d)"
        >
          <span class="dl">{{ format(d, 'EEE d MMM') }}</span>
        </div>
        <div v-if="alldays.length" class="allday" data-testid="timeline-allday" :style="{ top: HEAD_H + 'px', height: bandH + 'px' }">
          <div
            v-for="p in alldays" :key="p.seg.item.id + p.seg.date" class="item"
            data-testid="timeline-item" :data-title="p.seg.item.title" :data-date="p.seg.date"
            :style="{ left: p.x + 'px', top: 4 + p.lane * ALLDAY_H + 'px', width: p.w + 'px', height: ALLDAY_H - 4 + 'px' }"
          >
            <ItemView :segment="p.seg" variant="allday" />
          </div>
        </div>
        <div
          v-for="p in placed" :key="p.seg.item.id + p.seg.date" class="item"
          data-testid="timeline-item" :data-title="p.seg.item.title" :data-date="p.seg.date" :style="{ left: p.x + 'px', top: timedTop + p.lane * laneH + 'px', width: p.w + 'px', height: laneH - 4 + 'px' }"
        >
          <ItemView :segment="p.seg" variant="block" :height="laneH - 4" />
        </div>
        <div v-if="nowInRange" class="now" data-testid="timeline-now" :data-time="nowLabel" :style="{ left: nowX + 'px' }">
          <span class="nl">{{ nowLabel }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tl { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; background: var(--md-sys-color-surface); }
.axis { position: relative; min-height: 100%; }
.day { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--md-sys-color-outline-variant); box-sizing: border-box; }
.day.today { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.dl { position: sticky; left: 0; display: inline-block; padding: 8px 8px; font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); white-space: nowrap; }
.day.today .dl { color: var(--md-sys-color-primary); }
.allday { position: absolute; left: 0; right: 0; z-index: 1; border-bottom: 1px solid var(--md-sys-color-outline-variant); pointer-events: none; }
.allday .item { pointer-events: auto; }
.item > * { flex: 1; min-width: 0; }
.item { position: absolute; display: flex; box-sizing: border-box; min-width: 0; }
.now { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--md-sys-color-error); z-index: 2; pointer-events: none; }
.nl { position: absolute; top: 2px; left: 4px; padding: 0 6px; border-radius: 8px; background: var(--md-sys-color-error); color: var(--md-sys-color-on-error); font: var(--md-sys-typescale-label-small); }
</style>
