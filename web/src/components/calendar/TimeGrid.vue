<script setup lang="ts">
/**
 * Hour grid for the week and day views: all-day row, 24 hour rows, time-proportional blocks with column packing.
 * Extension points: `gridLayers` (rendered in every day column),
 * `itemRenderers` (block content), `time-slot` clicks (create), and the exposed `scrollToMinutes`.
 */
import { computed, nextTick, provide, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EventBar from '@/features/calendar/EventBar.vue';
import ItemView from '@/components/calendar/ItemView.vue';
import { useBars, useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { bindGridZoom, gridYUnder, hourHeight, previewShift, provideHourHeight, setHourHeight } from '@/composables/useHourHeight';
import { isPhone } from '@/composables/useViewport';
import { openNew } from '@/extensions/create';
import { resizePreview } from '@/features/calendar/resize';
import { gridLayers } from '@/extensions/registry';
import { HOURS, formatDate, hourLabel, toIsoDate } from '@/lib/dates';
import { blockGeometry, MIN_BLOCK_PX, packColumns, STACK_INDENT_PX, TITLE_ROW_PX } from '@/lib/items';
import { packWeek } from '@/lib/monthSlots';
import { cycleSection, sectionKey, sectionMode } from '@/features/tasklists/section';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { t } from '@/i18n';

const props = defineProps<{ mode: 'week' | 'day'; dates: Date[]; fit?: { start: number; end: number } }>();
const clock = useClockStore();
const prefs = usePrefsStore();
const nav = useNav();
const segs = useDaySegments();
const barsOf = useBars();

// Fit-to-height mode (two-row week overview): the active window [start, end] fills the measured area, so the whole
// window shows without scrolling. The effective hour height replaces the shared zoom height for this grid and its
// descendants (the expanded card follows it via provide/inject), so the inline grown card still lines up by construction.
/** Fit mode's smallest block (px): one readable title line, so a short entry stays nearer its real length than the normal minimum. */
const FIT_MIN_BLOCK_PX = 19;
const availH = ref(0);
const fitHH = computed(() => {
  const f = props.fit;
  if (!f) return hourHeight.value;
  const hours = (f.end - f.start) / 60;
  return hours > 0 && availH.value > 0 ? availH.value / hours : hourHeight.value;
});
const hh = computed(() => (props.fit ? fitHH.value : hourHeight.value));
provideHourHeight(hh);

/** The owner's "events side by side" limit of this grid (the two-row overview is a week view). */
const sideBySide = computed(() => (props.mode === 'day' ? prefs.daySideBySide : prefs.weekSideBySide));
const cols = computed(() => props.dates.map((d) => {
  const date = toIsoDate(d);
  const all = segs(date);
  return {
    date, d,
    today: date === clock.today,
    top: all.filter((s) => s.allDay || s.startTime === null),
    placed: packColumns(all, ((props.fit ? FIT_MIN_BLOCK_PX : MIN_BLOCK_PX) / hh.value) * 60, true, (TITLE_ROW_PX / hh.value) * 60, prefs.minEventMinutes, sideBySide.value),
  };
}));
const indent = computed(() => (isPhone.value ? 6 : STACK_INDENT_PX));
// every grid, the two-row overview included, has the same two levels: titles only and expanded (owner, 2026-10-20)
const smode = computed(() => sectionMode(props.mode, isPhone.value));
provide(sectionKey, () => smode.value);
const isList = (s: { item: { kind: string } }) => s.item.kind === 'tasklist';
const taskTotal = computed(() => cols.value.reduce((n, c) => n + c.top.filter(isList).length, 0));
const sectionLabel = (m: 'titles' | 'full') => t(m === 'titles' ? 'calendar.grid.modeTitles' : 'calendar.grid.modeFull');
const dateStrs = computed(() => props.dates.map(toIsoDate));
const bars = computed(() => barsOf(dateStrs.value));
/** Per day, the all-day entries in render order. */
const band = computed(() => {
  const days = cols.value.map((c) => ({ segs: c.top }));
  const packed = packWeek(bars.value, days.map((d) => Array.from({ length: d.segs.length }, () => 1)));
  // a bar takes its slot only on the days it covers, each day's own entries fill that day's free slots from the top
  return { days: days.map((d, i) => ({ ...d, slots: packed[i].slots })), rows: Math.max(0, ...packed.map((p) => p.used)) };
});
const px = (min: number) => (min / 60) * hh.value;

const scroller = ref<HTMLElement | null>(null);
function scrollToMinutes(min: number) {
  if (scroller.value) scroller.value.scrollTop = Math.max(0, px(min));
}
/** Today visible: now sits in the upper third of the viewport; other periods start at 07:00 (feature proportional-timeline). */
function initialScroll() {
  const el = scroller.value;
  if (!el) return;
  // fit mode: pin the window's start to the top (the whole window fits, so there is nothing else to scroll to)
  if (props.fit) { el.scrollTop = Math.max(0, px(props.fit.start)); return; }
  const todayVisible = props.dates.some((d) => toIsoDate(d) === clock.today);
  el.scrollTop = Math.max(0, todayVisible ? px(clock.minutesNow) - el.clientHeight / 3 : px(7 * 60));
}
interface ZoomPreview { base: number; k: number; t: number; off: number }
let zoom: ZoomPreview | null = null;
const gridEl = ref<HTMLElement | null>(null);
/** Live zoom: only a CSS transform on the grid (blocks keep their layout), keeping the time under `clientY` in place. */
function previewZoom(next: number, clientY: number) {
  const el = scroller.value;
  const grid = gridEl.value;
  if (!el || !grid) return;
  const z = zoom ?? (zoom = { base: hourHeight.value, k: 1, t: 0, off: 0 });
  const off = clientY - el.getBoundingClientRect().top;
  const k = next / z.base;
  z.t = previewShift(el.scrollTop, off, gridYUnder(el.scrollTop, off, z.k, z.t), k);
  z.k = k;
  z.off = off;
  grid.style.transformOrigin = '0 0';
  grid.style.transform = `translateY(${z.t}px) scaleY(${k})`;
}
/** Gesture settled: drop the transform, lay the blocks out once at `next`, keep the anchored time where it was. */
function commitZoom(next: number) {
  const el = scroller.value;
  const z = zoom;
  zoom = null;
  if (gridEl.value) { gridEl.value.style.transform = ''; gridEl.value.style.transformOrigin = ''; }
  const old = hourHeight.value;
  const v = setHourHeight(next);
  if (!el || !z) return;
  const want = gridYUnder(el.scrollTop, z.off, z.k, z.t) * (v / old) - z.off;
  nextTick(() => { el.scrollTop = Math.max(0, want); });
}
let unbindZoom = () => {};
let ro: ResizeObserver | null = null;
onMounted(() => {
  nextTick(initialScroll);
  // fit mode: measure the area (the effective hour height follows it) and re-pin the window; no pinch/wheel zoom here
  if (props.fit) {
    const el = scroller.value;
    if (el) { availH.value = el.clientHeight; ro = new ResizeObserver(() => { availH.value = el.clientHeight; initialScroll(); }); ro.observe(el); }
    return;
  }
  if (scroller.value) unbindZoom = bindGridZoom(scroller.value, { get: () => hh.value, preview: previewZoom, commit: commitZoom });
});
onBeforeUnmount(() => { unbindZoom(); ro?.disconnect(); });
watch(() => props.mode, () => nextTick(initialScroll));
watch(() => toIsoDate(props.dates[0]), () => nextTick(initialScroll));
watch(hh, () => { if (props.fit) nextTick(initialScroll); });
defineExpose({ scrollToMinutes });

/** Block box: the stored one, or the live one while its resize handle is dragged. */
function geo(p: { seg: { item: { id: string }; date: string }; top: number; height: number }) {
  const rp = resizePreview.value;
  const live = !!rp && rp.id === p.seg.item.id && rp.date === p.seg.date;
  const top = live ? rp.startMin : p.top;
  // the live drag shows the length the block will be laid out with: its real length, at least the minimum event length
  return blockGeometry(top, live ? Math.max(rp.endMin, rp.startMin + prefs.minEventMinutes) : top + p.height, hh.value, 0);
}
const settling = (id: string, date: string) => resizePreview.value?.settle && resizePreview.value.id === id && resizePreview.value.date === date;

const ids = { header: props.mode === 'week' ? 'week-header' : 'day-header', all: props.mode === 'week' ? 'week-allday-cell' : 'day-allday-area', col: props.mode === 'week' ? 'week-day-column' : 'day-column' };
</script>

<template>
  <div class="tg" :class="[mode, { phone: isPhone, fit: !!fit }]" :style="{ '--hh': hh + 'px', '--n': dates.length }">
    <div class="heads">
      <div class="gutter" />
      <button
        v-for="c in cols" :key="c.date" class="head" :class="{ today: c.today }" type="button" :data-testid="ids.header" :data-date="c.date"
        :data-today="c.today ? 'true' : undefined" @click="mode === 'week' && nav.openDay(c.d)"
      >
        <span class="dow">{{ formatDate(c.d, 'weekday') }}</span> <span class="dn">{{ c.d.getDate() }}</span>
      </button>
    </div>
    <!-- fit: the band is capped (34%) and scrolls, so each row keeps its content height instead of being squeezed to share the cap;
         its lists are one-line pills (allday in title form) that grow in place on a tap -->
    <div class="alldays" :style="{ gridTemplateRows: band.rows ? `repeat(${band.rows}, minmax(${fit ? 'max-content' : 'var(--bar-h)'}, auto))` : undefined }">
      <div class="gutter"><button class="sec" type="button" data-testid="tasks-section-toggle" :data-mode="smode" :aria-label="t('calendar.grid.tasksSection', { mode: sectionLabel(smode) })" @click="cycleSection(mode, isPhone)"><span class="n">{{ taskTotal + bars.length || "" }}</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></button></div>
      <EventBar v-for="b in bars" :key="b.item.id" class="abar" :bar="b" :dates="dateStrs" :style="{ gridColumn: `${b.startCol + 2} / ${b.endCol + 3}`, gridRow: b.lane + 1 }" />
      <div v-for="(c, ci) in cols" :key="c.date" class="adcol" :style="{ gridColumn: ci + 2, gridRow: `1 / ${Math.max(band.rows, 1) + 1}` }" :data-testid="ids.all" :data-date="c.date">
        <ItemView v-for="(s, si) in band.days[ci].segs" :key="s.item.id + s.date" :segment="s" :variant="s.allDay || s.item.kind === 'tasklist' ? 'allday' : 'chip'" :style="{ gridRow: band.days[ci].slots[si] + 1 }" />
      </div>
    </div>
    <div ref="scroller" class="scroll" data-scroll-area>
      <div ref="gridEl" class="grid" data-testid="time-grid" :data-hour-height="hh">
        <div class="gutter hours" data-testid="time-axis">
          <span v-for="h in HOURS" :key="h" class="hl">{{ h === 0 ? '' : hourLabel(h) }}</span>
        </div>
        <div v-for="c in cols" :key="c.date" class="col" :class="{ today: c.today }" :data-testid="ids.col" :data-date="c.date">
          <button
            v-for="h in HOURS" :key="h" class="slot" type="button" data-testid="time-slot" :data-date="c.date" :data-hour="h"
            :aria-label="t('calendar.grid.createAt', { date: c.date, time: hourLabel(h) })" @click="fit ? nav.openDay(c.d) : openNew(c.date, hourLabel(h))"
          />
          <div
            v-for="p in c.placed" :key="p.seg.item.id + p.seg.date" class="blk" :class="{ settle: settling(p.seg.item.id, p.seg.date) }"
            :style="{ top: geo(p).top + 'px', height: geo(p).height + 'px', left: `calc(${(p.col / p.cols) * 100}% + ${p.level * indent}px)`, width: `calc(${(p.span / p.cols) * 100}% - ${p.level * indent}px)`, '--z': 1 + p.level }"
          >
            <ItemView :segment="p.seg" variant="block" :height="geo(p).height" />
          </div>
          <component :is="L" v-for="(L, i) in gridLayers" :key="i" :date="c.date" :hour-height="hh" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg { flex: 1; min-height: 0; display: flex; flex-direction: column; --gw: 44px; }
.tg.phone { --gw: 30px; }
.heads, .alldays { display: grid; grid-template-columns: var(--gw) repeat(var(--n), minmax(0, 1fr)); flex: none; }
.gutter { width: var(--gw); }
.head { min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: var(--md-sys-shape-corner-medium); }
.week .head { cursor: pointer; }
.day .head { cursor: default; }
.dow { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.dn { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: var(--md-sys-typescale-title-medium); }
.phone .dn { width: 28px; height: 28px; font-size: 14px; }
.head.today .dn { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.head.today .dow { color: var(--md-sys-color-primary); }
.alldays { max-height: 25dvh; overflow-y: auto; overscroll-behavior: contain; }
.sec { position: sticky; top: 0; width: 100%; min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); }
.sec svg { width: 12px; height: 12px; transition: transform 160ms; }
.sec[data-mode='full'] svg { transform: rotate(180deg); }
.alldays { border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.tg:has([data-dragging='true']) .adcol { min-height: 30px; }
.alldays { --bar-h: 20px; row-gap: 2px; }
.alldays .abar { z-index: 2; }
.alldays .gutter { grid-row: 1 / -1; grid-column: 1; }
.adcol { display: grid; grid-template-rows: subgrid; row-gap: 2px; align-content: start; min-width: 0; padding: 0 1px 4px; min-height: 6px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.grid { position: relative; display: grid; grid-template-columns: var(--gw) repeat(var(--n), minmax(0, 1fr)); height: calc(24 * var(--hh)); }
.hours { display: flex; flex-direction: column; }
.hl { height: var(--hh); font: var(--md-sys-typescale-label-small); font-size: 10px; color: var(--md-sys-color-on-surface-variant); text-align: right; padding-right: 4px; transform: translateY(-7px); }
.col { position: relative; border-left: 1px solid var(--md-sys-color-outline-variant); min-width: 0; }
.col.today { background: color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent); }
.slot { display: block; width: 100%; height: var(--hh); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .slot:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); } }
.blk { position: absolute; padding: 0 1px 1px; box-sizing: border-box; z-index: var(--z, 1); min-width: 0; }
.blk:has([data-dragging='true']) { z-index: 20; }
.blk:has([data-resize-handle]) { z-index: 15; }
.blk.settle { transition: top 220ms var(--md-sys-motion-spring, ease-out), height 220ms var(--md-sys-motion-spring, ease-out); }
html[data-motion='off'] .blk.settle { transition: none; }
.phone .head { min-height: 44px; }
.phone.week .dow { font-size: 11px; }
.day .head { flex-direction: row; min-height: 36px; gap: 8px; }
.day.phone .head { min-height: 36px; }
/* fit-to-height (two-row overview): the window fills the area, nothing scrolls, heads and band stay compact */
.tg.fit .scroll { overflow: hidden; }
.tg.fit .head { min-height: 30px; flex-direction: row; gap: 5px; }
.tg.fit .dn { width: 22px; height: 22px; font: var(--md-sys-typescale-label-large); font-size: 12px; }
.tg.fit .dow { font-size: 11px; }
.tg.fit .alldays { max-height: 34%; }
.tg.fit .adcol > * { min-height: var(--bar-h); }
</style>
