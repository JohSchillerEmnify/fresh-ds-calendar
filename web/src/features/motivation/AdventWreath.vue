<script setup lang="ts">
/**
 * The Advent wreath (`data-part="advent-wreath"`): a ring of fir with four candles (`data-part="advent-candle"`,
 * `data-lit` true or false). The first `candles` candles (left to right) burn with a small flame that flickers at Full
 * only and burns steadily at Reduced and Off.
 */
defineProps<{ candles: number }>();
const CANDLES = [{ x: 10, h: 12 }, { x: 19, h: 15 }, { x: 29, h: 15 }, { x: 38, h: 12 }] as const;
</script>

<template>
  <svg class="wreath" data-part="advent-wreath" viewBox="0 0 48 36" aria-hidden="true" focusable="false">
    <ellipse class="ring" cx="24" cy="29" rx="21" ry="5.500" />
    <ellipse class="berries" cx="24" cy="29" rx="21" ry="5.500" />
    <g
      v-for="(c, i) in CANDLES" :key="i" class="candle" data-part="advent-candle" data-testid="advent-candle" :data-lit="i < candles ? 'true' : 'false'"
      :style="{ '--d': `${-i * 0.45}s` }"
    >
      <rect class="wax" :x="c.x - 1.600" :y="28 - c.h" width="3.200" :height="c.h" rx="0.600" />
      <path v-if="i < candles" class="flame" :d="`M${c.x} ${24.600 - c.h} C${c.x - 2.200} ${27 - c.h} ${c.x - 1.600} ${29.600 - c.h} ${c.x} ${29.800 - c.h} C${c.x + 1.600} ${29.600 - c.h} ${c.x + 2.200} ${27 - c.h} ${c.x} ${24.600 - c.h} Z`" />
    </g>
  </svg>
</template>

<style scoped>
.wreath { display: block; overflow: visible; aspect-ratio: 48 / 36; }
.ring { fill: none; stroke: color-mix(in oklab, #1f6b3a 78%, var(--md-sys-color-on-surface, #231917)); stroke-width: 5; }
.berries { fill: none; stroke: #e53935; stroke-width: 1.800; stroke-dasharray: 0.100 7; stroke-linecap: round; }
.wax { fill: color-mix(in oklab, #fff 85%, var(--md-sys-color-error-container, #f9dedc)); stroke: color-mix(in oklab, var(--md-sys-color-outline, #79747e) 40%, transparent); stroke-width: 0.300; }
.flame { fill: #ffb300; filter: drop-shadow(0 0 1.500px #ffb300); transform-box: fill-box; transform-origin: 50% 100%; animation: flame-flicker 0.900s ease-in-out var(--d) infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .flame { animation-play-state: running; }
@keyframes flame-flicker { from { transform: scale(1, 0.88); opacity: 0.85; } to { transform: scale(0.92, 1.08); opacity: 1; } }
</style>
