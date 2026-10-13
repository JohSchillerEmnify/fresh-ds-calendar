<script setup lang="ts">
/**
 * The Halloween moon (`data-part="moon"`): a big round moon with a soft halo and a few craters, half behind thin
 * clouds that drift slowly past (Full), very slowly (Reduced) or not at all (Off). Colours come from the theme
 * tokens; at dusk (light themes) the moon is paler, at night (dark themes) it glows.
 */
</script>

<template>
  <svg class="moon" data-part="moon" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
    <circle class="halo h2" cx="34" cy="19" r="17" />
    <circle class="halo h1" cx="34" cy="19" r="12.500" />
    <circle class="disc" cx="34" cy="19" r="9.500" />
    <path class="shade" d="M38.500 10.700 A9.500 9.500 0 0 1 34 28.500 A11 11 0 0 0 38.500 10.700 Z" />
    <circle class="crater" cx="30.500" cy="15.500" r="2.200" />
    <circle class="crater" cx="37" cy="22.500" r="1.600" />
    <circle class="crater" cx="31.500" cy="23" r="1" />
    <circle class="crater" cx="37.500" cy="14.500" r="0.800" />
    <g class="clouds">
      <path class="cloud c1" d="M14 26 C14 23.600 16.800 22.600 18.600 23.600 C19.600 21.400 23.600 21 25.200 23.200 C27 22 30.600 22.600 31 25 C34 24.600 36.600 25.400 37 27 L14.600 27.400 C13.800 27.200 13.700 26.600 14 26 Z" />
      <path class="cloud c2" d="M36 15.600 C36.400 14 38.400 13.400 39.800 14.200 C40.800 12.600 44 12.600 45 14.400 C47 13.800 49.600 14.600 50 16.400 L36.400 16.600 Z" />
      <path class="wisp" d="M8 30.500 L30 30.500 M40 31.800 L58 31.800 M44 19.400 L56 19.400" />
    </g>
  </svg>
</template>

<style scoped>
.moon {
  --moon: color-mix(in oklab, #fff3c4 84%, var(--md-sys-color-primary, #e8650c));
  --cloud: color-mix(in oklab, var(--md-sys-color-surface, #fff8f5) 62%, #7e72a8);
  display: block; overflow: visible;
}
.halo { fill: var(--moon); }
.h1 { opacity: 0.22; }
.h2 { opacity: 0.1; }
.disc { fill: var(--moon); }
.shade { fill: color-mix(in oklab, var(--moon) 80%, var(--md-sys-color-primary, #e8650c)); opacity: 0.5; }
.crater { fill: color-mix(in oklab, var(--moon) 78%, #8a7d5c); opacity: 0.55; }
.cloud { fill: var(--cloud); opacity: 0.82; }
.wisp { fill: none; stroke: var(--cloud); stroke-width: 1.200; stroke-linecap: round; opacity: 0.6; }
/* dusk: a paler moon; night: a brighter halo */
html[data-theme='light'] .moon { --moon: color-mix(in oklab, #ffe9a3 80%, var(--md-sys-color-primary, #e8650c)); }
html[data-theme='light'] .disc { stroke: color-mix(in oklab, var(--moon) 70%, var(--md-sys-color-primary, #e8650c)); stroke-width: 0.600; }
html[data-theme='dark'] .h1 { opacity: 0.3; }
html[data-theme='dark'] .h2 { opacity: 0.14; }
.clouds { animation: moon-clouds 38s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .clouds { animation-play-state: running; }
html[data-motion='reduced'] .clouds { animation-play-state: running; animation-duration: 90s; }
.h1 { animation: moon-halo 7s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .h1 { animation-play-state: running; }
@keyframes moon-clouds { from { transform: translateX(-5px); } to { transform: translateX(7px); } }
@keyframes moon-halo { from { opacity: 0.16; } to { opacity: 0.32; } }
</style>
