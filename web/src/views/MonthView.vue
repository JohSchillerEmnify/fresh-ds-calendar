<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { isSameMonth } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useBars, useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { isPhone } from '@/composables/useViewport';
import { isCollapsed } from '@/features/tasklists/collapse';
import { allotHeights } from '@/features/tasklists/layout';
import EventBar from '@/features/calendar/EventBar.vue';
import { laneCount } from '@/lib/spans';
import { viewHeaders } from '@/extensions/registry';
import { monthGrid, toIsoDate, WEEKDAY_LABELS } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useSettingsStore } from '@/stores/settings';

const cal = useCalendarStore();
const clock = useClockStore();
const settings = useSettingsStore();
const nav = useNav();
const segs = useDaySegments();
const barsOf = useBars();

const weeks = computed(() => monthGrid(cal.anchor));
/** Entries per cell: phone 2, desktop 3, calm mode 2. */
const limit = computed(() => (isPhone.value || settings.settings.calmMode ? 2 : 3));
/** Bars per week row: lanes beyond the limit are hidden and count in the cell's "+n". */
const rows = computed(() => weeks.value.map((week) => {
  const dates = week.map(toIsoDate);
  const all = barsOf(dates);
  const lanes = Math.min(laneCount(all), limit.value);
  const hidden = dates.map((_, c) => all.filter((b) => b.lane >= lanes && b.startCol <= c && c <= b.endCol).length);
  return { dates, lanes, hidden, bars: all.filter((b) => b.lane < lanes) };
}));
const gridEl = ref<HTMLElement | null>(null);
const { height: gridH } = useElementSize(gridEl);
/** Pixels one entry may take: the cell minus day number, paddings, gaps and the "+n" line, shared by need (task lists get what their items need). */
function visible(date: string, lanes: number, hidden: number) {
  const all = segs(date);
  // Desktop: a lone hidden entry would only be replaced by a "+1 more" link of the same height, so show it (A-E1).
  const cap = Math.max(0, limit.value - lanes);
  let shown = !isPhone.value && !settings.settings.calmMode && all.length === cap + 1 ? all : all.slice(0, cap);
  const cellH = gridH.value / weeks.value.length;
  let heights: number[] = [];
  if (cellH > 0 && shown.length) {
    const phone = isPhone.value;
    const rowH = phone ? 11 : 14, titleH = phone ? 15 : 17, extra = phone ? 3 : 5, evH = phone ? 16 : 18, gap = phone ? 2 : 3;
    const sized = (n: number) => titleH + n * rowH + extra;
    const needOf = (s: (typeof shown)[number]) => (s.item.kind === 'tasklist' ? sized(isCollapsed(s.item.id) ? 0 : Math.min(2, s.item.items.filter((i) => !i.done).length) + (s.item.items.filter((i) => !i.done).length > 2 ? 1 : 0)) : evH);
    /** Smallest useful size: events one line, task lists the title plus up to 3 rows (item rows and the "+k" line). */
    const minOf = (s: (typeof shown)[number]) => (s.item.kind === 'tasklist' ? Math.min(needOf(s), sized(phone ? 3 : 2)) : evH);
    const room = (n: number, withMore: boolean) => cellH - (phone ? 26 : 28) - (phone ? 2 : 8) - lanes * (phone ? 18 : 22) - (n - 1) * gap - (withMore || hidden > 0 ? 14 : 0) - 2;
    // drop trailing entries (they join "+n") until the rest fit at their minimum size
    while (shown.length > 1 && shown.reduce((a, s) => a + minOf(s), 0) > room(shown.length, shown.length < all.length)) shown = shown.slice(0, -1);
    heights = allotHeights(shown.map(needOf), room(shown.length, shown.length < all.length), evH);
  }
  return { shown: shown.map((s, n) => ({ s, h: s.item.kind === 'tasklist' ? heights[n] : undefined })), more: all.length - shown.length + hidden };
}

