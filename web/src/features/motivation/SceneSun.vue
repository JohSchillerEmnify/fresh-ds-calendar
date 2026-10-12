<script setup lang="ts">
/**
 * The small summer sun: a warm disc with a sleepy smile and gentle rays. At Full the rays turn slowly and breathe,
 * at Reduced they only breathe, at Off the sun is still.
 */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<template>
  <svg class="sun" data-part="sun" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false">
    <circle class="halo" r="15" />
    <g class="rays">
      <path v-for="a in RAYS" :key="a" :class="{ short: a % 60 }" d="M0 -11.500 L0 -16" :transform="`rotate(${a})`" />
    </g>
    <circle class="disc" r="9" />
    <path class="face" d="M-4.200 -1 Q-3 -2.400 -1.800 -1 M1.800 -1 Q3 -2.400 4.200 -1 M-2.200 2.200 Q0 4.200 2.200 2.200" />
    <circle class="cheek" cx="-4.600" cy="2" r="1.300" /><circle class="cheek" cx="4.600" cy="2" r="1.300" />
  </svg>
</template>

<style scoped>
.sun {
  --sun: color-mix(in oklab, #ffc23d 84%, var(--md-sys-color-primary, #6750a4));
  display: block; overflow: visible; aspect-ratio: 1;
}
.halo { fill: color-mix(in oklab, var(--sun) 28%, transparent); }
.disc { fill: var(--sun); }
.rays path { stroke: var(--sun); stroke-width: 2.200; stroke-linecap: round; }
.rays path.short { stroke-width: 1.600; transform-origin: 0 0; scale: 0.92; }
.face { fill: none; stroke: color-mix(in oklab, var(--sun) 40%, #6b3a00); stroke-width: 0.900; stroke-linecap: round; }
.cheek { fill: color-mix(in oklab, var(--md-sys-color-tertiary, #b5486f) 40%, #ff9a7a); opacity: 0.55; }
.rays { transform-box: view-box; transform-origin: 0 0; animation: sun-turn 40s linear infinite, sun-breathe 3.600s ease-in-out infinite alternate; animation-play-state: paused; }
.halo { transform-box: view-box; transform-origin: 0 0; animation: sun-glow 3.600s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .rays, html[data-motion='full'] .halo { animation-play-state: running; }
html[data-motion='reduced'] .rays { animation: sun-breathe 6s ease-in-out infinite alternate; }
html[data-motion='reduced'] .halo { animation-play-state: running; animation-duration: 6s; }
@keyframes sun-turn { to { rotate: 360deg; } }
@keyframes sun-breathe { from { scale: 0.94; } to { scale: 1.06; } }
@keyframes sun-glow { from { transform: scale(0.9); opacity: 0.7; } to { transform: scale(1.12); opacity: 1; } }
</style>
