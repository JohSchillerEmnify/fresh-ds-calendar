<script setup lang="ts">
/**
 * The grass along the bottom of the spring scene with the first flowers of the year in it: crocuses, daisies and
 * snowdrops. Grass and flowers nod in the breeze at Full, gently at Reduced, and are still at Off.
 */
type Kind = 'crocus' | 'daisy' | 'snowdrop';
const FLOWERS: { kind: Kind; left: number; delay: number }[] = [
  { kind: 'crocus', left: 13, delay: 0 }, { kind: 'daisy', left: 30, delay: -1.1 }, { kind: 'snowdrop', left: 38, delay: -0.4 },
  { kind: 'crocus', left: 52, delay: -2 }, { kind: 'daisy', left: 58, delay: -0.7 }, { kind: 'snowdrop', left: 77, delay: -1.6 },
  { kind: 'crocus', left: 93, delay: -1.3 }, { kind: 'daisy', left: 97, delay: -2.4 },
];
// one blade every 4 units across a 400-wide strip, with a little irregularity
const BLADES = Array.from({ length: 100 }, (_, i) => {
  const x = i * 4 + ((i * 7) % 3);
  const h = 5 + ((i * 13) % 7);
  const lean = ((i * 5) % 5) - 2;
  return `M${x} 14 Q${x + lean * 0.5} ${14 - h * 0.6} ${x + lean} ${14 - h}`;
}).join(' ');
</script>

<template>
  <div class="meadow" aria-hidden="true">
    <svg class="grass" viewBox="0 0 400 14" preserveAspectRatio="none" focusable="false"><path :d="BLADES" /></svg>
    <span v-for="(f, i) in FLOWERS" :key="i" class="flower" :class="f.kind" data-part="first-flower" :data-kind="f.kind" :style="{ left: `${f.left}%`, animationDelay: `${f.delay}s` }">
      <svg viewBox="0 0 12 20" focusable="false">
        <path class="stem" d="M6 20 C6 16 6.300 12 6 9" />
        <template v-if="f.kind === 'crocus'">
          <path class="leafy" d="M6 20 C4 16 4 13 4.500 11 M6 20 C8 16 8 13 7.500 11" />
          <path class="petal" d="M6 10 C3.200 9.500 2.800 5.500 3.600 3.200 C4.600 4.600 5.200 4.200 6 2.400 C6.800 4.200 7.400 4.600 8.400 3.200 C9.200 5.500 8.800 9.500 6 10 Z" />
          <path class="mark" d="M6 9 L6 5.200" />
        </template>
        <template v-else-if="f.kind === 'daisy'">
          <ellipse v-for="a in [0, 45, 90, 135, 180, 225, 270, 315]" :key="a" class="ray" cx="6" cy="3.400" rx="1" ry="2.300" :transform="`rotate(${a} 6 6.200)`" />
          <circle class="eye" cx="6" cy="6.200" r="1.500" />
        </template>
        <template v-else>
          <path class="stem" d="M6 9 C6.500 7 8 6.400 9 7" />
          <path class="drop" d="M9 7.200 C7.600 7.400 7.400 10.200 9 12 C10.600 10.200 10.400 7.400 9 7.200 Z" />
          <path class="tip" d="M8.400 11.300 L9 12 L9.600 11.300" />
        </template>
      </svg>
    </span>
  </div>
</template>

<style scoped>
.meadow {
  --grass: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 30%, #5fae45);
  position: absolute; inset: 0; pointer-events: none;
}
.grass { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 12px; }
.grass path { fill: none; stroke: var(--grass); stroke-width: 1.100; stroke-linecap: round; vector-effect: non-scaling-stroke; opacity: 0.85; }
.flower { position: absolute; bottom: 1px; width: 10px; height: 17px; transform-origin: 50% 100%; animation: meadow-nod 3.400s ease-in-out infinite alternate; animation-play-state: paused; }
.flower svg { display: block; width: 100%; height: 100%; overflow: visible; }
html[data-motion='full'] .flower { animation-play-state: running; }
html[data-motion='reduced'] .flower { animation-play-state: running; animation-duration: 6s; }
.stem, .leafy, .mark, .tip { fill: none; stroke: var(--grass); stroke-width: 0.900; stroke-linecap: round; }
.crocus .petal { fill: color-mix(in oklab, var(--md-sys-color-tertiary, #b5486f) 35%, #a77bdc); }
.crocus .mark { stroke: color-mix(in oklab, #fff 70%, transparent); stroke-width: 0.500; }
.daisy .ray, .snowdrop .drop { fill: color-mix(in oklab, #fff 92%, var(--md-sys-color-primary-container, #e8f5e0)); stroke: color-mix(in oklab, var(--md-sys-color-outline, #79747e) 45%, transparent); stroke-width: 0.300; }
.daisy .eye { fill: #f6c21c; }
@keyframes meadow-nod { from { rotate: -5deg; } to { rotate: 5deg; } }
@container (max-width: 520px) { .flower:nth-child(3n) { display: none; } }
</style>
