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
import { addDays, HOURS, hourLabel, MONTH_NAMES, parseIsoDate, routePath, toIsoDate, WEEKDAY_LABELS } from '@/lib/dates';
import { blockGeometry, packColumns, segmentMinPx, STACK_INDENT_PX, type Segment } from '@/lib/items';

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
/** Pixels per hour: each column is a small time grid, block height proportional to duration. */
const HH = 48;
const GUTTER = 30;
const topOf = (date: string) => segs(date).filter((s) => s.allDay || s.startTime === null);
const placedOf = (date: string) => packColumns(segs(date), (s) => (segmentMinPx(s) / HH) * 60);
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
  scroller.value!.scrollTop = (7 * 60 / 60) * HH;
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
        <div class="top">
          <h3 class="head"><span class="wd">{{ weekday(d) }}</span><span class="dt">{{ dayLabel(d) }}</span></h3>
          <div class="allday" data-testid="strip-allday">
            <ItemView v-for="s in topOf(d)" :key="s.item.id + s.date" :segment="s" variant="allday" />
          </div>
        </div>
        <div class="grid" :style="{ height: 24 * HH + 'px' }">
          <span v-for="h in HOURS" :key="h" class="hl" :style="{ top: h * HH + 'px', height: HH + 'px' }"><i>{{ h === 0 ? '' : hourLabel(h) }}</i></span>
          <div
            v-for="p in placedOf(d)" :key="p.seg.item.id + p.seg.date" class="blk"
            :style="{ top: blockGeometry(p.top, p.top + p.height, HH, segmentMinPx(p.seg)).top + 'px', height: blockGeometry(p.top, p.top + p.height, HH, segmentMinPx(p.seg)).height + 'px', left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${p.col / p.cols} + ${p.level * STACK_INDENT_PX}px)`, width: `calc((100% - ${GUTTER}px) * ${p.span / p.cols} - ${p.level * STACK_INDENT_PX}px)`, '--z': 1 + p.level }"
          >
            <ItemView :segment="p.seg" variant="block" :height="blockGeometry(p.top, p.top + p.height, HH, segmentMinPx(p.seg)).height" />
          </div>
        </div>
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
.scroller { --cols: 1; flex: 1; min-height: 0; display: flex; align-items: flex-start; overflow: auto; scroll-snap-type: x mandatory;
  overscroll-behavior: contain; touch-action: pan-x pan-y; scrollbar-width: thin; }
.strip-column { flex: 0 0 calc(100% / var(--cols)); box-sizing: border-box; scroll-snap-align: start; scroll-snap-stop: always; display: flex;
  flex-direction: column; padding: 0 6px; border-left: 1px solid var(--md-sys-color-outline-variant); }
.top { position: sticky; top: 0; z-index: 30; background: var(--md-sys-color-surface); padding-bottom: 2px; }
.head { margin: 0; padding: 6px 10px; display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); }
.head .wd { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.head .dt { font: var(--md-sys-typescale-title-large); }
.today .head { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.today .head .wd { color: inherit; }
.allday { display: flex; flex-direction: column; gap: 2px; min-height: 6px; padding: 2px 0 2px 30px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.grid { position: relative; flex: none; }
.hl { position: absolute; left: 0; right: 0; box-sizing: border-box; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-right: 4px;
  font: var(--md-sys-typescale-label-small); font-size: 10px; color: var(--md-sys-color-on-surface-variant); }
.hl i { display: block; width: 26px; text-align: right; font-style: normal; transform: translateY(-7px); }
.blk { position: absolute; padding: 0 1px 1px; box-sizing: border-box; z-index: var(--z, 1); min-width: 0; display: flex; }
.blk > * { flex: 1; min-width: 0; }
@media (min-width: 720px) { .scroller { --cols: 3; } }
@media (min-width: 1100px) { .scroller { --cols: 5; } }
</style>
