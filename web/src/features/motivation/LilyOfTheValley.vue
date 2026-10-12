<script setup lang="ts">
/**
 * Lily of the valley (Maiglöckchen) for the spring scene: two broad leaves, an arching stem and a row of little
 * white bells that get smaller towards the tip. The bells swing on their stalks at Full and Reduced and are still at
 * Off. `mirrored` lets the stem arch the other way.
 */
withDefaults(defineProps<{ mirrored?: boolean }>(), { mirrored: false });

// where each bell hangs on the arch (x, y, size), from the base of the arch to its drooping tip
const BELLS: [x: number, y: number, s: number][] = [[22.400, 21, 1], [25.200, 16.600, 0.96], [28.800, 13.800, 0.88], [32.200, 13.400, 0.78], [34.600, 16.200, 0.66]];
</script>

<template>
  <svg class="lily" data-part="lily-of-the-valley" viewBox="0 0 40 48" aria-hidden="true" focusable="false">
    <g :transform="mirrored ? 'translate(40 0) scale(-1 1)' : undefined">
      <g class="leaves">
        <path class="leaf" d="M17 48 C8 39 8 21 14 9 C19 20 20.500 36 19 48 Z" />
        <path class="rib" d="M18 46 C14 36 13.500 22 14 12" />
        <path class="leaf back" d="M21 48 C29 40 31 25 27 14 C23 24 21.500 36 20 48 Z" />
      </g>
      <path class="stem" d="M19.500 48 C19.500 32 21 20 28 14.200 C31.500 11.800 34.200 13 35 16.400" />
      <g v-for="(b, i) in BELLS" :key="i" :transform="`translate(${b[0]} ${b[1]}) scale(${b[2]})`">
        <g class="bell" :style="{ animationDelay: `${-i * 0.45}s` }">
          <path class="stalk" d="M0 0 C0.400 1 0.300 1.800 0 2.600" />
          <path class="cup" d="M-2.300 5.400 C-2.600 3.400 -1.600 2.400 0 2.400 C1.600 2.400 2.600 3.400 2.300 5.400 L2.900 6.400 L1.500 6 L0 6.800 L-1.500 6 L-2.900 6.400 Z" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.lily {
  --leaf: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 30%, #4f9d3a);
  display: block; overflow: visible; aspect-ratio: 40 / 48;
}
.leaf { fill: var(--leaf); }
.leaf.back { fill: color-mix(in oklab, var(--leaf) 78%, var(--md-sys-color-on-surface, #1d1b20)); }
.rib { fill: none; stroke: color-mix(in oklab, var(--leaf) 50%, var(--md-sys-color-surface, #fff)); stroke-width: 0.500; stroke-linecap: round; }
.stem, .stalk { fill: none; stroke: color-mix(in oklab, var(--leaf) 85%, #a5d66f); stroke-width: 0.900; stroke-linecap: round; }
.stalk { stroke-width: 0.500; }
.cup { fill: color-mix(in oklab, #fff 90%, var(--md-sys-color-primary-container, #e8f5e0)); stroke: color-mix(in oklab, var(--md-sys-color-outline, #79747e) 55%, transparent); stroke-width: 0.350; }
.bell { transform-box: view-box; transform-origin: 0 0; animation: lily-swing 2.600s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .bell { animation-play-state: running; }
html[data-motion='reduced'] .bell { animation-play-state: running; animation-duration: 5s; }
@keyframes lily-swing { from { transform: rotate(-9deg); } to { transform: rotate(7deg); } }
</style>
