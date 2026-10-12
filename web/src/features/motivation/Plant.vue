<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { animate } from '@/motion/animate';
import { spawnDroplets, spawnSparkle } from '@/motion/effects';
import { springs } from '@/motion/spring';
import type { ChangeKind, Mood } from './types';

/**
 * Cute SVG plant, 5 stages. Mood = gentle droop + desaturation (never brown, never dead).
 * Presentational: pass `change` (from the motivation store) to play water / grow / perk-up.
 */
const props = withDefaults(
  defineProps<{ stage: 0 | 1 | 2 | 3 | 4; mood?: Mood; size?: number; change?: { id: number; kinds: ChangeKind[] } | null; effects?: boolean }>(),
  { mood: 'happy', size: 32, change: null, effects: true },
);

const DROOP: Record<Mood, number> = { happy: 0, thirsty: 8, dry: 18, droopy: 30 };
const deg = computed(() => DROOP[props.mood]);
const svg = ref<SVGSVGElement | null>(null);
const plantG = ref<SVGGElement | null>(null);
const faceMouth = computed(() => (props.mood === 'happy' ? 'M44 83 Q50 88 56 83' : props.mood === 'thirsty' ? 'M45 85 Q50 87 55 85' : 'M45 86 L55 86'));
const sleepy = computed(() => props.mood === 'dry' || props.mood === 'droopy');

// leaves: [angle, y, length]
const LEAVES: Record<number, [number, number, number][]> = {
  0: [],
  1: [[-35, 58, 11], [35, 58, 11]],
  2: [[-40, 52, 13], [40, 52, 13], [-25, 41, 11], [25, 41, 11]],
  3: [[-45, 54, 15], [45, 54, 15], [-30, 42, 14], [30, 42, 14], [-18, 30, 11], [18, 30, 11]],
  4: [[-45, 54, 15], [45, 54, 15], [-30, 42, 14], [30, 42, 14], [-60, 34, 11], [60, 34, 11]],
};
const stemTop = computed(() => [68, 56, 40, 28, 24][props.stage]);
const leaves = computed(() => LEAVES[props.stage]);
const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];

let anims: Animation[] = [];
function track(a: Animation | null) {
  if (a) anims.push(a);
}
function pt(): { x: number; y: number } {
  const r = svg.value?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.45 } : { x: 0, y: 0 };
}

watch(
  () => props.mood,
  (now, was) => {
    if (!was || !plantG.value) return;
    // visual transition to the new droop. The CSS transform on the group equals the end state.
    track(animate(plantG.value, [{ transform: `rotate(${DROOP[was]}deg)` }, { transform: `rotate(${DROOP[now]}deg)` }], { spring: springs.gentle, reduced: 'skip' }));
  },
);

watch(
  () => props.change?.id,
  () => {
    const kinds = props.change?.kinds ?? [];
    if (!kinds.length || !props.effects) return;
    const g = plantG.value;
    const p = pt();
    if (kinds.includes('water')) {
      spawnDroplets({ x: p.x, y: p.y - 2 });
      track(animate(g, [{ transform: `rotate(${deg.value}deg) scale(1,0.94)` }, { transform: `rotate(${deg.value}deg) scale(1,1)` }], { spring: springs.pop, reduced: 'skip', delay: 380 }));
    }
    if (kinds.includes('perk-up')) {
      spawnSparkle({ x: p.x, y: p.y - 4 }, { kind: 'perk-up', count: 6, spread: 26, colors: ['#9be37a', '#ffe08a', '#ffffff'] });
      track(animate(g, [{ transform: `rotate(${deg.value + 14}deg)` }, { transform: `rotate(${deg.value}deg)` }], { spring: springs.gentle, reduced: 'skip' }));
    }
    if (kinds.includes('grow')) {
      spawnSparkle({ x: p.x, y: p.y - 6 }, { kind: 'grow', count: 8, spread: 30, colors: ['#9be37a', '#ffe08a', '#ffffff', '#5cc04a'] });
      track(animate(g, [{ transform: `rotate(${deg.value}deg) scale(0.7)` }, { transform: `rotate(${deg.value}deg) scale(1)` }], { spring: springs.gentle, reduced: 'skip' }));
    }
  },
);
onBeforeUnmount(() => {
  anims.forEach((a) => a.cancel());
  anims = [];
});
</script>

