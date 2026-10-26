<script setup lang="ts">
import { computed, watch } from 'vue';
import { useNav } from '@/composables/useNav';
import { providePreview } from '@/composables/usePreview';
import { format, monthGrid, monthNames, toIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';

/** 12 mini months; day marks show density 0-3 from /api/summary. Tapping a month opens it. */
/** `anchor`/`preview`: a light copy for another period (swipe neighbour), see `usePreview`. */
const props = defineProps<{ anchor?: Date; preview?: boolean }>();
providePreview(props.preview);
const cal = useCalendarStore();
const clock = useClockStore();
const items = useItemsStore();
const sync = useSyncStore();
const nav = useNav();

const year = computed(() => (props.anchor ?? cal.anchor).getFullYear());
const months = computed(() => Array.from({ length: 12 }, (_, m) => {
  const first = new Date(year.value, m, 1);
  return { first, key: format(first, 'yyyy-MM'), name: monthNames()[m], weeks: monthGrid(first) };
}));

watch(year, (y) => {
  const load = items.loadSummary(`${y}-01-01`, `${y + 1}-01-01`);
  // a preview loads in the background; the route change reports sync state
  if (props.preview) { load.catch(() => {}); return; }
  load.then(() => { if (sync.error) sync.clearError(); sync.markSynced(); }, (e) => sync.reportError(e));
}, { immediate: true });

const density = (date: string) => items.summary[date]?.density ?? 0;
</script>

<template>
  <section class="year" data-testid="year-view" :data-year="year">
    <div class="months">
      <button
        v-for="m in months" :key="m.key" class="ym" type="button" data-testid="year-month" :data-month="m.key" :aria-label="`${m.name} ${year}`" @click="nav.go('month', m.first)"
      >
        <span class="name">{{ m.name }}</span>
        <span class="mini">
          <template v-for="week in m.weeks" :key="toIsoDate(week[0])">
            <template v-for="d in week" :key="toIsoDate(d)">
              <!-- days of the neighbouring months keep the grid aligned but draw nothing -->
              <span v-if="d.getMonth() !== m.first.getMonth()" class="d out" data-testid="year-day-out" aria-hidden="true" />
              <span
                v-else class="d" :class="{ today: toIsoDate(d) === clock.today }"
                data-testid="year-day" :data-date="toIsoDate(d)" :data-density="density(toIsoDate(d))"
                :data-today="toIsoDate(d) === clock.today ? 'true' : undefined"
              ><i>{{ d.getDate() }}</i></span>
            </template>
          </template>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.year { flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* the months scroll below the headers (Now card), which stay in view */
.months { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 4px; padding: 8px 8px 16px; align-content: start; }
@media (min-width: 768px) { .months { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 12px; padding: 16px 24px; } }
.ym { display: block; min-width: 0; padding: 6px 4px 8px; border-radius: var(--md-sys-shape-corner-large); text-align: left; transition: background 150ms, transform 250ms var(--md-sys-motion-spring); }
/* touch screens: no hover state left behind after a tap */
@media (hover: hover) { .ym:hover { background: var(--md-sys-color-surface-container); } }
.ym:active { transform: scale(0.97); }
.name { display: block; padding: 0 4px 4px; font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-primary); }
.mini { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.d { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; border-radius: 50%; }
@media (min-width: 768px) { .d { font-size: 11px; } }
.d i { font-style: normal; }
.d[data-density='1'] { background: color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent); }
.d[data-density='2'] { background: color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent); }
.d[data-density='3'] { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.d.today { box-shadow: 0 0 0 1.5px var(--md-sys-color-tertiary); font-weight: 700; }
</style>
