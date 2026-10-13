<script setup lang="ts">
/**
 * The New Year's Eve part of the living scene layer: a night sky with a few stars (`data-part="star"`, twinkling at
 * Full only), fireworks bursting over a dark city skyline (`data-part="skyline"`). Colours come from the theme tokens.
 */
import Fireworks from './Fireworks.vue';

const STARS = [{ left: 6, top: 14 }, { left: 27, top: 10 }, { left: 49, top: 18 }, { left: 71, top: 9 }, { left: 92, top: 16 }];
</script>

<template>
  <div class="nye" aria-hidden="true">
    <i v-for="(s, i) in STARS" :key="i" class="star" data-part="star" :style="{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${-i * 0.7}s` }" />
    <Fireworks />
    <svg class="skyline" data-part="skyline" viewBox="0 0 400 20" preserveAspectRatio="none" focusable="false">
      <path d="M0 20 L0 12 L14 12 L14 7 L24 7 L24 13 L40 13 L40 4 L50 4 L50 10 L70 10 L70 14 L92 14 L92 6 L104 6 L104 12 L130 12 L130 8 L146 8 L146 14 L170 14 L170 3 L181 3 L181 11 L208 11 L208 13 L232 13 L232 7 L246 7 L246 12 L270 12 L270 5 L284 5 L284 11 L312 11 L312 14 L336 14 L336 6 L350 6 L350 12 L376 12 L376 9 L400 9 L400 20 Z" />
    </svg>
  </div>
</template>

<style scoped>
.nye { position: absolute; inset: 0; pointer-events: none; }
.star { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #fff6d6; box-shadow: 0 0 3px #fff6d6; opacity: 0.8; animation: nye-twinkle 2.400s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .star { animation-play-state: running; }
.skyline { position: absolute; left: 0; bottom: 0; width: 100%; height: min(34cqh, 22px); }
.skyline path { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 78%, var(--md-sys-color-primary, #d4af37)); }
@keyframes nye-twinkle { from { opacity: 0.3; transform: scale(0.7); } to { opacity: 1; transform: scale(1.1); } }
</style>