<template>
  <svg
    ref="svg"
    class="plant"
    viewBox="0 0 100 100"
    :width="size"
    :height="size"
    :data-stage="stage"
    :data-mood="mood"
    role="img"
    :aria-label="`Plant, stage ${stage + 1} of 5`"
  >
    <!-- plant (rotates about the soil line) -->
    <g ref="plantG" class="grow" :style="{ transform: `rotate(${deg}deg)` }">
      <template v-if="stage === 0">
        <ellipse cx="50" cy="66" rx="5" ry="3.4" class="seed" />
        <path d="M50 62.6 q-1 -3 1 -4" class="stem thin" />
      </template>
      <template v-else>
        <path :d="`M50 68 L50 ${stemTop}`" class="stem" />
        <g v-for="(l, i) in leaves" :key="i" :transform="`translate(50 ${l[1]}) rotate(${l[0] < 0 ? 180 + l[0] : l[0]})`">
          <ellipse :cx="l[2] * 0.62" cy="0" :rx="l[2] * 0.62" :ry="l[2] * 0.3" :class="i % 2 ? 'leaf leaf2' : 'leaf'" />
        </g>
        <g v-if="stage === 4" :transform="`translate(50 ${stemTop - 1})`" class="flower">
          <ellipse v-for="a in PETALS" :key="a" cx="0" cy="-8.5" rx="3.6" ry="6.4" :transform="`rotate(${a})`" class="petal" />
          <circle r="5" class="center" />
        </g>
        <g v-else-if="stage >= 1" :transform="`translate(50 ${stemTop})`">
          <circle r="2.2" class="bud" />
        </g>
      </template>
    </g>
    <!-- pot -->
    <path d="M30 68 H70 L66 94 Q65.6 96 63.6 96 H36.4 Q34.4 96 34 94 Z" class="pot" />
    <rect x="27" y="64" width="46" height="8" rx="4" class="rim" />
    <ellipse cx="50" cy="66" rx="19" ry="2" class="soil" />
    <g class="face">
      <ellipse v-if="!sleepy" cx="43" cy="79" rx="1.7" ry="2.1" /><ellipse v-if="!sleepy" cx="57" cy="79" rx="1.7" ry="2.1" />
      <path v-if="sleepy" d="M41 79 q2 1.6 4 0 M55 79 q2 1.6 4 0" class="lid" />
      <path :d="faceMouth" class="mouth" />
      <circle cx="39" cy="83" r="2.2" class="blush" /><circle cx="61" cy="83" r="2.2" class="blush" />
    </g>
  </svg>
</template>

<style scoped>
.plant { overflow: visible; display: block; transition: filter 600ms; }
.plant[data-mood='thirsty'] { filter: saturate(0.85); }
.plant[data-mood='dry'] { filter: saturate(0.65); }
.plant[data-mood='droopy'] { filter: saturate(0.5) opacity(0.92); }
.grow { transform-origin: 50px 68px; transform-box: view-box; transition: transform 500ms cubic-bezier(0.34, 1.4, 0.64, 1); }
.stem { stroke: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 22%, #2f8a34); stroke-width: 3.6; stroke-linecap: round; fill: none; }
.stem.thin { stroke-width: 2.4; }
.leaf { fill: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 14%, #5cc04a); }
.leaf2 { fill: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 14%, #3ea43f); }
.bud { fill: #8be06a; }
.seed { fill: #8a5a34; }
.petal { fill: var(--md-sys-color-tertiary, #b5486f); }
.center { fill: #ffc83d; }
.pot { fill: #d9915f; }
.rim { fill: #e8a574; }
.soil { fill: #5b3b25; }
.face { fill: #4a2c1a; stroke: none; }
.mouth, .lid { fill: none; stroke: #4a2c1a; stroke-width: 1.6; stroke-linecap: round; }
.blush { fill: #ff8f8f; opacity: 0.45; }
:global(html[data-motion='off'] .grow, html[data-motion='reduced'] .grow) { transition: none; }
</style>
