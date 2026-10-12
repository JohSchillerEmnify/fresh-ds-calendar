<script setup lang="ts">
/**
 * Hour grid for the week and day views: all-day row, 24 hour rows, time-proportional blocks with column packing.
 * Extension points: `gridLayers` (rendered in every day column), `viewHeaders.time` (above the grid),
 * `itemRenderers` (block content), `time-slot` clicks (create), and the exposed `scrollToMinutes`.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { format } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { isPhone } from '@/composables/useViewport';
import { openCreate } from '@/extensions/create';
import { gridLayers, viewHeaders } from '@/extensions/registry';
import { HOURS, hourLabel, toIsoDate } from '@/lib/dates';
import { blockGeometry, MIN_BLOCK_PX, packColumns } from '@/lib/items';
import { useClockStore } from '@/stores/clock';

const props = defineProps<{ mode: 'week' | 'day'; dates: Date[] }>();
const clock = useClockStore();
const nav = useNav();
const segs = useDaySegments();

const hourHeight = computed(() => (isPhone.value ? 44 : 48));
const cols = computed(() => props.dates.map((d) => {
  const date = toIsoDate(d);
  const all = segs(date);
  return {
    date, d,
    today: date === clock.today,
    top: all.filter((s) => s.allDay || s.startTime === null),
    placed: packColumns(all, (MIN_BLOCK_PX / hourHeight.value) * 60),
  };
}));
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
    <div class="alldays">
      <div class="gutter" />
      <div v-for="c in cols" :key="c.date" class="adcol" :data-testid="ids.all" :data-date="c.date">
        <ItemView v-for="s in c.top" :key="s.item.id + s.date" :segment="s" :variant="s.allDay || s.item.kind === 'tasklist' ? 'allday' : 'chip'" />
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
            :aria-label="`Create at ${c.date} ${hourLabel(h)}`" @click="openCreate('event', c.date, hourLabel(h))"
          />
          <div
            v-for="p in c.placed" :key="p.seg.item.id + p.seg.date" class="blk"
            :style="{ top: blockGeometry(p.top, p.top + p.height, hourHeight).top + 'px', height: blockGeometry(p.top, p.top + p.height, hourHeight).height + 'px', left: (p.col / p.cols) * 100 + '%', width: (p.span / p.cols) * 100 + '%' }"
          >
            <ItemView :segment="p.seg" variant="block" :height="blockGeometry(p.top, p.top + p.height, hourHeight).height" />
          </div>
          <component :is="L" v-for="(L, i) in gridLayers" :key="i" :date="c.date" :hour-height="hourHeight" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg { flex: 1; min-height: 0; display: flex; flex-direction: column; --gw: 44px; }
.tg.phone { --gw: 34px; }
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
.alldays { border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.tg:has([data-dragging='true']) .adcol { min-height: 30px; }
.adcol { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 0 1px 4px; min-height: 6px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.grid { position: relative; display: grid; grid-template-columns: var(--gw) repeat(var(--n), minmax(0, 1fr)); height: calc(24 * var(--hh)); }
.hours { display: flex; flex-direction: column; }
.hl { height: var(--hh); font: var(--md-sys-typescale-label-small); font-size: 10px; color: var(--md-sys-color-on-surface-variant); text-align: right; padding-right: 4px; transform: translateY(-7px); }
.col { position: relative; border-left: 1px solid var(--md-sys-color-outline-variant); min-width: 0; }
.col.today { background: color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent); }
.slot { display: block; width: 100%; height: var(--hh); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.slot:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.blk { position: absolute; padding: 0 1px 1px; z-index: 1; min-width: 0; }
.blk:has([data-dragging='true']) { z-index: 20; }
.phone .head { min-height: 44px; }
.phone.week .dow { font-size: 11px; }
.day .head { flex-direction: row; min-height: 36px; gap: 8px; }
.day.phone .head { min-height: 36px; }
</style>
