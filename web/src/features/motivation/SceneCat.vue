<script setup lang="ts">
/**
 * The small cat that lives in every top bar scene (ARCHITECTURE "Season scenes and the support cat"). It sits and
 * flicks its tail, blinks now and then, and on a long loop stretches and takes a short nap. Pure SVG + CSS: the fur
 * follows the theme tokens so it reads in light and dark. Full plays everything, Reduced only blinks and flicks
 * slowly, Off is a still picture. `delay` (seconds) shifts the loop so cats in different scenes do not move in step.
 */
withDefaults(defineProps<{ delay?: number }>(), { delay: 0 });
</script>

<template>
  <svg class="cat" data-part="cat" viewBox="0 0 44 34" aria-hidden="true" focusable="false" :style="{ '--cat-delay': `${-delay}s` }">
    <g class="tail"><path d="M28 31 C35 32 39 27 37 20 C36 17 33 17.500 34 20" /></g>
    <g class="torso">
      <path class="fur" d="M12 32 C10 24 13 16.500 20 16.500 C27 16.500 30 24 28 32 Z" />
      <ellipse class="belly" cx="20" cy="26" rx="4.200" ry="5" />
      <ellipse class="paw" cx="16.800" cy="32" rx="2.300" ry="1.400" />
      <ellipse class="paw" cx="23.200" cy="32" rx="2.300" ry="1.400" />
    </g>
    <g class="head">
      <path class="fur" d="M13.600 9 L14.200 1.800 L19 6 Z M26.400 9 L25.800 1.800 L21 6 Z" />
      <path class="ear" d="M14.700 7 L15 3.600 L17.400 5.700 Z M25.300 7 L25 3.600 L22.600 5.700 Z" />
      <circle class="fur" cx="20" cy="11.500" r="7.400" />
      <g class="eyes-nap">
        <g class="eyes"><ellipse cx="17.200" cy="11" rx="1.200" ry="1.600" /><ellipse cx="22.800" cy="11" rx="1.200" ry="1.600" /></g>
      </g>
      <path class="lids" d="M15.900 11.300 Q17.200 12.500 18.500 11.300 M21.500 11.300 Q22.800 12.500 24.100 11.300" />
      <path class="nose" d="M19 13.400 L21 13.400 L20 14.500 Z" />
      <path class="line" d="M20 14.500 Q19 15.700 18 15 M20 14.500 Q21 15.700 22 15 M10.500 12.800 L15 13.400 M10.800 15.200 L15 14.500 M29.500 12.800 L25 13.400 M29.200 15.200 L25 14.500" />
    </g>
    <text class="zz" x="30" y="7">z</text>
  </svg>
</template>

<style scoped>
.cat {
  --fur: color-mix(in oklab, var(--md-sys-color-on-surface-variant, #49454f) 78%, var(--md-sys-color-primary, #6750a4));
  --light: color-mix(in oklab, var(--fur) 45%, var(--md-sys-color-surface, #fff));
  display: block; overflow: visible; aspect-ratio: 44 / 34;
}
.fur { fill: var(--fur); }
.belly, .paw { fill: var(--light); }
.ear, .nose { fill: color-mix(in oklab, var(--md-sys-color-tertiary, #b5486f) 60%, var(--light)); }
.eyes { fill: color-mix(in oklab, var(--md-sys-color-surface, #fff) 80%, var(--md-sys-color-tertiary-container, #ffd8e4)); }
.line, .lids { fill: none; stroke: var(--light); stroke-width: 0.5; stroke-linecap: round; }
.lids { stroke: var(--md-sys-color-surface, #fff); stroke-width: 0.8; opacity: 0; }
.tail path { fill: none; stroke: var(--fur); stroke-width: 2.800; stroke-linecap: round; }
.zz { font: 600 6px/1 system-ui, sans-serif; fill: var(--fur); opacity: 0; }

/* every moving group pivots in the drawing's own coordinates */
.tail, .torso, .head, .eyes, .eyes-nap, .lids, .zz { transform-box: view-box; }
.tail { transform-origin: 28px 31px; animation: cat-flick 2.800s ease-in-out infinite alternate; }
.torso { transform-origin: 20px 33px; animation: cat-stretch 26s ease-in-out var(--cat-delay) infinite; }
.head { transform-origin: 20px 18px; animation: cat-head 26s ease-in-out var(--cat-delay) infinite; }
.eyes { transform-origin: 20px 11px; animation: cat-blink 4.600s linear infinite; }
.eyes-nap { transform-origin: 20px 11px; animation: cat-eyes-nap 26s ease-in-out var(--cat-delay) infinite; }
.lids { animation: cat-lids 26s ease-in-out var(--cat-delay) infinite; }
.zz { transform-origin: 31px 6px; animation: cat-zz 26s ease-in-out var(--cat-delay) infinite; }

/* Full: everything; Reduced: blink + a slow tail; Off (and no level yet): a still, awake cat */
.tail, .torso, .head, .eyes, .eyes-nap, .lids, .zz { animation-play-state: paused; }
html[data-motion='full'] .tail, html[data-motion='full'] .torso, html[data-motion='full'] .head, html[data-motion='full'] .eyes, html[data-motion='full'] .eyes-nap, html[data-motion='full'] .lids, html[data-motion='full'] .zz { animation-play-state: running; }
html[data-motion='reduced'] .tail, html[data-motion='reduced'] .eyes { animation-play-state: running; }
html[data-motion='reduced'] .tail { animation-duration: 5s; }
html:not([data-motion='full']) .torso, html:not([data-motion='full']) .head, html:not([data-motion='full']) .eyes-nap, html:not([data-motion='full']) .lids, html:not([data-motion='full']) .zz { animation: none; }

@keyframes cat-flick { from { transform: rotate(-6deg); } to { transform: rotate(9deg); } }
@keyframes cat-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
/* 26 s loop: sit (0-52 %), stretch (55-66 %), sit, nap (72-94 %), wake */
@keyframes cat-stretch {
  0%, 53%, 68%, 100% { transform: none; }
  58%, 63% { transform: scale(1.14, 0.86); }
  74%, 92% { transform: scale(1.04, 0.94); }
}
@keyframes cat-head {
  0%, 53%, 68%, 100% { transform: none; }
  58%, 63% { transform: translate(4px, 4px) rotate(6deg); }
  74%, 92% { transform: translate(0, 3px) rotate(10deg); }
}
@keyframes cat-eyes-nap { 0%, 71%, 95%, 100% { transform: none; } 73%, 93% { transform: scaleY(0.05); } }
@keyframes cat-lids { 0%, 71%, 95%, 100% { opacity: 0; } 73%, 93% { opacity: 1; } }
@keyframes cat-zz {
  0%, 75% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  80% { opacity: 1; transform: translate(1px, -2px) scale(1); }
  86% { opacity: 0.7; transform: translate(3px, -5px) scale(1.15); }
  92%, 100% { opacity: 0; transform: translate(5px, -8px) scale(1.3); }
}
</style>
