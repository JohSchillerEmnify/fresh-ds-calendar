<script setup lang="ts">
/**
 * The Christmas tree (`data-part="xmas-tree"`, `data-lights` `on` or `off`): three tiers of fir with a star and a string
 * of lights. With the lights off the bulbs are dark; with them on they glow in four colours and, at Full only, twinkle.
 * Colours from fixed festive hues mixed with the theme tokens.
 */
defineProps<{ lights: boolean }>();
const BULBS = [[15, 10], [11, 17], [19, 18], [8, 26], [15, 25], [22, 27], [6, 35], [13, 34], [20, 35], [25, 34]] as const;
</script>

<template>
  <svg class="tree" data-part="xmas-tree" data-testid="xmas-tree" :data-lights="lights ? 'on' : 'off'" viewBox="0 0 30 42" aria-hidden="true" focusable="false">
    <rect class="trunk" x="13" y="37" width="4" height="5" />
    <path class="fir" d="M15 4 L22 18 L18.500 18 L26 31 L21 31 L29 40 L1 40 L9 31 L4 31 L11.500 18 L8 18 Z" />
    <path class="star" d="M15 0.500 L16.100 3 L18.800 3.200 L16.700 4.900 L17.400 7.500 L15 6 L12.600 7.500 L13.300 4.900 L11.200 3.200 L13.900 3 Z" />
    <circle v-for="([x, y], i) in BULBS" :key="i" class="bulb" :class="`b${i % 4}`" :cx="x" :cy="y" r="1.400" :style="{ animationDelay: `${-(i * 0.37) % 2}s` }" />
  </svg>
</template>

<style scoped>
.tree { display: block; overflow: visible; aspect-ratio: 30 / 42; }
.fir { fill: color-mix(in oklab, #1f6b3a 78%, var(--md-sys-color-on-surface, #231917)); }
.trunk { fill: color-mix(in oklab, #6d4c2f 80%, var(--md-sys-color-on-surface, #231917)); }
.star { fill: #ffd54f; }
.bulb { fill: color-mix(in oklab, var(--md-sys-color-outline, #79747e) 70%, #000); opacity: 0.7; }
[data-lights='on'] .star { filter: drop-shadow(0 0 2px #ffd54f); }
[data-lights='on'] .b0 { fill: #ff5252; } [data-lights='on'] .b1 { fill: #ffd740; }
[data-lights='on'] .b2 { fill: #69f0ae; } [data-lights='on'] .b3 { fill: #40c4ff; }
[data-lights='on'] .bulb { opacity: 1; animation: bulb-twinkle 1.600s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] [data-lights='on'] .bulb { animation-play-state: running; }
@keyframes bulb-twinkle { from { opacity: 0.55; } to { opacity: 1; } }
</style>
