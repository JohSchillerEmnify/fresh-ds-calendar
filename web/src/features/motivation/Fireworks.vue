<script setup lang="ts">
/**
 * Fireworks for the sky of the New Year's Eve scene: a few bursts (`data-part="firework"`) of twelve rays each. At Full
 * every burst blooms and fades in turn (CSS transform and opacity only, no scripting); at Reduced and Off the bursts
 * stand still as small static stars.
 */
const BURSTS = [
  { left: 14, top: 26, color: '#ff5252', delay: 0, size: 26 },
  { left: 38, top: 38, color: '#ffd740', delay: -1.1, size: 20 },
  { left: 60, top: 24, color: '#69f0ae', delay: -2.2, size: 28 },
  { left: 82, top: 36, color: '#40c4ff', delay: -0.6, size: 22 },
];
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<template>
  <div class="fw" aria-hidden="true">
    <span v-for="(b, i) in BURSTS" :key="i" class="burst" data-part="firework" :style="{ left: `${b.left}%`, top: `${b.top}%`, '--c': b.color, '--s': `${b.size}px`, animationDelay: `${b.delay}s` }">
      <i v-for="a in RAYS" :key="a" class="ray" :style="{ rotate: `${a}deg` }" />
    </span>
  </div>
</template>

<style scoped>
.fw { position: absolute; inset: 0; pointer-events: none; }
.burst { position: absolute; width: 0; height: 0; opacity: 0.8; animation: burst 3.300s ease-out infinite; animation-play-state: paused; }
.ray { position: absolute; left: -0.500px; top: calc(var(--s) / -2); width: 1px; height: calc(var(--s) / 2); background: linear-gradient(to bottom, var(--c), transparent); transform-origin: 50% 100%; filter: drop-shadow(0 0 1px var(--c)); }
html[data-motion='full'] .burst { animation-play-state: running; }
@keyframes burst { 0% { transform: scale(0.1); opacity: 1; } 55% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.15); opacity: 0; } }
</style>
