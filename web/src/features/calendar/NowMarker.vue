<script setup lang="ts">
/** Grid layer: the live "now" line across today's column. Position comes from the shared clock tick (no timers here). */
import { computed } from 'vue';
import type { GridLayerProps } from '@/extensions/registry';
import { minutesToTime } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { nowMarkerTop } from './timeline';
import { t } from '@/i18n';

const props = defineProps<GridLayerProps>();
const clock = useClockStore();
const cal = useCalendarStore();
const isToday = computed(() => props.date === clock.today);
const time = computed(() => minutesToTime(clock.minutesNow));
const top = computed(() => nowMarkerTop(clock.minutesNow, props.hourHeight));
</script>

<template>
  <div v-if="isToday" class="now" data-testid="now-marker" :data-time="time" :data-date="date" :style="{ top: top + 'px' }" role="img" :aria-label="t('calendar.now.marker', { time })">
    <span class="dot" />
    <span v-if="cal.view === 'day'" class="lbl">{{ time }}</span>
  </div>
</template>

<style scoped>
.now { position: absolute; left: 0; right: 0; height: 0; z-index: 4; pointer-events: none; border-top: 2px solid var(--md-sys-color-primary); transition: top 600ms var(--md-sys-motion-emphasized); }
.dot { position: absolute; left: -5px; top: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--md-sys-color-primary); box-shadow: 0 0 0 2px var(--md-sys-color-surface); }
.lbl {
  position: absolute; right: 4px; top: -19px; padding: 0 6px; border-radius: 8px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary);
  font: var(--md-sys-typescale-label-small); line-height: 16px; font-variant-numeric: tabular-nums;
}
html[data-motion='off'] .now, html[data-motion='reduced'] .now { transition: none; }
</style>
