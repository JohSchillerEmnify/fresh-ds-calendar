<script setup lang="ts">
/**
 * Labs zoom month: the month grid on a world you can zoom (pinch, Ctrl/Cmd+wheel, trackpad pinch, +/- buttons) and pan
 * (drag, wheel). The world is `viewport x zoom` big, laid out once per committed zoom; live gestures only move a CSS
 * transform (`zoomGestures.ts`). What a cell shows follows its size continuously (`detailAt`): density dots, title chips,
 * times, task lists growing into cards, and at the largest sizes a mini day timeline with every task item
 * (ARCHITECTURE "Labs: Zoom month"). Entries are the month view's own components (`ItemView`: events, `TaskListCard`).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { addDays, addMonths, isSameMonth } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useFilters } from '@/composables/useFilters';
import { isPhone } from '@/composables/useViewport';
import { allotHeights } from '@/features/tasklists/layout';
import { monthGrid, parseIsoDate, periodTitle, routePath, toIsoDate, weekdayLabels } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { t } from '@/i18n';
import ZoomTimeline from './ZoomTimeline.vue';
import { cellNear, cellScale, cellSize, centerOnCell, COLS, detailAt, listHeight, MAX_ZOOM, MIN_ZOOM, readStoredZoom, stepZoom, writeStoredZoom } from './zoom';
import { createZoomController } from './zoomGestures';

const route = useRoute();
const router = useRouter();
const cal = useCalendarStore();
const items = useItemsStore();
const cals = useCalendarsStore();
const clock = useClockStore();
const filters = useFilters();

const anchorDate = computed(() => parseIsoDate(route.params.param as string) ?? clock.todayDate);
const weeks = computed(() => monthGrid(anchorDate.value));
const rows = computed(() => weeks.value.length);
const days = computed(() => weeks.value.flat());

const port = ref<HTMLElement | null>(null);
const world = ref<HTMLElement | null>(null);
const head = ref<HTMLElement | null>(null);
// Border box of a viewport that fills the space the shell gives it: independent of the content, so no measuring loop.
const { width: vw, height: vh } = useElementSize(port, undefined, { box: 'border-box' });

const z = ref(readStoredZoom() ?? MIN_ZOOM);
const pan = shallowRef({ x: 0, y: 0 });
const cell = computed(() => cellSize(vw.value, vh.value, z.value, rows.value));
const detail = computed(() => detailAt(cell.value.w, cell.value.h));
const sc = computed(() => cellScale(cell.value.w, cell.value.h));
/** Height of the day number row (px): grows a little with the cell. */
const numPx = computed(() => Math.round(Math.min(40, Math.max(19, sc.value * 0.17))));

/** Applies pan and live scale to the world and the weekday row; no layout. */
function applyTransform(x: number, y: number, k: number): void {
  if (world.value) world.value.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
  if (head.value) head.value.style.transform = `translateX(${x}px) scaleX(${k})`;
}
const ctl = createZoomController({ z: z.value, x: 0, y: 0 }, {
  size: () => ({ w: vw.value, h: vh.value }),
  origin: () => { const r = port.value?.getBoundingClientRect(); return { x: r?.left ?? 0, y: r?.top ?? 0 }; },
  live: (x, y, k) => { applyTransform(x, y, k); pan.value = { x, y }; },
  commit: (nz, x, y) => {
    z.value = nz;
    pan.value = { x, y };
    applyTransform(x, y, 1);
    writeStoredZoom(nz);
  },
});

/** Cells within half a viewport of the visible part draw their entries; the others only their number (key is stable while panning inside a cell). */
const nearKey = computed(() => {
  const { w, h } = cell.value;
  const m = Math.max(vw.value, vh.value) / 2;
  return days.value.map((_, i) => (cellNear(i % COLS, Math.floor(i / COLS), w, h, pan.value, vw.value, vh.value, m) ? '1' : '0')).join('');
});
const isNear = (i: number): boolean => nearKey.value[i] === '1';

