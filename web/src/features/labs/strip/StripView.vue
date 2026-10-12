<script setup lang="ts">
/**
 * Labs strip view: days as side-by-side columns in a horizontal scroll-snap strip that extends in both directions
 * while scrolling. The leftmost (front) column is mirrored into the URL without a navigation.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ItemView from '@/components/calendar/ItemView.vue';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { addDays, MONTH_NAMES, parseIsoDate, routePath, toIsoDate, WEEKDAY_LABELS } from '@/lib/dates';
import type { Segment } from '@/lib/items';

/** Days added per extension and the distance (in columns) from an edge that triggers one. */
const CHUNK = 14;
const EDGE = 7;

const route = useRoute();
const router = useRouter();
const items = useItemsStore();
const cals = useCalendarsStore();
const clock = useClockStore();

const scroller = ref<HTMLElement | null>(null);
const initial = parseIsoDate((route.params.param ?? route.params.date) as string) ?? clock.todayDate;
const start = ref(addDays(initial, -CHUNK));
const count = ref(CHUNK * 2 + 1);
const days = computed(() => Array.from({ length: count.value }, (_, i) => toIsoDate(addDays(start.value, i))));
const today = computed(() => clock.today);

/** Segments of one day, without hidden calendars. */
const segs = (date: string): Segment[] => (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
const variantOf = (s: Segment) => (s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip');
const weekday = (d: string) => WEEKDAY_LABELS[(parseIsoDate(d)!.getDay() + 6) % 7];
const dayLabel = (d: string) => `${parseIsoDate(d)!.getDate()} ${MONTH_NAMES[parseIsoDate(d)!.getMonth()].slice(0, 3)}`;

const colWidth = () => scroller.value!.firstElementChild!.getBoundingClientRect().width;
const loadRange = () => items.setVisible(toIsoDate(start.value), toIsoDate(addDays(start.value, count.value))).catch(() => undefined);

let raf = 0;
let urlTimer: ReturnType<typeof setTimeout> | undefined;

/** Extend the strip near either edge; prepending keeps the view still by shifting scrollLeft. */
async function onScroll() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(async () => {
    const el = scroller.value;
    if (!el) return;
    const w = colWidth();
    const front = Math.round(el.scrollLeft / w);
    const visibleCols = Math.round(el.clientWidth / w);
    if (front < EDGE) {
      start.value = addDays(start.value, -CHUNK);
      count.value += CHUNK;
      await nextTick();
      el.scrollLeft += CHUNK * w;
      void loadRange();
    } else if (front + visibleCols > count.value - EDGE) {
      count.value += CHUNK;
      void loadRange();
    }
    clearTimeout(urlTimer);
    urlTimer = setTimeout(syncUrl, 120);
  });
}

/** Mirror the front column into the address bar (replaceState: no reload, no route change). */
function syncUrl() {
  const el = scroller.value;
  if (!el) return;
  const date = days.value[Math.round(el.scrollLeft / colWidth())];
  if (!date) return;
  history.replaceState(history.state, '', routePath('day', parseIsoDate(date)!).replace('/day/', '/strip/'));
}

function goToday() {
  const i = days.value.indexOf(clock.today);
  if (i >= 0) scroller.value!.scrollTo({ left: i * colWidth(), behavior: 'smooth' });
}

onMounted(async () => {
  void loadRange();
  await nextTick();
  scroller.value!.scrollLeft = CHUNK * colWidth();
});
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(urlTimer); });
</script>

<template>
  <section class="strip-view" data-testid="strip-view">
    <header class="bar">
      <button type="button" class="btn" data-testid="strip-back" @click="router.push(routePath('month', parseIsoDate(days[Math.round((scroller?.scrollLeft ?? 0) / (scroller ? colWidth() : 1))]) ?? clock.todayDate))">Month</button>
      <span class="title">Strip</span>
      <button type="button" class="btn" data-testid="strip-today" @click="goToday">Today</button>
    </header>
    <div ref="scroller" class="scroller" data-testid="strip" @scroll.passive="onScroll">
      <article v-for="d in days" :key="d" class="strip-column" :class="{ today: d === today }" data-testid="strip-column" :data-date="d">
        <h3 class="head"><span class="wd">{{ weekday(d) }}</span><span class="dt">{{ dayLabel(d) }}</span></h3>
        <ul class="list">
          <li v-for="s in segs(d)" :key="s.item.id + s.date" class="row">
            <span class="time">{{ s.startTime ?? '' }}</span>
            <ItemView :segment="s" :variant="variantOf(s)" />
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.strip-view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--md-sys-color-surface); }
.bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
.title { flex: 1; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-on-surface); }
.btn { border: 0; border-radius: var(--md-sys-shape-corner-full); padding: 6px 14px; cursor: pointer; font: var(--md-sys-typescale-label-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.scroller { --cols: 1; flex: 1; min-height: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain; touch-action: pan-x pan-y; scrollbar-width: thin; }
.strip-column { flex: 0 0 calc(100% / var(--cols)); box-sizing: border-box; scroll-snap-align: start; scroll-snap-stop: always; display: flex;
  flex-direction: column; min-height: 0; padding: 0 6px; border-left: 1px solid var(--md-sys-color-outline-variant); }
.head { margin: 0; padding: 8px 10px; display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); }
.head .wd { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.head .dt { font: var(--md-sys-typescale-title-large); }
.today .head { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.today .head .wd { color: inherit; }
.list { list-style: none; margin: 8px 0 0; padding: 0 0 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.row { display: flex; align-items: flex-start; gap: 6px; }
.time { flex: none; width: 3.2em; padding-top: 2px; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); }
@media (min-width: 720px) { .scroller { --cols: 3; } }
@media (min-width: 1100px) { .scroller { --cols: 5; } }
</style>
