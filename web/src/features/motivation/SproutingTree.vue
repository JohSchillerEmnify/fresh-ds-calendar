<script setup lang="ts">
import { computed } from 'vue';
import { getActivePinia } from 'pinia';
import { useClockStore } from '@/stores/clock';

/**
 * A young spring tree whose buds leaf out over the day (ARCHITECTURE "Season scenes"): in the early morning only
 * buds show, by the evening every twig is in leaf and a few blossoms are open. The leafing follows the app clock;
 * at Full the leaves unfurl once when the scene appears and the tree sways gently, at Reduced it only sways, at Off
 * it is still. `mirrored` flips the drawing so two trees in one scene do not look the same.
 */
withDefaults(defineProps<{ mirrored?: boolean }>(), { mirrored: false });
const clock = getActivePinia() ? useClockStore() : null;

/** Share of the day the tree has leafed out: 0.15 before 06:00, growing to 1 at 18:00. */
const progress = computed(() => {
  const minutes = clock?.minutesNow ?? 12 * 60;
  return Math.min(1, Math.max(0.15, (minutes - 6 * 60) / (12 * 60)));
});

// twig tips and joints (in the 40 x 60 drawing) where a bud sits; the order is the order they leaf out
const BUDS: [x: number, y: number, angle: number][] = [
  [20, 15, -90], [11, 27, -140], [30, 24, -40], [15, 21, -120], [25, 19, -60], [8, 21, -110], [33, 18, -70],
  [14, 33, -160], [27, 31, -20], [18, 26, -100], [23, 27, -80], [10, 33, 180], [31, 30, 0],
];
const BLOSSOMS: [x: number, y: number][] = [[17, 17], [27, 22], [12, 24], [22, 30]];
const leaves = computed(() =>
  BUDS.map(([x, y, a], i) => ({ x, y, a, s: Math.min(1, Math.max(0.12, progress.value * 1.5 - i * 0.05)), d: `${0.15 + i * 0.09}s` })),
);
const blossoms = computed(() => BLOSSOMS.map(([x, y], i) => ({ x, y, s: Math.min(1, Math.max(0, (progress.value - 0.55 - i * 0.08) * 4)) })));
</script>

<template>
  <svg class="tree" data-part="sprouting-tree" viewBox="0 0 40 60" aria-hidden="true" focusable="false" :data-leafed="Math.round(progress * 100)">
    <g class="sway" :transform="mirrored ? 'translate(40 0) scale(-1 1)' : undefined">
      <path class="bark trunk" d="M20 60 C20.500 52 19 44 20 36" />
      <path class="bark" d="M20 44 C16 40 13 35 11 27 M20 40 C25 36 28 30 30 24 M20 36 C20 29 19 23 20 15 M13 34 C11 31 9 26 8 21 M28 30 C30 26 32 22 33 18 M20 30 C17 27 16 24 15 21 M20 28 C23 25 24 22 25 19 M17 38 C15 37 13 35 14 33 M24 35 C26 34 27 33 27 31" />
      <g v-for="(l, i) in leaves" :key="i" :transform="`translate(${l.x} ${l.y}) rotate(${l.a})`">
        <circle class="bud" r="1.300" />
        <g class="leaf" :style="{ '--s': l.s, animationDelay: l.d }">
          <path d="M0 0 C1.500 -2.600 5.500 -2.600 7 0 C5.500 2.600 1.500 2.600 0 0 Z" />
          <path class="vein" d="M0.800 0 L5.600 0" />
        </g>
      </g>
      <g v-for="(b, i) in blossoms" :key="'b' + i" class="blossom" :transform="`translate(${b.x} ${b.y}) scale(${b.s})`">
        <circle v-for="a in [0, 72, 144, 216, 288]" :key="a" r="1.300" :cx="1.400 * Math.cos((a * Math.PI) / 180)" :cy="1.400 * Math.sin((a * Math.PI) / 180)" />
        <circle class="heart" r="0.700" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.tree {
  --bark: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 42%, #7a4a1e);
  --leaf: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 32%, #6cc04a);
  display: block; overflow: visible; aspect-ratio: 40 / 60;
}
.bark { fill: none; stroke: var(--bark); stroke-width: 1.300; stroke-linecap: round; }
.trunk { stroke-width: 3.200; }
.bud { fill: color-mix(in oklab, var(--leaf) 55%, var(--bark)); }
.leaf { fill: var(--leaf); transform: scale(var(--s)); transform-box: view-box; transform-origin: 0 0; }
.vein { fill: none; stroke: color-mix(in oklab, var(--leaf) 55%, var(--md-sys-color-surface, #fff)); stroke-width: 0.400; stroke-linecap: round; }
.blossom circle { fill: color-mix(in oklab, var(--md-sys-color-tertiary, #b5486f) 25%, #ffd6e4); }
.blossom .heart { fill: #f6c21c; }
.sway { transform-box: view-box; transform-origin: 20px 60px; animation: tree-sway 6.500s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .sway, html[data-motion='reduced'] .sway { animation-play-state: running; }
/* the leaves unfurl from their buds once, when the scene comes in (Full only) */
html[data-motion='full'] .leaf { animation: tree-unfurl 1.400s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
@keyframes tree-sway { from { transform: rotate(-1.600deg); } to { transform: rotate(1.600deg); } }
@keyframes tree-unfurl { from { transform: scale(0.1); } to { transform: scale(var(--s)); } }
</style>
