<script setup lang="ts">
/**
 * "Now" card above the time grid: the running event with time left and a shrinking progress bar, what comes next,
 * and (from other features) the next small task. Day view: only for today; week view: only the current week.
 */
import { computed, ref } from 'vue';
import { isSameDay } from 'date-fns';
import { useDaySegments } from '@/composables/useDaySegments';
import { toIsoDate, weekDays } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import ApproachBar from '@/features/labs/approach/ApproachBar.vue';
import { approachEntries } from '@/features/labs/approach/approach';
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
const prefs = usePrefsStore();
/** Labs approach bar: replaces the "Next" line while something timed is still ahead today. */
const approach = computed(() => (prefs.approachBar ? approachEntries(segs(clock.today), clock.minutesNow) : []));
const KEY = 'now-card-collapsed';
const collapsed = ref(false);
try { collapsed.value = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }
function toggle() {
  collapsed.value = !collapsed.value;
  try { localStorage.setItem(KEY, collapsed.value ? '1' : '0'); } catch { /* ignore */ }
}
const showNext = computed(() => !collapsed.value || !model.value.current);
const extra = computed(() => nowCardLines.map((f) => f()).filter((x): x is string => !!x));
</script>

<template>
  <section
    v-if="visible" class="now-card" :class="{ collapsed }" data-testid="now-card" aria-label="Now" :data-has-current="model.current ? 'true' : 'false'"
    :data-collapsed="collapsed ? 'true' : 'false'" role="button" tabindex="0" :aria-expanded="!collapsed" :style="{ '--c': model.current?.color }"
    @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle"
  >
    <div class="one" :data-testid="model.current ? 'now-card-current' : undefined">
      <p v-if="model.current" class="line strong" data-testid="now-card-line">{{ model.current.line }}</p>
      <p v-if="showNext && !approach.length" class="line next" :class="{ strong: !model.current }" data-testid="now-card-line">{{ model.nextLine }}</p>
    </div>
    <ApproachBar v-if="showNext && approach.length" :entries="approach" :now-min="clock.minutesNow" />
    <div v-if="model.current && !collapsed" class="bar" data-testid="now-progress" role="progressbar" aria-label="Event progress" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="model.current.elapsedPercent">
      <span class="fill" :style="{ transform: `scaleX(${(100 - model.current.elapsedPercent) / 100})` }" />
    </div>
    <template v-if="!collapsed"><p v-for="l in extra" :key="l" class="line sub" data-testid="now-card-line">{{ l }}</p></template>
  </section>
</template>

<style scoped>
.now-card {
  flex: none; margin: 4px 8px 4px; padding: 4px 12px 5px; border-radius: var(--md-sys-shape-corner-large); cursor: pointer;
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.now-card.collapsed { min-height: 28px; max-height: 28px; justify-content: center; padding-top: 0; padding-bottom: 0; }
.one { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.line { margin: 0; font: var(--md-sys-typescale-body-medium); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.strong { flex: 0 1 auto; font: var(--md-sys-typescale-title-medium); font-size: 14px; line-height: 20px; }
.next { flex: 1 1 0; min-width: 0; opacity: 0.85; }
.next.strong { opacity: 1; }
.sub { opacity: 0.85; }
.bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--c) 22%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; width: 100%; background: var(--c); border-radius: 2px; transform-origin: left center; transition: transform 800ms var(--md-sys-motion-emphasized); }
html[data-motion='off'] .fill, html[data-motion='reduced'] .fill { transition: none; }
</style>
