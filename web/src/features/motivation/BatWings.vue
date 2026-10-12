<script setup lang="ts">
/**
 * A small, friendly bat: the Halloween scene's visitor in place of the butterfly (`SceneLife.vue`). Round body,
 * pointy ears, big bright eyes and scalloped wings that beat from the shoulders. Colours come from the theme tokens;
 * on dark themes a faint rim light keeps the dark body readable. Wings beat fast at Full, slowly at Reduced, not at Off.
 */
</script>

<template>
  <svg class="batfig" viewBox="0 0 32 22" width="32" height="22" aria-hidden="true" focusable="false">
    <g class="wing wl">
      <path d="M13 10 C10 5.500 5.500 4 1 6.500 C2.600 7.600 3.200 9.400 2.800 11.400 C4.500 10.400 6.400 10.700 7.300 12.600 C8.600 11.300 10.600 11.300 12.400 12.800 Z" />
      <path class="bone" d="M12.400 10.500 L7.300 12.300 M12.400 10.500 L2.900 11.200 M12.400 10.500 L4.500 6.400" />
    </g>
    <g class="wing wr">
      <path d="M19 10 C22 5.500 26.500 4 31 6.500 C29.400 7.600 28.800 9.400 29.200 11.400 C27.500 10.400 25.600 10.700 24.700 12.600 C23.400 11.300 21.400 11.300 19.600 12.800 Z" />
      <path class="bone" d="M19.600 10.500 L24.700 12.300 M19.600 10.500 L29.100 11.200 M19.600 10.500 L27.500 6.400" />
    </g>
    <path class="body" d="M12.600 6.200 L13.200 2.200 L15 4.600 L17 4.600 L18.800 2.200 L19.400 6.200 C21.200 7.600 21 12 19.400 14.400 C18 16.600 14 16.600 12.600 14.400 C11 12 10.800 7.600 12.600 6.200 Z" />
    <path class="ear-in" d="M13.500 5.200 L13.800 3.300 L14.700 4.700 Z M18.500 5.200 L18.200 3.300 L17.300 4.700 Z" />
    <circle class="eye" cx="14.400" cy="7.600" r="1.350" /><circle class="eye" cx="17.600" cy="7.600" r="1.350" />
    <circle class="pupil" cx="14.600" cy="7.800" r="0.650" /><circle class="pupil" cx="17.800" cy="7.800" r="0.650" />
    <path class="fang" d="M15.200 10 L15.500 11 L15.800 10 Z M16.200 10 L16.500 11 L16.800 10 Z" />
    <path class="smile" d="M15 9.800 Q16 10.500 17 9.800" />
    <circle class="blush" cx="13.300" cy="9.600" r="0.800" /><circle class="blush" cx="18.700" cy="9.600" r="0.800" />
  </svg>
</template>

<style scoped>
.batfig {
  --bat-fur: color-mix(in oklab, var(--md-sys-color-scrim, #000) 78%, var(--md-sys-color-tertiary, #7d5260));
  --bat-wing: color-mix(in oklab, var(--bat-fur) 88%, var(--md-sys-color-primary, #e8650c));
  display: block; overflow: visible;
}
html[data-theme='dark'] .batfig { filter: drop-shadow(0 0 1px color-mix(in oklab, var(--md-sys-color-primary, #ffb68c) 70%, transparent)); }
.wing { fill: var(--bat-wing); transform-box: view-box; animation: bat-beat 0.18s ease-in-out infinite alternate; }
.wl { transform-origin: 13px 10px; }
.wr { transform-origin: 19px 10px; }
.bone { fill: none; stroke: color-mix(in oklab, var(--bat-fur) 70%, #fff); stroke-width: 0.350; stroke-linecap: round; opacity: 0.6; }
.body { fill: var(--bat-fur); }
.ear-in, .blush { fill: color-mix(in oklab, #ff8fb1 75%, var(--md-sys-color-tertiary, #7d5260)); }
.blush { opacity: 0.55; }
.eye { fill: color-mix(in oklab, #ffd54a 90%, var(--md-sys-color-primary, #e8650c)); }
.pupil { fill: var(--md-sys-color-scrim, #000); }
.fang { fill: #fff; }
.smile { fill: none; stroke: color-mix(in oklab, var(--bat-fur) 45%, #fff); stroke-width: 0.400; stroke-linecap: round; }
html[data-motion='reduced'] .wing { animation-duration: 0.8s; }
html[data-motion='off'] .wing { animation: none; }
/* the wings fold down and sweep up from the shoulders */
@keyframes bat-beat { from { transform: scaleY(1); } to { transform: scaleY(-0.55); } }
</style>
