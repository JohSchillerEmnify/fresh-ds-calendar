<script setup lang="ts">
import { computed } from 'vue';
import { isSameMonth } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useDaySegments } from '@/composables/useDaySegments';
import { useNav } from '@/composables/useNav';
import { isPhone } from '@/composables/useViewport';
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

const weeks = computed(() => monthGrid(cal.anchor));
/** Entries per cell: phone 2, desktop 3, calm mode 2. */
const limit = computed(() => (isPhone.value || settings.settings.calmMode ? 2 : 3));
function visible(date: string) {
  const all = segs(date);
  return { shown: all.slice(0, limit.value), more: Math.max(0, all.length - limit.value) };
}
</script>

<template>
  <section class="month" :class="{ phone: isPhone }" data-testid="month-view" :data-month="cal.title">
    <component :is="h" v-for="(h, i) in viewHeaders.month" :key="i" />
    <div class="weekdays" role="row">
      <div v-for="w in WEEKDAY_LABELS" :key="w" class="wd" data-testid="month-weekday-header" role="columnheader">{{ w }}</div>
    </div>
    <div class="grid" :style="{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }" role="grid">
      <template v-for="week in weeks" :key="toIsoDate(week[0])">
        <div
          v-for="day in week" :key="toIsoDate(day)" class="cell" role="gridcell" data-testid="month-cell" :data-date="toIsoDate(day)"
          :data-today="toIsoDate(day) === clock.today ? 'true' : undefined" :data-outside-month="!isSameMonth(day, cal.anchor) ? 'true' : undefined"
          :class="{ outside: !isSameMonth(day, cal.anchor), today: toIsoDate(day) === clock.today }" @click="isPhone && nav.openDay(day)"
        >
          <button class="num" type="button" data-testid="month-cell-day-number" :aria-label="`Open ${toIsoDate(day)}`" @click.stop="nav.openDay(day)">{{ day.getDate() }}</button>
          <div class="chips">
            <ItemView v-for="s in visible(toIsoDate(day)).shown" :key="s.item.id + s.date" :segment="s" :variant="s.allDay ? 'allday' : 'chip'" />
          </div>
          <button v-if="visible(toIsoDate(day)).more" class="more" type="button" data-testid="month-cell-more" @click.stop="nav.openDay(day)">
            +{{ visible(toIsoDate(day)).more }}{{ isPhone ? '' : ' more' }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.month { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 4px 0; }
.wd { text-align: center; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--md-sys-color-outline-variant); }
.cell {
  min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 2px 2px 0; overflow: hidden;
  border-right: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.cell:nth-child(7n) { border-right: 0; }
.num { align-self: center; width: 28px; height: 28px; flex: none; border-radius: 50%; font: var(--md-sys-typescale-label-large); display: flex; align-items: center; justify-content: center; }
.outside .num { color: var(--md-sys-color-on-surface-variant); opacity: 0.55; }
.today .num { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); opacity: 1; }
.chips { display: flex; flex-direction: column; gap: 2px; min-height: 0; }
.more { font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); text-align: left; padding: 0 4px; }
.phone .chips { pointer-events: none; }
.phone .more { pointer-events: none; text-align: center; }
.phone .cell { cursor: pointer; padding: 2px 1px 0; }
.phone .num { width: 26px; height: 26px; }
@media (min-width: 768px) { .cell { padding: 4px; gap: 3px; } .chips :deep(.ev) { font-size: 12px; } }
</style>
