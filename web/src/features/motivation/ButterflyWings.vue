<script setup lang="ts">
/**
 * The butterfly drawing shared by the once-per-session reward visit (`Butterfly.vue`) and the ambient scene
 * butterflies (`SceneLife.vue`): two flapping wing pairs and a body. Colours come from the theme tokens and can be
 * tuned with `--bw-wing` / `--bw-lower`. Flapping slows at Reduced and stops at Off.
 */
</script>

<template>
  <svg class="bw" viewBox="0 0 28 24" width="28" height="24" aria-hidden="true" focusable="false">
    <g class="wing wl"><path d="M14 12 C8 2 1 3 2 9 C3 14 9 14 14 12Z" /><path d="M14 12 C9 14 5 20 9 21 C12 21 14 16 14 12Z" class="lo" /></g>
    <g class="wing wr"><path d="M14 12 C20 2 27 3 26 9 C25 14 19 14 14 12Z" /><path d="M14 12 C19 14 23 20 19 21 C16 21 14 16 14 12Z" class="lo" /></g>
    <ellipse cx="14" cy="12.500" rx="1.100" ry="5" class="body" />
  </svg>
</template>

<style scoped>
.bw { display: block; overflow: visible; }
.wing { fill: var(--bw-wing, var(--md-sys-color-tertiary, #b5486f)); opacity: 0.85; transform-box: view-box; transform-origin: 14px 12px; animation: bf-flap 0.2s ease-in-out infinite alternate; }
.wing .lo { fill: var(--bw-lower, var(--md-sys-color-primary, #6750a4)); opacity: 0.8; }
.body { fill: var(--md-sys-color-on-surface, #1d1b20); }
html[data-motion='reduced'] .wing { animation-duration: 0.9s; }
html[data-motion='off'] .wing { animation: none; }
@keyframes bf-flap { from { transform: scaleX(1); } to { transform: scaleX(0.25); } }
</style>