/** Puts the route's day (or today) in the middle of the viewport. */
function centerOnAnchor(): void {
  const i = days.value.findIndex((d) => toIsoDate(d) === toIsoDate(anchorDate.value));
  const c = centerOnCell(Math.max(0, i) % COLS, Math.floor(Math.max(0, i) / COLS), rows.value, vw.value, vh.value, z.value);
  ctl.set(z.value, c.x, c.y);
}
let placed = false;
watch([vw, vh], ([w, h]) => {
  if (!(w > 0 && h > 0)) return;
  if (!placed) { placed = true; centerOnAnchor(); return; }
  const s = ctl.state();
  ctl.set(s.z, s.x, s.y);
});
// A new month starts centred on its day; the items of the whole grid are loaded.
watch(() => toIsoDate(anchorDate.value).slice(0, 7), () => { if (placed) centerOnAnchor(); });
const loadRange = () => { const d = days.value; void items.setVisible(toIsoDate(d[0]!), toIsoDate(addDays(d[d.length - 1]!, 1))).catch(() => undefined); };
watch(days, loadRange);
onMounted(async () => { await nextTick(); loadRange(); });
let unbind: (() => void) | null = null;
onMounted(() => { if (port.value) unbind = ctl.bind(port.value); });
onBeforeUnmount(() => { unbind?.(); });

/** Segments of one day without hidden calendars, filters applied; multi-day events show on each of their days. */
function segsOf(date: string): Segment[] {
  const l = (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
  return filters.active.value ? l.filter((s) => filters.matches(s.item)) : l;
}

/** Entries of a cell as rows (task list heights grow from a chip to the card with `detail.lists`; they share the cell's pixels by need). */
function entriesOf(date: string) {
  const all = segsOf(date);
  const evH = 18, rowH = 14, titleH = 17, extra = 5, gap = 2;
  const needOf = (s: Segment) => (s.item.kind === 'tasklist' ? listHeight(evH, titleH + s.item.items.filter((i) => !i.done).length * rowH + extra, detail.value.lists) : evH);
  const room = cell.value.h - numPx.value - 6 - (all.length - 1) * gap;
  const hs = all.length ? allotHeights(all.map(needOf), room, evH) : [];
  return all.map((s, n) => ({ s, h: s.item.kind === 'tasklist' ? hs[n] : undefined }));
}
const dotsOf = (date: string) => segsOf(date).slice(0, 12);

const today = computed(() => clock.today);
const phone = isPhone;

/** Opens the real day view (the Labs navigation helper would stay on this Labs view). */
function openDay(day: Date): void {
  cal.setFocus(day);
  void router.push({ path: routePath('day', day), query: { ...route.query } });
}

/** Empty space in a cell opens the day; on desktop a click on an entry opens the entry instead (as in the month view). */
function onCellClick(e: MouseEvent, day: Date): void {
  if (!phone.value && (e.target as Element | null)?.closest('.row, .blk')) return;
  openDay(day);
}
/** On a phone a tap on an entry opens the day, as in the month view. */
function onEntriesClick(e: MouseEvent, day: Date): void {
  if (!phone.value) return;
  e.stopPropagation();
  openDay(day);
}

const zoomBy = (dir: 1 | -1) => ctl.zoomTo(stepZoom(z.value, dir), vw.value / 2, vh.value / 2);
const shiftMonth = (dir: 1 | -1) => router.push({ path: `/zoom/${toIsoDate(addMonths(anchorDate.value, dir))}`, query: { ...route.query } });
const back = () => router.push({ path: routePath('month', anchorDate.value), query: { ...route.query } });
</script>

<template>
  <section
    class="zoom-view" data-testid="zoom-view" :data-month="periodTitle('month', anchorDate)" :data-zoom="z.toFixed(2)" :data-detail="detail.level"
    :data-times="detail.times.toFixed(2)" :data-lists="detail.lists.toFixed(2)" :data-timeline="detail.timeline.toFixed(2)"
  >
    <header class="bar">
      <button type="button" class="btn" data-testid="zoom-back" @click="back">{{ t('views.month') }}</button>
      <button type="button" class="btn icon" data-testid="zoom-prev" :aria-label="t('calendar.picker.previousMonth')" @click="shiftMonth(-1)">‹</button>
      <span class="title" data-testid="zoom-title">{{ periodTitle('month', anchorDate) }}</span>
      <button type="button" class="btn icon" data-testid="zoom-next" :aria-label="t('calendar.picker.nextMonth')" @click="shiftMonth(1)">›</button>
      <button type="button" class="btn icon" data-testid="zoom-out" :aria-label="t('zoomMonth.zoomOut')" :disabled="z <= MIN_ZOOM" @click="zoomBy(-1)">−</button>
      <button type="button" class="btn icon" data-testid="zoom-in" :aria-label="t('zoomMonth.zoomIn')" :disabled="z >= MAX_ZOOM" @click="zoomBy(1)">+</button>
    </header>
    <div class="weekdays"><div ref="head" class="wdin" :style="{ width: vw * z + 'px' }"><div v-for="w in weekdayLabels()" :key="w" class="wd" role="columnheader">{{ w }}</div></div></div>
    <div ref="port" class="port" data-testid="zoom-port">
      <div
        ref="world" class="world" role="grid" :style="{ width: vw * z + 'px', height: vh * z + 'px', gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, '--num': numPx + 'px' }"
      >
        <div
          v-for="(day, i) in days" :key="toIsoDate(day)" class="cell" role="gridcell" data-testid="zoom-cell" :data-date="toIsoDate(day)" :data-count="segsOf(toIsoDate(day)).length"
          :class="{ outside: !isSameMonth(day, anchorDate), today: toIsoDate(day) === today }" @click="onCellClick($event, day)"
        >
          <button class="num" type="button" data-testid="zoom-cell-number" :aria-label="t('calendar.month.openDay', { date: toIsoDate(day) })" @click.stop="openDay(day)">{{ day.getDate() }}</button>
          <div class="body">
            <div v-if="detail.dots > 0.01" class="dots" :style="{ opacity: detail.dots }" data-testid="zoom-dots">
              <span v-for="s in dotsOf(toIsoDate(day))" :key="s.item.id + s.date" class="dot" :class="{ list: s.item.kind === 'tasklist' }" :style="{ background: s.item.color }" />
            </div>
            <template v-if="isNear(i)">
              <div
                v-if="detail.chips > 0.01 && detail.timeline < 0.99" class="entries" :style="{ opacity: detail.chips * (1 - detail.timeline) }" :class="{ off: detail.timeline > 0.5 }"
                data-testid="zoom-entries" @click.capture="onEntriesClick($event, day)"
              >
                <div v-for="{ s, h } in entriesOf(toIsoDate(day))" :key="s.item.id + s.date" class="row" data-zoom-nopan>
                  <span v-if="detail.times > 0.01 && s.startTime && s.item.kind !== 'tasklist' && !s.allDay" class="ztime" data-testid="zoom-time" :data-weight="detail.times.toFixed(2)" :style="{ opacity: detail.times, maxWidth: detail.times * 40 + 'px' }">{{ s.startTime }}</span>
                  <ItemView :segment="s" :height="h" :variant="s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip'" />
                </div>
              </div>
              <div v-if="detail.timeline > 0.01" class="tl" :style="{ opacity: detail.timeline }" :class="{ off: detail.timeline < 0.5 }" @click.capture="onEntriesClick($event, day)">
                <ZoomTimeline :segments="segsOf(toIsoDate(day))" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zoom-view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--md-sys-color-surface); }
