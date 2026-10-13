<script setup lang="ts">
/**
 * Night band of the Clock: a dark sector on the dial plate from bedtime to wake-up (behind the event arcs), a thin
 * radial line with a moon at the bedtime edge and with a sun at the wake-up edge. Drawn inside the clock's SVG.
 */
import { computed } from 'vue';
import { IconBedtime, IconSunny } from '@/components/icons';
import { CENTER, pointAt } from '@/features/labs/clock/geometry';
import { clipToDay, pieceTime } from './bedtime';
import { nextIsoDate, useBedtimeWindows } from './useBedtime';

const props = defineProps<{ date: string }>();
/** Radius of the dial plate, and where the edge lines and icons sit on it. */
const R_PLATE = 178;
const R_LINE = 122;
const R_ICON = 134;
const ICON = 14;
const windows = useBedtimeWindows(() => ({ from: props.date, to: nextIsoDate(props.date) }));

/** SVG path of the pie slice between two minutes of the day on the plate. */
function sector(from: number, to: number): string {
  const a = pointAt(from, R_PLATE), b = pointAt(Math.min(to, from + 1439.9), R_PLATE);
  return `M ${CENTER} ${CENTER} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R_PLATE} ${R_PLATE} 0 ${to - from > 720 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}
const pieces = computed(() => windows.value.flatMap((w) => {
  const p = clipToDay(w, props.date);
  if (!p) return [];
  const line = (min: number) => ({ a: pointAt(min, R_LINE), b: pointAt(min, R_PLATE), icon: pointAt(min, R_ICON) });
  return [{ w, ...p, d: sector(p.startMin, p.endMin), startEdge: line(p.startMin), endEdge: line(p.endMin) }];
}));
</script>

<template>
  <g class="bedtime-dial" pointer-events="none">
    <template v-for="p in pieces" :key="p.w.from">
      <path
        :d="p.d" class="sector" data-testid="bedtime-band" :data-date="date" :data-start="pieceTime(p.startMin)" :data-end="pieceTime(p.endMin)"
        :data-from="p.w.from" :data-to="p.w.to" :data-mode="p.w.mode"
      />
      <template v-if="p.startsHere">
        <line :x1="p.startEdge.a.x" :y1="p.startEdge.a.y" :x2="p.startEdge.b.x" :y2="p.startEdge.b.y" class="edge" />
        <circle :cx="p.startEdge.icon.x" :cy="p.startEdge.icon.y" r="10" class="chip" />
        <IconBedtime :x="p.startEdge.icon.x - ICON / 2" :y="p.startEdge.icon.y - ICON / 2" :width="ICON" :height="ICON" class="glyph" data-testid="bedtime-moon" />
      </template>
      <template v-if="p.endsHere">
        <line :x1="p.endEdge.a.x" :y1="p.endEdge.a.y" :x2="p.endEdge.b.x" :y2="p.endEdge.b.y" class="edge" />
        <circle :cx="p.endEdge.icon.x" :cy="p.endEdge.icon.y" r="10" class="chip" />
        <IconSunny :x="p.endEdge.icon.x - ICON / 2" :y="p.endEdge.icon.y - ICON / 2" :width="ICON" :height="ICON" class="glyph" data-testid="bedtime-sun" />
      </template>
    </template>
  </g>
</template>

<style scoped>
.sector { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 34%, transparent); }
.edge { stroke: color-mix(in srgb, var(--md-sys-color-on-surface) 55%, transparent); stroke-width: 1; }
.chip { fill: var(--md-sys-color-surface-container-high); }
.glyph { color: var(--md-sys-color-on-surface); }
</style>
