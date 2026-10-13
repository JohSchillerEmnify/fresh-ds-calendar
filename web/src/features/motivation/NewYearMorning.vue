<script setup lang="ts">
/**
 * The New Year part of the living scene layer: the first sunrise of the year (`data-part="sunrise"`) over a hill
 * (`data-part="hill"`) with colourful confetti (`data-part="confetti"`) scattered on it. The falling confetti of the
 * backdrop comes from `SeasonScene` and moves at Full only.
 */
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: 4 + i * 6, bottom: 1 + (i * 3) % 5, rot: (i * 47) % 180, color: ['#ef5350', '#ffd54f', '#4fc3f7', '#81c784'][i % 4]!,
}));
</script>

<template>
  <div class="ny" aria-hidden="true">
    <svg class="sunrise" data-part="sunrise" viewBox="-20 -20 40 22" focusable="false">
      <g class="rays"><path v-for="a in [-75, -50, -25, 0, 25, 50, 75]" :key="a" d="M0 -12 L0 -17" :transform="`rotate(${a})`" /></g>
      <path class="disc" d="M-10 0 A10 10 0 0 1 10 0 Z" />
    </svg>
    <svg class="hill" data-part="hill" viewBox="0 0 400 16" preserveAspectRatio="none" focusable="false">
      <path d="M0 16 L0 9 C60 3 120 4 190 8 C260 12 330 3 400 6 L400 16 Z" />
    </svg>
    <span class="confetti" data-part="confetti">
      <i v-for="(c, i) in CONFETTI" :key="i" :style="{ left: `${c.left}%`, bottom: `${c.bottom}px`, rotate: `${c.rot}deg`, background: c.color }" />
    </span>
  </div>
</template>

<style scoped>
.ny { position: absolute; inset: 0; pointer-events: none; }
.sunrise { position: absolute; left: 62%; bottom: min(14cqh, 9px); height: min(52cqh, 34px); width: auto; overflow: visible; }
.disc { fill: color-mix(in oklab, #ffb74d 88%, var(--md-sys-color-primary, #00897b)); }
.rays path { stroke: color-mix(in oklab, #ffb74d 80%, var(--md-sys-color-primary, #00897b)); stroke-width: 1.600; stroke-linecap: round; }
.hill { position: absolute; left: 0; bottom: 0; width: 100%; height: min(18cqh, 12px); }
.hill path { fill: color-mix(in oklab, var(--md-sys-color-primary, #00897b) 45%, #2e7d32); }
.confetti i { position: absolute; width: 4px; height: 2px; border-radius: 1px; }
</style>
