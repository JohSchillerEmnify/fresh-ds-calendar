<script setup lang="ts">
/**
 * Labs horizontal view: time runs left to right. The week has one row per day with the hours as columns, the day is one row
 * with lanes for overlapping entries (ARCHITECTURE "Labs: Horizontal view"). Time (pixels per hour) and the day height zoom
 * independently; the surface pans sideways and down. It is the zoom month's world: laid out once per committed zoom, moved by
 * a CSS transform while a gesture runs (`zoomGestures.ts`), with the sticky hour axis and day labels following the same
 * transform on their own axis. Entries are the calendar's own components (`ItemView`: events, `TaskListCard`).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { addDays } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useFilters } from '@/composables/useFilters';
import { parseIsoDate, periodTitle, routePath, toIsoDate, weekdayLabels, weekDays } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import { createZoomController } from '../zoom/zoomGestures';
import {
  DEFAULT_ZOOM, hourStep, horizontalModel, layoutRows, MAX_ZX, MAX_ZY, MIN_ZX, MIN_ZY, panToHour, pxPerHour, readStoredHZoom, START_HOUR, stepAxis,
  writeStoredHZoom, type HMode,
} from './htime';

const route = useRoute();
const router = useRouter();
const cal = useCalendarStore();
const items = useItemsStore();
const cals = useCalendarsStore();
const clock = useClockStore();
const ui = useUiStore();
const filters = useFilters();

const anchorDate = computed(() => parseIsoDate(route.params.param as string) ?? clock.todayDate);
const mode = computed<HMode>(() => (route.query.mode === 'day' ? 'day' : 'week'));
const days = computed(() => (mode.value === 'day' ? [anchorDate.value] : weekDays(anchorDate.value)));

const port = ref<HTMLElement | null>(null);
const world = ref<HTMLElement | null>(null);
const axis = ref<HTMLElement | null>(null);
const labels = ref<HTMLElement | null>(null);
// Border box of a viewport that fills the space the shell gives it: independent of the content, so no measuring loop.
const { width: vw, height: vh } = useElementSize(port, undefined, { box: 'border-box' });

const zoom = shallowRef(readStoredHZoom() ?? DEFAULT_ZOOM);

/** Segments of one day without hidden calendars, filters applied; multi-day events show on each of their days. */
function segsOf(date: string): Segment[] {
  const l = (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
  return filters.active.value ? l.filter((s) => filters.matches(s.item)) : l;
}
const dayList = computed(() => days.value.map((d) => ({ date: toIsoDate(d), segs: segsOf(toIsoDate(d)) })));
const layoutAt = (z: { x: number; y: number }) => layoutRows(dayList.value, vw.value, vh.value, z, mode.value);
const layout = computed(() => layoutAt(zoom.value));
const pph = computed(() => pxPerHour(vw.value, zoom.value.x));
const hours = computed(() => { const s = hourStep(pph.value); return Array.from({ length: Math.ceil(24 / s) }, (_, i) => i * s); });

/** Applies pan and live scale to the world, the hour axis (x only) and the day labels (y only); no layout. */
function applyTransform(x: number, y: number, kx: number, ky: number): void {
  if (world.value) world.value.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${kx}, ${ky})`;
  if (axis.value) axis.value.style.transform = `translateX(${x}px) scaleX(${kx})`;
  if (labels.value) labels.value.style.transform = `translateY(${y}px) scaleY(${ky})`;
}
const ctl = createZoomController({ z: zoom.value, x: 0, y: 0 }, {
  size: () => ({ w: vw.value, h: vh.value }),
  origin: () => { const r = port.value?.getBoundingClientRect(); return { x: r?.left ?? 0, y: r?.top ?? 0 }; },
  // an expanded task list card is anchored to where the card was: a pan or zoom ends it
  live: (x, y, kx, ky) => { applyTransform(x, y, kx, ky); ui.collapseCard(); },
  commit: (nz, x, y) => {
    zoom.value = nz;
    applyTransform(x, y, 1, 1);
    writeStoredHZoom(nz);
  },
}, horizontalModel((z) => layoutAt(z).height));

/** Starts at 06:00 (or the stored pan) once the viewport is measured. */
let placed = false;
function place(): void {
  const z = ctl.state().z;
  const p = panToHour(START_HOUR, vw.value, vh.value, z, layoutAt(z).height);
  ctl.set(z, p.x, p.y);
}
watch([vw, vh], ([w, h]) => {
  if (!(w > 0 && h > 0)) return;
  if (!placed) { placed = true; place(); return; }
  const s = ctl.state();
  ctl.set(s.z, s.x, s.y);
});
// Another mode or week lays out new rows; the pan is kept inside the new world.
watch([mode, () => toIsoDate(anchorDate.value)], async () => {
  await nextTick();
  const s = ctl.state();
  ctl.set(s.z, s.x, s.y);
});

const loadRange = () => { const d = days.value; void items.setVisible(toIsoDate(d[0]!), toIsoDate(addDays(d[d.length - 1]!, 1))).catch(() => undefined); };
watch(days, loadRange);
onMounted(async () => { await nextTick(); loadRange(); });
let unbind: (() => void) | null = null;
onMounted(() => { if (port.value) unbind = ctl.bind(port.value); });
onBeforeUnmount(() => { unbind?.(); });

const nowX = computed(() => (clock.minutesNow / 60) * pph.value);
const today = computed(() => clock.today);
const dayLabel = (iso: string): { wd: string; num: string } => {
  const d = parseIsoDate(iso)!;
  return { wd: weekdayLabels()[(d.getDay() + 6) % 7], num: String(d.getDate()) };
};
const variantOf = (s: Segment) => (s.allDay || s.startTime === null ? (s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip') : 'block');

/** Opens the real day view (the Labs navigation helper would stay on this Labs view). */
function openDay(iso: string): void {
  const d = parseIsoDate(iso)!;
  cal.setFocus(d);
  void router.push({ path: routePath('day', d), query: {} });
}

const zoomAxis = (axisName: 'x' | 'y', dir: 1 | -1) => ctl.zoomTo(stepAxis(zoom.value, axisName, dir), vw.value / 2, vh.value / 2);
const go = (q: { mode?: string; date?: string }) =>
  router.push({ path: `/horizontal/${q.date ?? toIsoDate(anchorDate.value)}`, query: { ...route.query, mode: q.mode ?? route.query.mode } });
const shift = (dir: 1 | -1) => go({ date: toIsoDate(addDays(anchorDate.value, dir * (mode.value === 'day' ? 1 : 7))) });
const title = computed(() => periodTitle(mode.value, anchorDate.value));
const atMin = (a: 'x' | 'y') => (a === 'x' ? zoom.value.x <= MIN_ZX : zoom.value.y <= MIN_ZY);
const atMax = (a: 'x' | 'y') => (a === 'x' ? zoom.value.x >= MAX_ZX : zoom.value.y >= MAX_ZY);
</script>

<template>
  <section class="ht-view" data-testid="htime-view" :data-mode="mode" :data-zoom-x="zoom.x.toFixed(2)" :data-zoom-y="zoom.y.toFixed(2)">
    <header class="bar">
      <button type="button" class="btn icon" data-testid="htime-prev" :aria-label="t('calendar.topBar.previous')" @click="shift(-1)">‹</button>
      <span class="title" data-testid="htime-title">{{ title }}</span>
      <button type="button" class="btn icon" data-testid="htime-next" :aria-label="t('calendar.topBar.next')" @click="shift(1)">›</button>
      <button type="button" class="btn" :class="{ on: mode === 'week' }" data-testid="htime-mode-week" @click="go({ mode: 'week' })">{{ t('views.week') }}</button>
      <button type="button" class="btn" :class="{ on: mode === 'day' }" data-testid="htime-mode-day" @click="go({ mode: 'day' })">{{ t('views.day') }}</button>
      <span class="grp">
        <button type="button" class="btn icon" data-testid="htime-time-out" :aria-label="t('horizontal.timeOut')" :disabled="atMin('x')" @click="zoomAxis('x', -1)">↔−</button>
        <button type="button" class="btn icon" data-testid="htime-time-in" :aria-label="t('horizontal.timeIn')" :disabled="atMax('x')" @click="zoomAxis('x', 1)">↔+</button>
      </span>
      <span class="grp">
        <button type="button" class="btn icon" data-testid="htime-day-out" :aria-label="t('horizontal.dayOut')" :disabled="atMin('y')" @click="zoomAxis('y', -1)">↕−</button>
        <button type="button" class="btn icon" data-testid="htime-day-in" :aria-label="t('horizontal.dayIn')" :disabled="atMax('y')" @click="zoomAxis('y', 1)">↕+</button>
      </span>
    </header>
    <div class="frame">
      <div class="corner" />
      <div class="axis"><div ref="axis" class="axisin" :style="{ width: layout.width + 'px' }">
        <span v-for="h in hours" :key="h" class="hour" data-testid="htime-hour" :data-hour="h" :style="{ left: h * pph + 'px' }">{{ String(h).padStart(2, '0') }}:00</span>
      </div></div>
      <div class="labels"><div ref="labels" class="labelsin" :style="{ height: layout.height + 'px' }">
        <button
          v-for="r in layout.rows" :key="r.date" type="button" class="dlabel" :class="{ today: r.date === today }" data-testid="htime-day-label" :data-date="r.date"
          :style="{ top: r.top + 'px', height: r.height + 'px' }" :aria-label="t('calendar.month.openDay', { date: r.date })" @click="openDay(r.date)"
        ><span class="wd">{{ dayLabel(r.date).wd }}</span><span class="dn">{{ dayLabel(r.date).num }}</span></button>
      </div></div>
      <!-- the viewport: nothing scrolls natively, the controller moves the world with a transform (pinch needs touch-action: none) -->
      <div ref="port" class="port" data-testid="htime-port">
        <div ref="world" class="world" :style="{ width: layout.width + 'px', height: layout.height + 'px' }">
          <span v-for="h in 25" :key="h" class="vline" :style="{ left: (h - 1) * pph + 'px' }" />
          <div
            v-for="r in layout.rows" :key="r.date" class="row" :class="{ today: r.date === today }" data-testid="htime-row" :data-date="r.date" :data-count="r.cards.length"
            :style="{ top: r.top + 'px', height: r.height + 'px' }"
          >
            <div
              v-for="c in r.cards" :key="c.seg.item.id + c.seg.date" class="card" data-zoom-nopan
              :style="{ left: c.left + 'px', top: c.top + 'px', width: c.width + 'px', height: c.height + 'px' }"
            ><ItemView :segment="c.seg" :variant="variantOf(c.seg)" :height="c.height" /></div>
          </div>
          <div v-if="days.some((d) => toIsoDate(d) === today)" class="now" data-testid="htime-now" :style="{ left: nowX + 'px' }" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ht-view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--md-sys-color-surface); }
.bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px 12px; }
.title { flex: 1; min-width: 8ch; text-align: center; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-on-surface); }
.grp { display: inline-flex; gap: 4px; }
.btn { border: 0; border-radius: var(--md-sys-shape-corner-full); padding: 6px 14px; cursor: pointer; font: var(--md-sys-typescale-label-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.btn.on { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.btn.icon { min-width: 36px; padding: 6px 8px; font-size: 14px; line-height: 1; }
.btn:disabled { opacity: 0.4; cursor: default; }
.frame { flex: 1; min-height: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); grid-template-rows: 22px minmax(0, 1fr); }
.axis, .labels { overflow: hidden; position: relative; }
.axisin, .labelsin { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.axisin { height: 22px; }
.labelsin { width: 44px; }
.hour { position: absolute; top: 0; padding-left: 3px; font: var(--md-sys-typescale-label-small); font-variant-numeric: tabular-nums; line-height: 22px; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); }
.dlabel { position: absolute; left: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 0; border: 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); cursor: pointer; overflow: hidden; }
.wd { font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); }
.dn { font: var(--md-sys-typescale-label-large); }
.dlabel.today .dn { color: var(--md-sys-color-primary); font-weight: 700; }
.port { position: relative; min-height: 0; overflow: hidden; touch-action: none; overscroll-behavior: contain; border-top: 1px solid var(--md-sys-color-outline-variant); border-left: 1px solid var(--md-sys-color-outline-variant); }
.world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.vline { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px solid var(--md-sys-color-outline-variant); opacity: 0.5; pointer-events: none; }
.row { position: absolute; left: 0; right: 0; box-sizing: border-box; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.row.today { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.card { position: absolute; box-sizing: border-box; padding: 0 1px 1px 0; display: flex; min-width: 0; }
.card > :deep(*) { flex: 1; min-width: 0; }
.now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--md-sys-color-error); pointer-events: none; z-index: 3; }
</style>
