<script setup lang="ts">
/**
 * Approaching card (formerly "Now" card) above the time grid: the running event with time left and a shrinking
 * progress bar, and the approach track (or, with the track off, what comes next). Always compact: a slim card, no
 * toggle (ASSUMPTIONS A-68). Shown above every calendar view whatever period is shown (it is about now; the calendar store
 * keeps today loaded) unless the person switched it off. Rendered once by the shell above the calendar views, so a
 * view switch keeps it; it animates in only when it really appears. `data-entered` counts those enter animations.
 */
import { computed, ref } from 'vue';
import { useDaySegments } from '@/composables/useDaySegments';
import { absMinutes, trackBands } from '@/features/bedtime/bedtime';
import { useBedtimeWindows } from '@/features/bedtime/useBedtime';
import { addDays, toIsoDate } from '@/lib/dates';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import ApproachBar from '@/features/labs/approach/ApproachBar.vue';
import { approachEntries } from '@/features/labs/approach/approach';
import { nowCardModel } from './timeline';
import { t } from '@/i18n';

const clock = useClockStore();
const segs = useDaySegments();
const model = computed(() => nowCardModel(segs(clock.today), clock.minutesNow));
const prefs = usePrefsStore();
/** Approach track: replaces the "Next" line while something timed is still ahead today. */
const approach = computed(() => (prefs.approachBar ? approachEntries(segs(clock.today), clock.minutesNow, prefs.approachWindowHours * 60) : { entries: [], atEnd: false }));
/** Night bands on the track (bedtime mode); a night inside the window shows the track even when nothing timed is ahead. */
const nights = useBedtimeWindows(() => ({ from: clock.today, to: toIsoDate(addDays(clock.todayDate, 2)) }));
const bands = computed(() => (prefs.approachBar ? trackBands(nights.value, absMinutes(clock.today, clock.minutesNow), prefs.approachWindowHours * 60) : []));
const track = computed(() => approach.value.entries.length > 0 || bands.value.length > 0);
const entered = ref(0);
</script>

<template>
  <Transition name="now" appear @before-enter="entered++">
  <section
    class="now-card" :class="{ track }" data-testid="now-card" :aria-label="t('calendar.now.label')" :data-entered="entered" :data-has-current="model.current ? 'true' : 'false'"
    :style="{ '--c': model.current?.color }"
  >
    <div class="one" :data-testid="model.current ? 'now-card-current' : undefined">
      <p v-if="model.current" class="line strong" data-testid="now-card-line">{{ model.current.line }}</p>
      <p v-if="!track" class="line next" :class="{ strong: !model.current }" data-testid="now-card-line">{{ model.nextLine }}</p>
    </div>
    <ApproachBar v-if="track" :entries="approach.entries" :at-end="approach.atEnd" :now-min="clock.minutesNow" :window-min="prefs.approachWindowHours * 60" :bands="bands" />
    <div v-if="model.current" class="bar" data-testid="now-progress" role="progressbar" :aria-label="t('calendar.now.progress')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="model.current.elapsedPercent">
      <span class="fill" :style="{ transform: `scaleX(${(100 - model.current.elapsedPercent) / 100})` }" />
    </div>
  </section>
  </Transition>
</template>

<style scoped>
.now-card {
  flex: none; margin: 4px 8px 4px; padding: 0 12px; border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; min-height: 28px; max-height: 28px;
}
/* the approach track keeps its rows inside the slim card */
.now-card.track { max-height: none; padding-top: 2px; padding-bottom: 3px; }
.one { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.line { margin: 0; font: var(--md-sys-typescale-body-medium); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.strong { flex: 0 1 auto; font: var(--md-sys-typescale-title-medium); font-size: 14px; line-height: 20px; }
.next { flex: 1 1 0; min-width: 0; opacity: 0.85; }
.next.strong { opacity: 1; }
.bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--c) 22%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; width: 100%; background: var(--c); border-radius: 2px; transform-origin: left center; transition: transform 800ms var(--md-sys-motion-emphasized); }
html[data-motion='off'] .fill, html[data-motion='reduced'] .fill { transition: none; }
.now-enter-active, .now-leave-active { transition: opacity 200ms ease, transform 200ms var(--md-sys-motion-emphasized); }
.now-enter-from, .now-leave-to { opacity: 0; transform: translateY(-8px); }
html[data-motion='off'] .now-enter-active, html[data-motion='off'] .now-leave-active { transition: none; }
</style>
