<script setup lang="ts">
/**
 * Approaching card (formerly "Now" card) above the time grid: the running event with time left and a shrinking
 * progress bar, what comes next, and (from other features) the next small task. Always open (collapsing is shelved,
 * ASSUMPTIONS A-68). Shown above every calendar view whatever period is shown (it is about now; the calendar store
 * keeps today loaded) unless the person switched it off. Rendered once by the shell above the calendar views, so a
 * view switch keeps it; it animates in only when it really appears. `data-entered` counts those enter animations.
 */
import { computed, ref } from 'vue';
import { useDaySegments } from '@/composables/useDaySegments';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import ApproachBar from '@/features/labs/approach/ApproachBar.vue';
import { approachEntries } from '@/features/labs/approach/approach';
import { nowCardLines } from './nowLines';
import { nowCardModel } from './timeline';

const clock = useClockStore();
const segs = useDaySegments();
const model = computed(() => nowCardModel(segs(clock.today), clock.minutesNow));
const prefs = usePrefsStore();
/** Approach track: replaces the "Next" line while something timed is still ahead today. */
const approach = computed(() => (prefs.approachBar ? approachEntries(segs(clock.today), clock.minutesNow, prefs.approachWindowHours * 60) : { entries: [], atEnd: false }));
const track = computed(() => approach.value.entries.length > 0);
const extra = computed(() => nowCardLines.map((f) => f()).filter((x): x is string => !!x));
const entered = ref(0);
</script>

<template>
  <Transition name="now" appear @before-enter="entered++">
  <section
    class="now-card" data-testid="now-card" aria-label="Approaching" :data-entered="entered" :data-has-current="model.current ? 'true' : 'false'"
    :style="{ '--c': model.current?.color }"
  >
    <div class="one" :data-testid="model.current ? 'now-card-current' : undefined">
      <p v-if="model.current" class="line strong" data-testid="now-card-line">{{ model.current.line }}</p>
      <p v-if="!track" class="line next" :class="{ strong: !model.current }" data-testid="now-card-line">{{ model.nextLine }}</p>
    </div>
    <ApproachBar v-if="track" :entries="approach.entries" :at-end="approach.atEnd" :now-min="clock.minutesNow" :window-min="prefs.approachWindowHours * 60" />
    <div v-if="model.current" class="bar" data-testid="now-progress" role="progressbar" aria-label="Event progress" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="model.current.elapsedPercent">
      <span class="fill" :style="{ transform: `scaleX(${(100 - model.current.elapsedPercent) / 100})` }" />
    </div>
    <p v-for="l in extra" :key="l" class="line sub" data-testid="now-card-line">{{ l }}</p>
  </section>
  </Transition>
</template>

<style scoped>
.now-card {
  flex: none; margin: 4px 8px 4px; padding: 4px 12px 5px; border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.one { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.line { margin: 0; font: var(--md-sys-typescale-body-medium); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.strong { flex: 0 1 auto; font: var(--md-sys-typescale-title-medium); font-size: 14px; line-height: 20px; }
.next { flex: 1 1 0; min-width: 0; opacity: 0.85; }
.next.strong { opacity: 1; }
.sub { opacity: 0.85; }
.bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--c) 22%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; width: 100%; background: var(--c); border-radius: 2px; transform-origin: left center; transition: transform 800ms var(--md-sys-motion-emphasized); }
html[data-motion='off'] .fill, html[data-motion='reduced'] .fill { transition: none; }
.now-enter-active, .now-leave-active { transition: opacity 200ms ease, transform 200ms var(--md-sys-motion-emphasized); }
.now-enter-from, .now-leave-to { opacity: 0; transform: translateY(-8px); }
html[data-motion='off'] .now-enter-active, html[data-motion='off'] .now-leave-active { transition: none; }
</style>