function onChipsClick(e: MouseEvent, day: Date): void {
  if (!isPhone.value) return;
  e.stopPropagation();
  void nav.openDay(day);
}
</script>

<template>
  <section class="month" :class="{ phone: isPhone }" data-testid="month-view" :data-month="cal.title">
    <component :is="h" v-for="(h, i) in viewHeaders.month" :key="i" />
    <div class="weekdays" role="row">
      <div v-for="w in WEEKDAY_LABELS" :key="w" class="wd" data-testid="month-weekday-header" role="columnheader">{{ w }}</div>
    </div>
    <div ref="gridEl" class="grid" :style="{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }" role="grid">
      <div v-for="(row, wi) in rows" :key="row.dates[0]" class="week" :style="{ '--lanes': row.lanes }">
        <div class="bars" :style="{ gridTemplateRows: `repeat(${row.lanes}, var(--lane-h))` }">
          <EventBar v-for="b in row.bars" :key="b.item.id" :bar="b" :dates="row.dates" />
        </div>
        <div
          v-for="(day, ci) in weeks[wi]" :key="toIsoDate(day)" class="cell" role="gridcell" data-testid="month-cell" :data-date="toIsoDate(day)"
          :data-today="toIsoDate(day) === clock.today ? 'true' : undefined" :data-outside-month="!isSameMonth(day, cal.anchor) ? 'true' : undefined"
          :class="{ outside: !isSameMonth(day, cal.anchor), today: toIsoDate(day) === clock.today }" @click="isPhone && nav.openDay(day)"
        >
          <button class="num" type="button" data-testid="month-cell-day-number" :aria-label="`Open ${toIsoDate(day)}`" @click.stop="nav.openDay(day)">{{ day.getDate() }}</button>
          <div v-if="row.lanes" class="lanes" />
          <div class="chips" @click.capture="onChipsClick($event, day)">
            <ItemView v-for="{ s, h } in visible(toIsoDate(day), row.lanes, row.hidden[ci]).shown" :key="s.item.id + s.date" :segment="s" :height="h" :variant="s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip'" />
          </div>
          <button v-if="visible(toIsoDate(day), row.lanes, row.hidden[ci]).more" class="more" type="button" data-testid="month-cell-more" @click.stop="nav.openDay(day)">
            +{{ visible(toIsoDate(day), row.lanes, row.hidden[ci]).more }}{{ isPhone ? '' : ' more' }}
          </button>
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
.week { position: relative; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); --lane-h: 20px; --bar-h: 20px; grid-template-rows: minmax(0, 1fr); }
.phone .week { --lane-h: 18px; --bar-h: 16px; }
.cell:nth-child(8) { border-right: 0; }
.lanes { flex: none; height: calc(var(--lanes) * var(--lane-h)); }
/* bars overlay the cells just below the day number (cell padding 2/4px + number 28/26px + gap) */
.bars { position: absolute; z-index: 2; left: 0; right: 0; top: 34px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px; pointer-events: none; }
.phone .bars { top: 30px; row-gap: 0; }
@media (min-width: 768px) { .bars { top: 35px; } .lanes { height: calc(var(--lanes) * (var(--lane-h) + 2px)); } }
.num { align-self: center; width: 28px; height: 28px; flex: none; border-radius: 50%; font: var(--md-sys-typescale-label-large); display: flex; align-items: center; justify-content: center; }
.outside .num { color: var(--md-sys-color-on-surface-variant); opacity: 0.55; }
.today .num { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); opacity: 1; }
.chips { display: flex; flex-direction: column; gap: 2px; min-height: 0; }
.more { font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); text-align: left; padding: 0 4px; }
/* Phone: a tap on a chip opens the day (handled in onChipsClick); a long press picks the chip up to drag it to another day. */
.phone .more { pointer-events: none; text-align: center; }
.phone .cell { cursor: pointer; padding: 2px 1px 0; }
.phone .num { width: 26px; height: 26px; }
@media (min-width: 768px) { .cell { padding: 4px; gap: 3px; } .chips :deep(.ev) { font-size: 12px; } }
</style>