.bar { display: flex; align-items: center; gap: 6px; padding: 6px 12px; }
.title { flex: 1; text-align: center; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-on-surface); }
.btn { border: 0; border-radius: var(--md-sys-shape-corner-full); padding: 6px 14px; cursor: pointer; font: var(--md-sys-typescale-label-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.btn.icon { min-width: 36px; padding: 6px 0; font-size: 18px; line-height: 1; }
.btn:disabled { opacity: 0.4; cursor: default; }
.weekdays { overflow: hidden; flex: none; padding: 2px 0; }
.wdin { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); transform-origin: 0 0; }
.wd { text-align: center; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
/* the viewport: nothing scrolls natively, the controller moves the world with a transform (pinch needs touch-action: none) */
.port { position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: none; overscroll-behavior: contain; border-top: 1px solid var(--md-sys-color-outline-variant); }
.world { position: absolute; left: 0; top: 0; transform-origin: 0 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cell {
  min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 2px; overflow: hidden; box-sizing: border-box; cursor: pointer;
  border-right: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.num { align-self: center; flex: none; width: var(--num); height: var(--num); border-radius: 50%; font: var(--md-sys-typescale-label-large); font-size: calc(var(--num) * 0.5); display: flex; align-items: center; justify-content: center; }
.outside .num { color: var(--md-sys-color-on-surface-variant); opacity: 0.55; }
.today .num { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); opacity: 1; }
.body { position: relative; flex: 1 1 0; min-height: 0; }
.dots { position: absolute; inset: 0; display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; gap: 3px; padding-top: 2px; overflow: hidden; pointer-events: none; }
.dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.dot.list { border-radius: 1.5px; }
.entries { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.entries.off, .tl.off { pointer-events: none; }
.row { flex: none; display: flex; align-items: center; min-width: 0; gap: 3px; }
.row > :deep(:last-child) { flex: 1; min-width: 0; }
.ztime { flex: none; overflow: hidden; white-space: nowrap; font: var(--md-sys-typescale-label-small); font-variant-numeric: tabular-nums; color: var(--md-sys-color-on-surface-variant); }
.tl { position: absolute; inset: 0; }
</style>
