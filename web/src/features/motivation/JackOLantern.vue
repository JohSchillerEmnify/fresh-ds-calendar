<script setup lang="ts">
/**
 * A pumpkin on the ground of the Halloween scene. Carved (`data-part="jack-o-lantern"`) it has a friendly face with a
 * candle inside: the face and a warm halo flicker softly at Full, breathe slowly at Reduced and glow steadily at Off.
 * Uncarved (`carved=false`, `data-part="pumpkin"`) it is the plain pumpkin the cat sits next to. `face` picks one of
 * two faces and `delay` (seconds) shifts the flicker so lanterns do not flicker in step. Colours from the theme tokens.
 */
withDefaults(defineProps<{ carved?: boolean; face?: 'smile' | 'grin'; delay?: number }>(), { carved: true, face: 'smile', delay: 0 });
</script>

<template>
  <span class="jol" :data-part="carved ? 'jack-o-lantern' : 'pumpkin'" :style="{ '--jol-delay': `${-delay}s` }" aria-hidden="true">
    <i v-if="carved" class="halo" />
    <svg viewBox="0 0 40 34" focusable="false">
      <path class="vine" d="M21.500 6 C24 3.600 27.400 4.600 27 7 C26.700 8.600 24.600 8.200 25.400 6.800" />
      <path class="stem" d="M18.600 7.400 C18.400 4.600 19 2.200 21.600 1.400 L22.400 2.800 C21 3.600 20.900 5.400 21.200 7.400 Z" />
      <ellipse class="lobe" cx="12.500" cy="20.500" rx="10.500" ry="11.800" />
      <ellipse class="lobe" cx="27.500" cy="20.500" rx="10.500" ry="11.800" />
      <ellipse class="lobe mid" cx="20" cy="20.200" rx="9" ry="13" />
      <path class="rib" d="M14.600 9.200 C11.600 14 11.600 26 14.600 31.600 M25.400 9.200 C28.400 14 28.400 26 25.400 31.600" />
      <path class="shine" d="M7 15 C6.200 17.500 6.200 20.500 7 23" />
      <g v-if="carved" class="face">
        <g class="cut">
          <template v-if="face === 'smile'">
            <path d="M11.400 18.400 L14.200 13.600 L17 18.400 Z M23 18.400 L25.800 13.600 L28.600 18.400 Z" />
            <path d="M18.600 21.800 L20 19.800 L21.400 21.800 Z" />
            <path d="M10.400 22.800 C13 28.600 27 28.600 29.600 22.800 C27.600 24 26 24.300 25 24.300 L24.200 25.600 L23 24.400 L17 24.400 L15.800 25.600 L15 24.300 C14 24.300 12.400 24 10.400 22.800 Z" />
          </template>
          <template v-else>
            <path d="M11.200 15 L17.200 16.400 L13.400 19.400 Z M28.800 15 L22.800 16.400 L26.600 19.400 Z" />
            <path d="M11.400 22.600 L13.600 23.800 L15 22.600 L16.800 24.200 L18.600 22.800 L20 24.600 L21.400 22.800 L23.200 24.200 L25 22.600 L26.400 23.800 L28.600 22.600 C27 28.400 13 28.400 11.400 22.600 Z" />
          </template>
        </g>
        <g class="flame">
          <template v-if="face === 'smile'">
            <path d="M12.600 18 L14.200 15.200 L15.800 18 Z M24.200 18 L25.800 15.200 L27.400 18 Z" />
            <path d="M12.600 24.600 C15.600 27.200 24.400 27.200 27.400 24.600 C26.400 25 25.400 25.200 24.800 25.200 L24.200 26.200 L23.200 25.200 L16.800 25.200 L15.800 26.200 L15.200 25.200 C14.600 25.200 13.600 25 12.600 24.600 Z" />
          </template>
          <template v-else>
            <path d="M13 16 L15.800 16.800 L13.900 18.300 Z M27 16 L24.200 16.800 L26.100 18.300 Z" />
            <path d="M13.400 24.400 C15.600 27.200 24.400 27.200 26.600 24.400 L25 24.600 L23.200 25.400 L20 25.600 L16.800 25.400 L15 24.600 Z" />
          </template>
        </g>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.jol {
  --pumpkin: color-mix(in oklab, #f57c00 72%, var(--md-sys-color-primary, #e8650c));
  --pumpkin-deep: color-mix(in oklab, var(--pumpkin) 62%, #6b1d00);
  --candle: color-mix(in oklab, #ffd75e 88%, var(--md-sys-color-primary, #e8650c));
  position: absolute; bottom: 0; display: block; aspect-ratio: 40 / 34;
}
.jol svg { position: relative; display: block; width: 100%; height: 100%; overflow: visible; }
.halo {
  position: absolute; left: -45%; right: -45%; top: -30%; bottom: -25%; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--candle) var(--halo-a, 60%), transparent), transparent);
  opacity: 0.6; animation: jol-halo 2.300s ease-in-out var(--jol-delay) infinite alternate; animation-play-state: paused;
}
html[data-theme='light'] .halo { --halo-a: 38%; }
.lobe { fill: var(--pumpkin); stroke: var(--pumpkin-deep); stroke-width: 0.800; }
.mid { fill: color-mix(in oklab, var(--pumpkin) 88%, #fff); }
.rib { fill: none; stroke: var(--pumpkin-deep); stroke-width: 0.800; stroke-linecap: round; opacity: 0.7; }
.shine { fill: none; stroke: color-mix(in oklab, #fff 70%, var(--pumpkin)); stroke-width: 1.300; stroke-linecap: round; opacity: 0.5; }
.stem { fill: color-mix(in oklab, #5d7a2a 70%, var(--md-sys-color-on-surface, #231917)); }
.vine { fill: none; stroke: color-mix(in oklab, #6f9a35 70%, var(--md-sys-color-on-surface, #231917)); stroke-width: 0.700; stroke-linecap: round; }
.cut { fill: color-mix(in oklab, #4a1400 82%, var(--pumpkin)); }
.flame { fill: var(--candle); animation: jol-flicker 1.700s steps(1, end) var(--jol-delay) infinite; animation-play-state: paused; }
html[data-motion='full'] :is(.halo, .flame) { animation-play-state: running; }
html[data-motion='reduced'] :is(.halo, .flame) { animation: jol-breathe 5s ease-in-out var(--jol-delay) infinite alternate; }
/* an irregular candle: mostly bright, now and then a dip */
@keyframes jol-flicker {
  0% { opacity: 1; } 12% { opacity: 0.82; } 18% { opacity: 1; } 41% { opacity: 0.9; } 47% { opacity: 0.7; }
  52% { opacity: 0.95; } 71% { opacity: 1; } 83% { opacity: 0.78; } 90% { opacity: 1; }
}
@keyframes jol-halo { from { opacity: 0.45; transform: scale(0.94); } to { opacity: 0.7; transform: scale(1.04); } }
@keyframes jol-breathe { from { opacity: 0.7; } to { opacity: 1; } }
</style>
