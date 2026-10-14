<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { isSameMonth } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useBars, useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { isPhone } from '@/composables/useViewport';
import { allotHeights, CELL_METRICS, maxLanes } from '@/features/tasklists/layout';
import EventBar from '@/features/calendar/EventBar.vue';
import { packWeek } from '@/lib/monthSlots';
import type { Segment } from '@/lib/items';
import { laneCount } from '@/lib/spans';
import { providePreview } from '@/composables/usePreview';
import { monthGrid, periodTitle, toIsoDate, weekdayLabels } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { t } from '@/i18n';

/** `anchor`/`preview`: a light copy for another period (swipe neighbour), see `usePreview`. */
const props = defineProps<{ anchor?: Date; preview?: boolean }>();
providePreview(props.preview);
const cal = useCalendarStore();
const clock = useClockStore();
const nav = useNav();
const segs = useDaySegments();
const barsOf = useBars();

const anchor = computed(() => props.anchor ?? cal.anchor);
const weeks = computed(() => monthGrid(anchor.value));
const gridEl = ref<HTMLElement | null>(null);
const { height: gridH } = useElementSize(gridEl);
/** Gap between two entries in a cell (px); one slot is a chip plus this gap. */
const GAP = 2;
/** One day's render list: an entry, or the empty space left for a bar's slot (`gap` px). */
type Slotted = { key: string; gap: number } | { key: string; seg: Segment; h?: number };
/** Bars per week row (as many lanes as leave one entry row in every cell, `maxLanes`; the rest is reachable through the day) and each day's nodes. */
const rows = computed(() => {
  const cap = maxLanes(gridH.value / weeks.value.length, isPhone.value);
  return weeks.value.map((week) => {
    const dates = week.map(toIsoDate);
    const bars = barsOf(dates).filter((b) => b.lane < cap);
    const perDay = dates.map((d, col) => entries(d, bars.filter((b) => b.startCol <= col && col <= b.endCol).length));
    const packed = packWeek(bars, perDay.map((l) => l.map((e) => e.span)));
    const days = packed.map((p, col): Slotted[] => {
      const out: Slotted[] = [];
      let end = 0;
      perDay[col].forEach(({ s, h }, n) => {
        if (p.slots[n] > end) out.push({ key: `gap${n}`, gap: (p.slots[n] - end) * slotH() - GAP });
        out.push({ key: s.item.id + s.date, seg: s, h: h === undefined ? undefined : p.spans[n] * slotH() - GAP });
        end = p.slots[n] + p.spans[n];
      });
      return out;
    });
    return { dates, lanes: laneCount(bars), bars, days };
  });
});
const slotH = () => (isPhone.value ? CELL_METRICS.phone : CELL_METRICS.wide).lane;
/** Marks the entries container `data-fade` while its content is taller than the space the cell gives it (re-measured on every update and resize). */
const fadeObservers = new WeakMap<HTMLElement, ResizeObserver>();
const measureFade = (el: HTMLElement) => { el.dataset.fade = el.scrollHeight > el.clientHeight + 1 ? 'true' : 'false'; };
const vFade = {
  mounted(el: HTMLElement) {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measureFade(el));
      ro.observe(el);
      fadeObservers.set(el, ro);
    }
    measureFade(el);
  },
  updated: measureFade,
  unmounted(el: HTMLElement) { fadeObservers.get(el)?.disconnect(); },
};
/** Every entry of the day with the slots it wants; task lists share the pixels the cell has after the day's bars (by need), whatever does not fit is clipped and faded by the cell. */
function entries(date: string, taken: number) {
  const all = segs(date);
  const cellH = gridH.value / weeks.value.length;
  let heights: number[] = [];
  if (cellH > 0 && all.length) {
    const phone = isPhone.value;
    const rowH = phone ? 11 : 14, titleH = phone ? 15 : 17, extra = phone ? 3 : 5, evH = phone ? 16 : 18;
    const needOf = (s: (typeof all)[number]) => (s.item.kind === 'tasklist' ? titleH + s.item.items.filter((i) => !i.done).length * rowH + extra : evH);
    const cm = phone ? CELL_METRICS.phone : CELL_METRICS.wide;
    const room = cellH - cm.num - cm.pad - taken * cm.lane - (all.length - 1) * GAP - 2;
    heights = allotHeights(all.map(needOf), room, evH);
  }
  // a task list card takes whole slots (at least one), so the slots below it stay in line with the bars
  return all.map((s, n) => ({ s, h: s.item.kind === 'tasklist' ? heights[n] ?? 0 : undefined, span: s.item.kind === 'tasklist' ? Math.max(1, Math.floor(((heights[n] ?? 0) + GAP) / slotH())) : 1 }));
}

