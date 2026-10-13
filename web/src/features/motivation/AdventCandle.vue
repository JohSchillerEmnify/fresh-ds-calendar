<script setup lang="ts">
/**
 * One big Advent candle (`data-part="advent-candle"`, `data-lit` true or false). Unlit it stays visible but dark; lit
 * it carries a flame with a soft glow that flickers at Full only and burns steadily at Reduced and Off. Kept at low
 * opacity so the top bar's title and buttons stay readable over it.
 */
defineProps<{ lit: boolean; delay?: number }>();
</script>

<template>
  <span class="candle" data-part="advent-candle" data-testid="advent-candle" :data-lit="lit ? 'true' : 'false'" :style="{ '--d': `${-(delay ?? 0)}s` }" aria-hidden="true">
    <i v-if="lit" class="glow" />
    <svg viewBox="0 0 12 40" focusable="false">
      <path v-if="lit" class="flame" d="M6 1 C2.600 6 3 10 6 12 C9 10 9.400 6 6 1 Z" />
      <path class="wick" d="M6 11.500 L6 14" />
      <rect class="wax" x="1.500" y="14" width="9" height="26" rx="1.200" />
    </svg>
  </span>
</template>

<style scoped>
.candle { position: absolute; bottom: 0; display: block; aspect-ratio: 12 / 40; height: min(80cqh, 52px); opacity: 0.6; }
.candle[data-lit='true'] { opacity: 0.85; }
.candle svg { position: relative; display: block; width: 100%; height: 100%; overflow: visible; }
.wax { fill: color-mix(in oklab, var(--md-sys-color-on-surface, #231917) 35%, var(--md-sys-color-surface, #fff)); }
.candle[data-lit='true'] .wax { fill: color-mix(in oklab, #fff 70%, var(--md-sys-color-error-container, #f9dedc)); }
.wick { stroke: color-mix(in oklab, var(--md-sys-color-on-surface, #231917) 70%, #000); stroke-width: 0.800; }
.flame { fill: #ffb300; transform-box: fill-box; transform-origin: 50% 100%; animation: flame-flicker 0.900s ease-in-out var(--d) infinite alternate; animation-play-state: paused; }
.glow { position: absolute; left: -90%; right: -90%; top: -22%; height: 55%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in oklab, #ffb300 55%, transparent), transparent); }
html[data-motion='full'] .flame { animation-play-state: running; }
@keyframes flame-flicker { from { transform: scale(1, 0.88); opacity: 0.85; } to { transform: scale(0.92, 1.08); opacity: 1; } }
</style>
