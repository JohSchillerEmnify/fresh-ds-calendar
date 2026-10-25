<script setup lang="ts">
/**
 * Night band of one day column (Day and Week time grid, Timeline day, Strip column): a dark translucent band from
 * bedtime to wake-up under the events, a thin line with a moon at the bedtime edge and with a sun at the wake-up edge.
 * Takes the grid layer props, so the time grid registers it as a layer. Pointer events pass through.
 */
import { computed } from 'vue';
import { IconBedtime, IconSunny } from '@/components/icons';
import type { GridLayerProps } from '@/extensions/registry';
import { clipToDay, pieceTime } from './bedtime';
import { nextIsoDate, useBedtimeWindows } from './useBedtime';
import { t } from '@/i18n';

const props = defineProps<GridLayerProps>();
// up to the day after tomorrow: a night that starts at the next midnight still puts its moon on this day (24:00)
const windows = useBedtimeWindows(() => ({ from: props.date, to: nextIsoDate(nextIsoDate(props.date)) }));
/** The pieces of the nights that lie on this day. */
const pieces = computed(() => windows.value.flatMap((w) => {
  const p = clipToDay(w, props.date);
  return p ? [{ w, ...p }] : [];
}));
const px = (min: number) => (min / 60) * props.hourHeight;
</script>

<template>
  <div
    v-for="p in pieces" :key="p.w.from" class="bedtime-band" :class="{ starts: p.startsHere, ends: p.endsHere, midnight: p.endMin === p.startMin }"
    :data-testid="p.endMin > p.startMin ? 'bedtime-band' : undefined"
    :data-date="date" :data-start="pieceTime(p.startMin)" :data-end="pieceTime(p.endMin)" :data-from="p.w.from" :data-to="p.w.to" :data-mode="p.w.mode"
    :style="{ top: px(p.startMin) + 'px', height: px(p.endMin - p.startMin) + 'px' }"
  >
    <span v-if="p.startsHere" class="mark moon" role="img" data-testid="bedtime-moon" :data-date="date" :data-at="pieceTime(p.startMin)" :aria-label="t('bedtime.moon', { time: p.w.from.slice(11) })"><IconBedtime /></span>
    <span v-if="p.endsHere" class="mark sun" role="img" data-testid="bedtime-sun" :aria-label="t('bedtime.sun', { time: p.w.to.slice(11) })"><IconSunny /></span>
  </div>
</template>

<style scoped>
/* below the event blocks (z-index 1 and up), above the hour lines; clicks pass through to the slots */
.bedtime-band { position: absolute; left: 0; right: 0; z-index: 0; pointer-events: none; box-sizing: border-box; background: color-mix(in oklab, var(--md-sys-color-scrim, #000) 34%, transparent); }
.starts { border-top: 1px solid color-mix(in srgb, var(--md-sys-color-on-surface) 55%, transparent); }
.ends { border-bottom: 1px solid color-mix(in srgb, var(--md-sys-color-on-surface) 55%, transparent); }
.mark { position: absolute; right: 4px; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
.mark :deep(svg) { width: 12px; height: 12px; }
.moon { top: 3px; }
.sun { bottom: 3px; }
/* a bedtime at midnight: no band, only the moon just above the end of the day */
.midnight .moon { top: auto; bottom: 3px; }
</style>
