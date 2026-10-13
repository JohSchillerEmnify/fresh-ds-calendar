<script setup lang="ts">
/**
 * The Easter part of the living scene layer: the spring meadow with its first flowers, painted eggs
 * (`data-part="easter-egg"`) hidden in the grass and a hare (`data-part="hare"`) whose ears twitch at Full only.
 */
import SpringMeadow from './SpringMeadow.vue';

const EGGS = [
  { left: 9, color: '#f48fb1', stripe: '#fff' }, { left: 24, color: '#81d4fa', stripe: '#fff176' }, { left: 55, color: '#ffe082', stripe: '#ce93d8' },
  { left: 80, color: '#a5d6a7', stripe: '#fff' }, { left: 94, color: '#ce93d8', stripe: '#ffe082' },
];
</script>

<template>
  <div class="easter" aria-hidden="true">
    <SpringMeadow />
    <span v-for="(e, i) in EGGS" :key="i" class="egg" data-part="easter-egg" :style="{ left: `${e.left}%`, '--egg': e.color, '--stripe': e.stripe }">
      <svg viewBox="0 0 12 16" focusable="false">
        <path class="shell" d="M6 1 C9.500 1 11.500 7 11.500 10.500 C11.500 13.600 9.200 15.500 6 15.500 C2.800 15.500 0.500 13.600 0.500 10.500 C0.500 7 2.500 1 6 1 Z" />
        <path class="band" d="M1 9 L3 7.600 L5 9 L7 7.600 L9 9 L11 7.600 M1 12 L3 10.600 L5 12 L7 10.600 L9 12 L11 10.600" />
      </svg>
    </span>
    <svg class="hare" data-part="hare" viewBox="0 0 40 36" focusable="false">
      <ellipse class="fur" cx="19" cy="26" rx="12" ry="8.500" />
      <circle class="fur" cx="31" cy="17" r="6" />
      <g class="ears"><ellipse class="fur ear" cx="29" cy="5" rx="2.200" ry="7" transform="rotate(-8 29 5)" /><ellipse class="fur ear" cx="34" cy="6" rx="2" ry="6.600" transform="rotate(12 34 6)" /></g>
      <circle class="tail" cx="7" cy="25" r="3.200" />
      <circle class="eye" cx="33.400" cy="16" r="0.900" />
      <circle class="nose" cx="36.800" cy="18" r="0.900" />
      <path class="fur" d="M17 32 L27 32 L27 34.500 L15 34.500 Z" />
    </svg>
  </div>
</template>

<style scoped>
.easter { position: absolute; inset: 0; pointer-events: none; }
.egg { position: absolute; bottom: 1px; height: min(30cqh, 20px); aspect-ratio: 12 / 16; }
.egg svg { display: block; width: 100%; height: 100%; }
.shell { fill: var(--egg); stroke: color-mix(in oklab, var(--egg) 60%, #000); stroke-width: 0.500; }
.band { fill: none; stroke: var(--stripe); stroke-width: 1; stroke-linejoin: round; }
.hare { position: absolute; left: 66%; bottom: 0; height: min(66cqh, 44px); width: auto; overflow: visible; }
.fur { fill: color-mix(in oklab, #b08968 70%, var(--md-sys-color-on-surface, #231917)); }
.tail { fill: #fff; } .eye { fill: #231917; } .nose { fill: #f48fb1; }
.ears { transform-box: fill-box; transform-origin: 50% 100%; animation: hare-ears 3.200s ease-in-out infinite; animation-play-state: paused; }
html[data-motion='full'] .ears { animation-play-state: running; }
@keyframes hare-ears { 0%, 70%, 100% { transform: rotate(0); } 78% { transform: rotate(-9deg); } 86% { transform: rotate(5deg); } }
@container (max-width: 520px) { .egg:nth-of-type(n + 4) { display: none; } }
</style>
