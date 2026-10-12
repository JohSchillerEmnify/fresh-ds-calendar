<script setup lang="ts">
/**
 * "Now" card above the time grid: the running event with time left and a shrinking progress bar, what comes next,
 * and (from other features) the next small task. Day view: only for today; week view: only the current week.
 */
import { computed } from 'vue';
import { isSameDay } from 'date-fns';
import { useDaySegments } from '@/composables/useDaySegments';
import { toIsoDate, weekDays } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { nowCardLines } from './nowLines';
import { nowCardModel } from './timeline';

const cal = useCalendarStore();
const clock = useClockStore();
const segs = useDaySegments();
const visible = computed(() => {
  if (cal.view === 'day') return isSameDay(cal.anchor, clock.todayDate);
  if (cal.view === 'week') return weekDays(cal.anchor).some((d) => toIsoDate(d) === clock.today);
  return false;
});
const model = computed(() => nowCardModel(segs(clock.today), clock.minutesNow));
const extra = computed(() => nowCardLines.map((f) => f()).filter((x): x is string => !!x));
</script>

<template>
  <section v-if="visible" class="now-card" data-testid="now-card" aria-label="Now" :data-has-current="model.current ? 'true' : 'false'">
    <div v-if="model.current" class="cur" data-testid="now-card-current" :style="{ '--c': model.current.color }">
      <p class="line strong" data-testid="now-card-line">{{ model.current.line }}</p>
      <div class="bar" data-testid="now-progress" role="progressbar" aria-label="Event progress" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="model.current.elapsedPercent">
        <span class="fill" :style="{ transform: `scaleX(${(100 - model.current.elapsedPercent) / 100})` }" />
      </div>
    </div>
    <p class="line" :class="{ strong: !model.current }" data-testid="now-card-line">{{ model.nextLine }}</p>
    <p v-for="l in extra" :key="l" class="line sub" data-testid="now-card-line">{{ l }}</p>
  </section>
</template>

<style scoped>
.now-card {
  flex: none; margin: 4px 8px 6px; padding: 8px 12px; border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.line { margin: 0; font: var(--md-sys-typescale-body-medium); font-size: 13px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.strong { font: var(--md-sys-typescale-title-medium); font-size: 15px; line-height: 20px; }
.sub { opacity: 0.85; }
.cur { display: flex; flex-direction: column; gap: 5px; margin-bottom: 3px; }
.bar { height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--c) 22%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; width: 100%; background: var(--c); border-radius: 3px; transform-origin: left center; transition: transform 800ms var(--md-sys-motion-emphasized); }
html[data-motion='off'] .fill, html[data-motion='reduced'] .fill { transition: none; }
</style>
