<script setup lang="ts">
/**
 * Hour grid for the week and day views: all-day row, 24 hour rows, time-proportional blocks with column packing.
 * Extension points: `gridLayers` (rendered in every day column), `viewHeaders.time` (above the grid),
 * `itemRenderers` (block content), `time-slot` clicks (create), and the exposed `scrollToMinutes`.
 */
import { computed, nextTick, provide, onMounted, ref, watch } from 'vue';
import { format } from 'date-fns';
import EventBar from '@/features/calendar/EventBar.vue';
import ItemView from '@/components/calendar/ItemView.vue';
import { useBars, useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { isPhone } from '@/composables/useViewport';
import { openNew } from '@/extensions/create';
import { resizePreview } from '@/features/calendar/resize';
import { gridLayers, viewHeaders } from '@/extensions/registry';
import { HOURS, hourLabel, toIsoDate } from '@/lib/dates';
import { blockGeometry, packColumns, STACK_INDENT_PX, segmentMinPx } from '@/lib/items';
import { laneCount } from '@/lib/spans';
import { cycleSection, sectionKey, sectionMode } from '@/features/tasklists/section';
import { useClockStore } from '@/stores/clock';

const props = defineProps<{ mode: 'week' | 'day'; dates: Date[] }>();
const clock = useClockStore();
const nav = useNav();
const segs = useDaySegments();
const barsOf = useBars();

const hourHeight = computed(() => (isPhone.value ? 44 : 48));
const cols = computed(() => props.dates.map((d) => {
  const date = toIsoDate(d);
  const all = segs(date);
  return {
    date, d,
    today: date === clock.today,
    top: all.filter((s) => s.allDay || s.startTime === null),
    placed: packColumns(all, (s) => (segmentMinPx(s) / hourHeight.value) * 60),
  };
}));
const indent = computed(() => (isPhone.value ? 6 : STACK_INDENT_PX));
const smode = computed(() => sectionMode(props.mode, isPhone.value));
provide(sectionKey, () => smode.value);
const isList = (s: { item: { kind: string } }) => s.item.kind === 'tasklist';
const taskTotal = computed(() => cols.value.reduce((n, c) => n + c.top.filter(isList).length, 0));
const SECTION_LABEL = { titles: 'Titles only', full: 'Expanded', count: 'Counts only' };
const dateStrs = computed(() => props.dates.map(toIsoDate));
const bars = computed(() => barsOf(dateStrs.value));
const lanes = computed(() => laneCount(bars.value));
const px = (min: number) => (min / 60) * hourHeight.value;

const scroller = ref<HTMLElement | null>(null);
function scrollToMinutes(min: number) {
  if (scroller.value) scroller.value.scrollTop = Math.max(0, px(min));
}
/** Today visible: now sits in the upper third of the viewport; other periods start at 07:00 (ARCHITECTURE 5b). */
function initialScroll() {
  const el = scroller.value;
  if (!el) return;
  const todayVisible = props.dates.some((d) => toIsoDate(d) === clock.today);
  el.scrollTop = Math.max(0, todayVisible ? px(clock.minutesNow) - el.clientHeight / 3 : px(7 * 60));
}
onMounted(() => nextTick(initialScroll));
watch(() => props.mode, () => nextTick(initialScroll));
watch(() => toIsoDate(props.dates[0]), () => nextTick(initialScroll));
defineExpose({ scrollToMinutes });

/** Block box: the stored one, or the live one while its resize handle is dragged. */
function geo(p: { seg: { item: { id: string }; date: string }; top: number; height: number }, minPx: number) {
  const rp = resizePreview.value;
  const live = !!rp && rp.id === p.seg.item.id && rp.date === p.seg.date;
  const top = live ? rp.startMin : p.top;
  return blockGeometry(top, live ? rp.endMin : top + p.height, hourHeight.value, minPx);
}
const settling = (id: string, date: string) => resizePreview.value?.settle && resizePreview.value.id === id && resizePreview.value.date === date;

const ids = { header: props.mode === 'week' ? 'week-header' : 'day-header', all: props.mode === 'week' ? 'week-allday-cell' : 'day-allday-area', col: props.mode === 'week' ? 'week-day-column' : 'day-column' };
</script>

<template>
  <div class="tg" :class="[mode, { phone: isPhone }]" :style="{ '--hh': hourHeight + 'px', '--n': dates.length }">
    <component :is="h" v-for="(h, i) in viewHeaders.time" :key="i" />
    <div class="heads">
      <div class="gutter" />
      <button
        v-for="c in cols" :key="c.date" class="head" :class="{ today: c.today }" type="button" :data-testid="ids.header" :data-date="c.date"
        :data-today="c.today ? 'true' : undefined" @click="mode === 'week' && nav.openDay(c.d)"
      >
        <span class="dow">{{ format(c.d, 'EEE') }}</span> <span class="dn">{{ c.d.getDate() }}</span>
      </button>
    </div>
    <div class="alldays" :style="{ gridTemplateRows: lanes ? `repeat(${lanes}, var(--bar-h)) auto` : undefined }">
      <div class="gutter"><button class="sec" type="button" data-testid="tasks-section-toggle" :data-mode="smode" :aria-label="`Tasks: ${SECTION_LABEL[smode]}. Tap to change`" @click="cycleSection(mode, isPhone)"><span class="n">{{ taskTotal + bars.length || "" }}</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></button></div>
      <EventBar v-for="b in bars" :key="b.item.id" class="abar" :bar="b" :dates="dateStrs" :style="{ gridColumn: `${b.startCol + 2} / ${b.endCol + 3}`, gridRow: b.lane + 1 }" />
      <div v-for="(c, ci) in cols" :key="c.date" class="adcol" :style="{ gridColumn: ci + 2, gridRow: `1 / ${lanes + 2}`, paddingTop: lanes * 22 + 'px' }" :data-testid="ids.all" :data-date="c.date">
        <button v-if="smode === 'count' && c.top.some(isList)" class="taskcount" type="button" data-testid="tasks-count-chip" @click="cycleSection(mode, isPhone)">{{ c.top.filter(isList).length }} tasks</button>
        <ItemView v-for="s in c.top.filter((x) => smode !== 'count' || !isList(x))" :key="s.item.id + s.date" :segment="s" :variant="s.allDay || s.item.kind === 'tasklist' ? 'allday' : 'chip'" />
      </div>
    </div>
    <div ref="scroller" class="scroll" data-scroll-area>
      <div class="grid" data-testid="time-grid" :data-hour-height="hourHeight">
        <div class="gutter hours">
          <span v-for="h in HOURS" :key="h" class="hl">{{ h === 0 ? '' : hourLabel(h) }}</span>
        </div>
        <div v-for="c in cols" :key="c.date" class="col" :class="{ today: c.today }" :data-testid="ids.col" :data-date="c.date">
          <button
            v-for="h in HOURS" :key="h" class="slot" type="button" data-testid="time-slot" :data-date="c.date" :data-hour="h"
            :aria-label="`Create at ${c.date} ${hourLabel(h)}`" @click="openNew(c.date, hourLabel(h))"
          />
          <div
            v-for="p in c.placed" :key="p.seg.item.id + p.seg.date" class="blk" :class="{ settle: settling(p.seg.item.id, p.seg.date) }"
            :style="{ top: geo(p, segmentMinPx(p.seg)).top + 'px', height: geo(p, segmentMinPx(p.seg)).height + 'px', left: `calc(${(p.col / p.cols) * 100}% + ${p.level * indent}px)`, width: `calc(${(p.span / p.cols) * 100}% - ${p.level * indent}px)`, '--z': 1 + p.level }"
          >
            <ItemView :segment="p.seg" variant="block" :height="geo(p, segmentMinPx(p.seg)).height" />
          </div>
          <component :is="L" v-for="(L, i) in gridLayers" :key="i" :date="c.date" :hour-height="hourHeight" />
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
.sec[data-mode='count'] svg { transform: rotate(-90deg); }
.taskcount { align-self: stretch; min-height: 22px; border-radius: 11px; font: var(--md-sys-typescale-label-small); background: color-mix(in srgb, var(--md-sys-color-primary) 14%, transparent); color: var(--md-sys-color-on-surface); }
.alldays { border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.tg:has([data-dragging='true']) .adcol { min-height: 30px; }
.alldays { --bar-h: 20px; row-gap: 2px; }
.alldays .abar { z-index: 2; }
.alldays .gutter { grid-row: 1 / -1; grid-column: 1; }
.adcol { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 0 1px 4px; min-height: 6px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.grid { position: relative; display: grid; grid-template-columns: var(--gw) repeat(var(--n), minmax(0, 1fr)); height: calc(24 * var(--hh)); }
.hours { display: flex; flex-direction: column; }
.hl { height: var(--hh); font: var(--md-sys-typescale-label-small); font-size: 10px; color: var(--md-sys-color-on-surface-variant); text-align: right; padding-right: 4px; transform: translateY(-7px); }
.col { position: relative; border-left: 1px solid var(--md-sys-color-outline-variant); min-width: 0; }
.col.today { background: color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent); }
.slot { display: block; width: 100%; height: var(--hh); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.slot:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.blk { position: absolute; padding: 0 1px 1px; box-sizing: border-box; z-index: var(--z, 1); min-width: 0; }
.blk:has([data-dragging='true']) { z-index: 20; }
.blk:has([data-resize-handle]) { z-index: 15; }
.blk.settle { transition: top 220ms var(--md-sys-motion-spring, ease-out), height 220ms var(--md-sys-motion-spring, ease-out); }
html[data-motion='off'] .blk.settle { transition: none; }
.phone .head { min-height: 44px; }
.phone.week .dow { font-size: 11px; }
.day .head { flex-direction: row; min-height: 36px; gap: 8px; }
.day.phone .head { min-height: 36px; }
</style>
