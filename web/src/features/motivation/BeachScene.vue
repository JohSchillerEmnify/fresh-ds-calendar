<script setup lang="ts">
/**
 * The Summer holidays part of the living scene layer: a small sun (`SceneSun`) over the sea (`data-part="sea"`) with
 * rolling waves, a strip of sand and a beach umbrella (`data-part="beach-umbrella"`). The waves roll at Full only.
 */
import SceneSun from './SceneSun.vue';
</script>

<template>
  <div class="beach" aria-hidden="true">
    <SceneSun class="sun" />
    <div class="sea" data-part="sea">
      <svg class="waves" viewBox="0 0 800 10" preserveAspectRatio="none" focusable="false">
        <path d="M0 5 Q25 0 50 5 T100 5 T150 5 T200 5 T250 5 T300 5 T350 5 T400 5 T450 5 T500 5 T550 5 T600 5 T650 5 T700 5 T750 5 T800 5 L800 10 L0 10 Z" />
      </svg>
    </div>
    <svg class="sand" viewBox="0 0 400 12" preserveAspectRatio="none" focusable="false"><path d="M0 12 L0 6 C80 1 160 4 240 5 C300 6 350 3 400 4 L400 12 Z" /></svg>
    <svg class="umbrella" data-part="beach-umbrella" viewBox="0 0 30 30" focusable="false">
      <path class="pole" d="M15 7 L15 30" />
      <path class="top" d="M2 14 C2 6 9 2 15 2 C21 2 28 6 28 14 Z" />
      <path class="stripe" d="M15 2 C12 5 11 9 11 14 M15 2 C18 5 19 9 19 14" />
    </svg>
  </div>
</template>

<style scoped>
.beach { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.sun { position: absolute; right: 8%; top: -8%; height: min(58cqh, 38px); width: auto; }
.sea { position: absolute; left: 0; right: 0; bottom: min(12cqh, 8px); height: min(34cqh, 22px); background: linear-gradient(180deg, color-mix(in oklab, #29b6f6 55%, transparent), color-mix(in oklab, #0277bd 60%, transparent)); overflow: hidden; }
.waves { position: absolute; left: 0; top: -1px; width: 200%; height: 40%; animation: sea-roll 9s linear infinite; animation-play-state: paused; }
.waves path { fill: color-mix(in oklab, #fff 55%, transparent); }
html[data-motion='full'] .waves { animation-play-state: running; }
.sand { position: absolute; left: 0; bottom: 0; width: 100%; height: min(24cqh, 16px); }
.sand path { fill: color-mix(in oklab, #f3d9a4 85%, var(--md-sys-color-primary, #0097a7)); }
.umbrella { position: absolute; left: 22%; bottom: 0; height: min(66cqh, 44px); width: auto; overflow: visible; }
.pole { stroke: color-mix(in oklab, #8d6e63 80%, #000); stroke-width: 1.200; }
.top { fill: #ef5350; } .stripe { fill: none; stroke: #fff; stroke-width: 1.800; }
@keyframes sea-roll { to { transform: translateX(-50%); } }
</style>
