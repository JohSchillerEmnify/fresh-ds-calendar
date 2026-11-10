<script setup lang="ts">
/**
 * Approaching card (formerly "Now" card) above the time grid: the running event with time left and a shrinking
 * progress bar, and the approach track (or, with the track off, what comes next). Always compact: a slim card, no
 * toggle (feature labs-approach-bar). Shown above every calendar view whatever period is shown (it is about now; the calendar store
 * keeps today loaded) unless the person switched it off. Rendered once by the shell above the calendar views, so a
 * view switch keeps it; it animates in only when it really appears. `data-entered` counts those enter animations.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
/** Something is on or ahead today (a running or coming timed event, or the track's entries and nights): else the card is gone (feature header-layout). */
const wanted = computed(() => !!model.value.current || model.value.hasNext || track.value);
/** A finger down (drag, scroll) keeps the card in place so the grid does not jump under it; it goes when the gesture ends. */
const touching = ref(false);
const held = ref(false);
const shown = computed(() => wanted.value || (touching.value && held.value));
watch(shown, (v) => { held.value = v; }, { immediate: true });
const down = () => { touching.value = true; };
const up = () => { touching.value = false; };
onMounted(() => { for (const e of ['pointerdown', 'touchstart']) window.addEventListener(e, down, true); for (const e of ['pointerup', 'touchend', 'touchcancel']) window.addEventListener(e, up, true); });
onBeforeUnmount(() => { for (const e of ['pointerdown', 'touchstart']) window.removeEventListener(e, down, true); for (const e of ['pointerup', 'touchend', 'touchcancel']) window.removeEventListener(e, up, true); });
/** The card's line carries the time left only when the person keeps that line on. */
const currentLine = computed(() => (prefs.approachTimeLeft ? model.value.current?.line : model.value.current?.title));
// with the time left off the track already shows the running entry: no title line and no progress bar on top of it
// the time left never gives way to a long title: the title shrinks, " · 30 min left" stays whole
const lineTail = computed(() => {
  const c = model.value.current;
  return c && prefs.approachTimeLeft && c.line.startsWith(c.title) ? c.line.slice(c.title.length) : '';
});
const lineShown = computed(() => !!model.value.current && (prefs.approachTimeLeft || !track.value));
const entered = ref(0);
</script>

<template>
  <Transition name="now" appear @before-enter="entered++">
  <section
    v-if="shown" class="now-card" :class="{ track }" data-testid="now-card" :aria-label="t('calendar.now.label')" :data-entered="entered" :data-has-current="model.current ? 'true' : 'false'"
    :style="{ '--c': model.current?.color }"
  >
    <div class="one" :data-testid="model.current ? 'now-card-current' : undefined">
      <p v-if="lineShown" class="line strong" :class="{ split: lineTail }" data-testid="now-card-line"><template v-if="lineTail"><span class="head">{{ model.current?.title }}</span><span class="tail">{{ lineTail }}</span></template><template v-else>{{ currentLine }}</template></p>
      <p v-if="!track" class="line next" :class="{ strong: !model.current }" data-testid="now-card-line">{{ model.nextLine }}</p>
    </div>
    <ApproachBar v-if="track" :entries="approach.entries" :at-end="approach.atEnd" :now-min="clock.minutesNow" :window-min="prefs.approachWindowHours * 60" :bands="bands" />
    <div v-if="model.current && prefs.approachTimeLeft" class="bar" data-testid="now-progress" role="progressbar" :aria-label="t('calendar.now.progress')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="model.current.elapsedPercent">
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
.line.split { display: flex; }
.line.split .head { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.line.split .tail { flex: none; white-space: pre; }
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