/** Empty space in a cell opens the day; on desktop a click on an entry opens the entry instead. */
function onCellClick(e: MouseEvent, day: Date): void {
  if (!isPhone.value && (e.target as Element | null)?.closest('.chips > *')) return;
  void nav.openDay(day);
}

function onChipsClick(e: MouseEvent, day: Date): void {
  if (!isPhone.value) return;
  e.stopPropagation();
  void nav.openDay(day);
}
</script>

<template>
  <section class="month" :class="{ phone: isPhone }" data-testid="month-view" :data-month="periodTitle('month', anchor)">
    <div class="weekdays" role="row">
      <div v-for="w in weekdayLabels()" :key="w" class="wd" data-testid="month-weekday-header" role="columnheader">{{ w }}</div>
    </div>
    <div ref="gridEl" class="grid" :style="{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }" role="grid">
      <div v-for="(row, wi) in rows" :key="row.dates[0]" class="week">
        <div class="bars" :style="{ gridTemplateRows: `repeat(${row.lanes}, var(--bar-h))` }">
          <EventBar v-for="b in row.bars" :key="b.item.id" :bar="b" :dates="row.dates" chip />
        </div>
        <div
          v-for="(day, di) in weeks[wi]" :key="toIsoDate(day)" class="cell" role="gridcell" data-testid="month-cell" :data-date="toIsoDate(day)"
          :data-today="toIsoDate(day) === clock.today ? 'true' : undefined" :data-outside-month="!isSameMonth(day, anchor) ? 'true' : undefined"
          :class="{ outside: !isSameMonth(day, anchor), today: toIsoDate(day) === clock.today }" @click="onCellClick($event, day)"
        >
          <button class="num" type="button" data-testid="month-cell-day-number" :aria-label="t('calendar.month.openDay', { date: toIsoDate(day) })" @click.stop="nav.openDay(day)">{{ day.getDate() }}</button>
          <div v-fade class="chips" data-testid="month-cell-entries" @click.capture="onChipsClick($event, day)">
            <template v-for="nd in row.days[di]" :key="nd.key">
              <div v-if="'gap' in nd" class="slot-gap" :style="{ height: nd.gap + 'px' }" />
              <ItemView v-else :segment="nd.seg" :height="nd.h" :variant="nd.seg.allDay ? 'allday' : nd.seg.item.kind === 'tasklist' ? 'card' : 'chip'" />
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.month { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 4px 0; }
.wd { text-align: center; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.grid { flex: 1; min-height: 0; display: grid; border-top: 1px solid var(--md-sys-color-outline-variant); }
.cell {
  min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 2px 2px 0; overflow: hidden;
  border-right: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.week { position: relative; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); --bar-h: 18px; --pad: 4px; grid-template-rows: minmax(0, 1fr); }
.phone .week { --bar-h: 16px; --pad: 1px; }
.cell:nth-child(8) { border-right: 0; }
/* a gap stands in for the slots of bars on this day only; it takes no clicks, so the cell gets them */
.slot-gap { flex: none; pointer-events: none; }
/* bars overlay the cells just below the day number (cell padding 2/4px + number 28/20px + gap) */
.bars { position: absolute; z-index: 2; left: 0; right: 0; top: 34px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px; pointer-events: none; }
.phone .bars { top: 22px; }
@media (min-width: 768px) { .bars { top: 35px; } .bars :deep(.bar) { font-size: 12px; } }
.num { align-self: center; width: 28px; height: 28px; flex: none; border-radius: 50%; font: var(--md-sys-typescale-label-large); display: flex; align-items: center; justify-content: center; }
.outside .num { color: var(--md-sys-color-on-surface-variant); opacity: 0.55; }
.today .num { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); opacity: 1; }
.chips :deep(.ev.chip), .chips :deep(.ev.allday) { height: var(--bar-h); min-height: 0; }
.chips { flex: 1 1 0; display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow: hidden; }
.chips > :deep(*) { flex: none; }
/* what does not fit fades out at the bottom (no "+N"); the cell still opens the day */
.chips[data-fade='true'] { -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 18px), transparent); mask-image: linear-gradient(180deg, #000 calc(100% - 18px), transparent); }
/* Phone: a tap on a chip opens the day (handled in onChipsClick); a long press picks the chip up to drag it to another day. */
.phone .cell { cursor: pointer; padding: 1px 1px 0; gap: 1px; }
.phone .num { width: 20px; height: 20px; font-size: 12px; line-height: 20px; }
@media (min-width: 768px) { .cell { padding: 4px; gap: 3px; } .chips :deep(.ev) { font-size: 12px; } }
</style>
