<script setup lang="ts">
/**
 * A bare, gnarled Halloween tree (`data-part="bare-tree"`): a twisted trunk with roots, crooked branches that end in
 * little curls, and a hollow from which two small eyes peek and blink now and then. A dark silhouette from the theme
 * tokens; on dark themes a faint moonlit rim keeps it readable. The branches sway a little at Full, the eyes blink at
 * Full and Reduced, Off is still. `mirrored` flips it so trees at both ends lean inwards.
 */
withDefaults(defineProps<{ mirrored?: boolean; eyes?: boolean }>(), { mirrored: false, eyes: false });
</script>

<template>
  <svg class="baretree" :class="{ mirrored }" data-part="bare-tree" viewBox="0 0 60 64" aria-hidden="true" focusable="false">
    <g class="crown">
      <path class="br b1" d="M26 40 C20 36 14 34 10 28 C8 24.500 8.500 21 5.500 17.500" />
      <path class="br b2" d="M11.500 30.500 C9 31 6 33.500 2.500 32.500" />
      <path class="br b3" d="M8.400 23.500 C10.400 20.500 10 17.500 12.400 15" />
      <path class="br b4" d="M5.500 17.500 C3.400 15.400 4.200 12.200 6.600 13.200" />
      <path class="br b1" d="M30.500 34 C36 30 42 30.500 46.500 24.500 C49.500 20.500 48.500 16.500 52 13" />
      <path class="br b2" d="M42 29 C46 29.500 50 33 54.500 31.600" />
      <path class="br b3" d="M48 22 C46.200 19 47.200 15.400 45 12.400" />
      <path class="br b4" d="M52 13 C54.200 10.800 57.400 12 56.400 14.800" />
      <path class="br b2" d="M28.400 21 C27.400 15 30.400 11 28.400 6 C27.600 3.800 29 1.600 31.400 1.600" />
      <path class="br b3" d="M28.600 12.500 C25 9.500 22.400 9.600 20.200 6.400" />
      <path class="br b4" d="M29.200 9 C32 7 35 8 37.400 5" />
    </g>
    <path class="trunk" d="M17 64 C21 62.500 23.800 60.500 24.600 57 C25.600 52 26.800 46.500 25.800 41 C25 37 22.600 33.600 23.600 29 C24.400 25.400 27 23.600 27.200 20 L29.800 20 C30 24.600 28.200 27.600 29 32 C29.800 36.400 32.600 40 32.800 46 C33 51 33.400 56 35.600 59 C37 61.200 40 62.800 43 64 Z" />
    <path class="bark" d="M27.400 50 C28 47 27.600 44 26.800 42 M30.600 54 C30.200 51.600 30.400 49.600 31 48 M27 33 C26.600 30.600 27.200 28.600 28 27" />
    <ellipse class="hollow" cx="29.300" cy="45" rx="1.900" ry="2.700" />
    <g v-if="eyes" class="peek"><circle cx="28.600" cy="44.600" r="0.550" /><circle cx="30" cy="44.600" r="0.550" /></g>
  </svg>
</template>

<style scoped>
.baretree {
  --tree: color-mix(in oklab, var(--md-sys-color-scrim, #000) 74%, var(--md-sys-color-primary, #e8650c));
  display: block; overflow: visible;
}
.mirrored { transform: scaleX(-1); }
html[data-theme='dark'] .baretree {
  --tree: color-mix(in oklab, var(--md-sys-color-scrim, #000) 82%, var(--md-sys-color-tertiary, #7d5260));
  filter: drop-shadow(0 0 0.8px color-mix(in oklab, var(--md-sys-color-on-surface, #f1dfd7) 60%, transparent));
}
.trunk { fill: var(--tree); }
.br { fill: none; stroke: var(--tree); stroke-linecap: round; stroke-linejoin: round; }
.b1 { stroke-width: 3; }
.b2 { stroke-width: 1.800; }
.b3 { stroke-width: 1.200; }
.b4 { stroke-width: 0.900; }
.bark { fill: none; stroke: color-mix(in oklab, var(--tree) 78%, #fff); stroke-width: 0.500; stroke-linecap: round; opacity: 0.55; }
.hollow { fill: color-mix(in oklab, var(--tree) 55%, #000); }
.peek { fill: color-mix(in oklab, #ffd54a 90%, var(--md-sys-color-primary, #e8650c)); transform-box: view-box; transform-origin: 29.300px 44.600px; animation: tree-peek 7.300s linear infinite; animation-play-state: paused; }
html:is([data-motion='full'], [data-motion='reduced']) .peek { animation-play-state: running; }
.crown { transform-box: view-box; transform-origin: 28px 40px; animation: tree-sway 6.500s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .crown { animation-play-state: running; }
@keyframes tree-sway { from { transform: rotate(-1.200deg); } to { transform: rotate(1.200deg); } }
@keyframes tree-peek { 0%, 44%, 50%, 100% { transform: scaleY(1); } 47% { transform: scaleY(0.1); } }
</style>
