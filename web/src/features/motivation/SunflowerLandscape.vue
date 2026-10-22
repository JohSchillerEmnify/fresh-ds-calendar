<script setup lang="ts">
import { computed } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';

/**
 * Quiet landscape behind the sunflower field (feature sunflower-field): a sky gradient, two soft rolling
 * hills, a few drifting clouds and a couple of bees that cross now and then. Light and dark variants; colours are
 * low-contrast so the top bar text stays legible. Drift and bees run only at the Full animation level while the page
 * is visible (CSS only, no per-frame JS); otherwise it is a still picture without bees. Parts carry `data-part`.
 */
const visibility = useDocumentVisibility();
const run = computed(() => (visibility.value === 'hidden' ? 'off' : 'on'));
const clouds = [
  { top: '12%', scale: 1, dur: '95s', delay: '-20s' },
  { top: '34%', scale: 0.7, dur: '120s', delay: '-75s' },
  { top: '6%', scale: 0.55, dur: '85s', delay: '-48s' },
];
const bees = [
  { top: '38%', dur: '27s', delay: '-4s' },
  { top: '56%', dur: '41s', delay: '-22s' },
];
</script>

<template>
  <div class="sl" :data-run="run" aria-hidden="true">
    <div class="sky" data-part="sky" />
    <div class="hills" data-part="hills"><i class="hill far" /><i class="hill near" /></div>
    <i
      v-for="(c, n) in clouds" :key="'c' + n" class="cloud" data-part="cloud"
      :style="{ top: c.top, '--s': c.scale, animationDuration: c.dur, animationDelay: c.delay }"
    />
    <span v-for="(b, n) in bees" :key="'b' + n" class="bee" data-part="bee" :style="{ top: b.top, animationDuration: b.dur, animationDelay: b.delay }">
      <svg viewBox="0 0 14 10" width="12" height="9">
        <ellipse cx="5" cy="3" rx="3" ry="2" class="wing" />
        <ellipse cx="8" cy="3" rx="3" ry="2" class="wing" />
        <ellipse cx="7" cy="6.5" rx="5" ry="3" class="body" />
        <path d="M5 4.2v4.6M8 3.8v5.4" class="stripe" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.sl { position: absolute; inset: 0; overflow: hidden; container-type: size;
  --sl-sky-top: color-mix(in srgb, #8ec9f2 34%, transparent); --sl-sky-low: color-mix(in srgb, #fff1c1 26%, transparent);
  --sl-hill-far: color-mix(in srgb, #7fbf6a 30%, transparent); --sl-hill-near: color-mix(in srgb, #4f9d3a 30%, transparent);
  --sl-cloud: rgb(255 255 255 / 0.6); }
html[data-theme='dark'] .sl {
  --sl-sky-top: color-mix(in srgb, #1b2a52 52%, transparent); --sl-sky-low: color-mix(in srgb, #3a3560 34%, transparent);
  --sl-hill-far: color-mix(in srgb, #2c5a3a 38%, transparent); --sl-hill-near: color-mix(in srgb, #1f4a2c 42%, transparent);
  --sl-cloud: rgb(190 205 235 / 0.2);
}
.sky { position: absolute; inset: 0; background: linear-gradient(180deg, var(--sl-sky-top), var(--sl-sky-low) 85%); }
.hills { position: absolute; inset: 0; }
.hill { position: absolute; bottom: -62%; height: 100%; border-radius: 50%; }
.hill.far { left: -12%; width: 78%; background: var(--sl-hill-far); }
.hill.near { right: -18%; width: 92%; bottom: -78%; background: var(--sl-hill-near); }
/* a cloud is one rounded bar with two bumps; --s scales it */
.cloud { position: absolute; left: 0; width: calc(46px * var(--s)); height: calc(12px * var(--s)); border-radius: 999px; background: var(--sl-cloud);
  animation: sl-drift 100s linear infinite; animation-play-state: paused; }
.cloud::before, .cloud::after { content: ''; position: absolute; bottom: 45%; border-radius: 50%; background: var(--sl-cloud); }
.cloud::before { left: 16%; width: 38%; height: 120%; }
.cloud::after { left: 46%; width: 30%; height: 90%; }
.bee { display: none; position: absolute; left: 0; opacity: 0; animation: sl-bee 30s ease-in-out infinite; animation-play-state: paused; }
.bee .wing { fill: rgb(255 255 255 / 0.75); }
.bee .body { fill: #f2b807; }
.bee .stripe { stroke: #3b2a12; stroke-width: 1.4; fill: none; }
html[data-motion='full'] .sl[data-run='on'] .cloud, html[data-motion='full'] .sl[data-run='on'] .bee { animation-play-state: running; }
html[data-motion='full'] .bee { display: block; }
@keyframes sl-drift { from { translate: -60px 0; } to { translate: calc(100cqw + 20px) 0; } }
/* a bee crosses in about 18 % of its period and is gone the rest of the time */
@keyframes sl-bee {
  0% { translate: -14px 0; opacity: 0; }
  2% { opacity: 1; }
  7% { translate: 22cqw -5cqh; }
  12% { translate: 52cqw 6cqh; }
  17% { translate: calc(88cqw) -4cqh; opacity: 1; }
  19%, 100% { translate: calc(100cqw + 14px) 0; opacity: 0; }
}
</style>
