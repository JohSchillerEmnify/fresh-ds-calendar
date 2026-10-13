<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { animate } from '@/motion/animate';
import { spawnSparkle } from '@/motion/effects';
import { useAnimationLevel } from '@/motion/level';
import { springs } from '@/motion/spring';
import { SUNFLOWER_MAX, SUNFLOWER_MAX_PHONE, type ChangeKind, type Mood } from './types';

/**
 * Row of small sunflowers for the top bar background. One shared <symbol>, one <use> per flower.
 * Low contrast, never removed. Sway is pure CSS and only runs at Full + visible page.
 */
const props = withDefaults(defineProps<{ flowers: number; mood?: Mood; change?: { id: number; kinds: ChangeKind[] } | null }>(), {
  mood: 'happy',
  change: null,
});
const level = useAnimationLevel();
const phone = useMediaQuery('(max-width: 599px)');
const visible = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden');
const onVis = () => (visible.value = document.visibilityState !== 'hidden');
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVis);
  anims.forEach((a) => a.cancel());
});

const MAX = computed(() => (phone.value ? SUNFLOWER_MAX_PHONE : SUNFLOWER_MAX));
const shown = computed(() => Math.min(props.flowers, MAX.value));
const swaying = computed(() => level.value === 'full' && visible.value);
const label = computed(() => `Sunflower field: ${props.flowers} ${props.flowers === 1 ? 'flower' : 'flowers'}`);

const rand = (i: number, k: number) => {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const DROOP: Record<Mood, number> = { happy: 0, thirsty: 9, dry: 19, droopy: 32 };
const items = computed(() =>
  Array.from({ length: shown.value }, (_, i) => ({
    i,
    left: 3 + ((i * 0.618034) % 1) * 90,
    h: 30 + rand(i, 1) * 20,
    delay: -rand(i, 2) * 5,
    dur: 4.2 + rand(i, 3) * 2.4,
    sign: rand(i, 4) > 0.5 ? 1 : -1,
  })),
);

const root = ref<HTMLElement | null>(null);
let anims: Animation[] = [];

watch(
  () => props.mood,
  (now, was) => {
    if (!was || !root.value) return;
    root.value.querySelectorAll<SVGElement>('.sf-svg').forEach((el, idx) => {
      const sign = items.value[idx]?.sign ?? 1;
      const a = animate(el, [{ transform: `rotate(${DROOP[was] * sign}deg)` }, { transform: `rotate(${DROOP[now] * sign}deg)` }], { spring: springs.gentle, delay: idx * 30, reduced: 'skip' });
      if (a) anims.push(a);
    });
  },
);
watch(
  () => props.change?.id,
  async () => {
    const kinds = props.change?.kinds ?? [];
    if (!root.value || !(kinds.includes('bloom') || kinds.includes('perk-up'))) return;
    await nextTick(); // the new flower must be in the DOM
    if (!root.value) return;
    const els = root.value.querySelectorAll<SVGElement>('.sf-svg');
    if (kinds.includes('bloom')) {
      const el = els[Math.min(props.flowers, MAX.value) - 1];
      if (el) {
        const a = animate(el, [{ transform: `scale(0) rotate(${DROOP[props.mood]}deg)` }, { transform: `scale(1) rotate(${DROOP[props.mood]}deg)` }], { spring: springs.gentle, reduced: 'skip' });
        if (a) anims.push(a);
        const r = el.getBoundingClientRect();
        spawnSparkle({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 }, { kind: 'bloom', count: 8, spread: 26, colors: ['#ffc83d', '#ffe08a', '#ffffff'] });
      }
    }
    if (kinds.includes('perk-up') && els.length) {
      const r = root.value.getBoundingClientRect();
      spawnSparkle({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 }, { kind: 'perk-up', count: 6, spread: 26, colors: ['#9be37a', '#ffe08a', '#ffffff'] });
    }
  },
);
const petals = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
defineExpose({ root });
</script>

<template>
  <div
    ref="root"
    class="sff"
    data-testid="sunflower-field"
    role="img"
    :aria-label="label"
    :data-mood="mood"
    :data-count="shown"
    :data-sway="swaying ? 'on' : 'off'"
  >
    <svg class="sff-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <symbol id="mo-sunflower" viewBox="0 0 40 64">
        <path d="M20 64 V26" fill="none" stroke-width="2.6" stroke-linecap="round" style="stroke: var(--sf-stem)" />
        <path d="M20 50 Q9 48 6 40 Q16 40 20 48Z" style="fill: var(--sf-stem)" />
        <path d="M20 44 Q31 43 34 35 Q24 35 20 42Z" style="fill: var(--sf-stem)" />
        <g transform="translate(20 18)">
          <ellipse v-for="a in petals" :key="a" cx="0" cy="-9.5" rx="3.6" ry="7" :transform="`rotate(${a})`" style="fill: var(--sf-petal)" />
          <circle r="6.4" style="fill: var(--sf-center)" />
        </g>
      </symbol>
    </svg>
    <span
      v-for="f in items"
      :key="f.i"
      class="sf"
      data-testid="sunflower"
      data-part="sunflower"
      :style="{ left: f.left + '%', height: f.h + 'px', width: f.h * 0.625 + 'px', '--delay': f.delay + 's', '--dur': f.dur + 's', '--sign': f.sign }"
    >
      <svg class="sf-svg" viewBox="0 0 40 64" :style="{ transform: `rotate(${DROOP[mood] * f.sign}deg)` }"><use href="#mo-sunflower" /></svg>
    </span>
  </div>
</template>

<style scoped>
.sff { --sf-petal: color-mix(in oklab, var(--md-sys-color-tertiary, #b5486f) 22%, #f6b81c); --sf-center: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 45%, #7a4a1e); --sf-stem: color-mix(in oklab, var(--md-sys-color-primary, #386a20) 28%, #3f9a3a);
  position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: 0.4; transition: opacity 600ms, filter 600ms; }
.sff[data-mood='thirsty'] { filter: saturate(0.85); opacity: 0.32; }
.sff[data-mood='dry'] { filter: saturate(0.6); opacity: 0.28; }
.sff[data-mood='droopy'] { filter: saturate(0.4); opacity: 0.24; }
.sff-defs { position: absolute; }
.sf { position: absolute; bottom: -4px; transform-origin: 50% 100%; }
.sf-svg { width: 100%; height: 100%; display: block; transform-origin: 50% 100%; overflow: visible; transition: transform 700ms cubic-bezier(0.34, 1.3, 0.64, 1); }
.sff[data-sway='on'] .sf { animation: sff-sway var(--dur, 5s) ease-in-out var(--delay, 0s) infinite alternate; }
@keyframes sff-sway { from { rotate: -2.2deg; } to { rotate: 2.2deg; } }
:global(html[data-motion='off'] .sf-svg, html[data-motion='reduced'] .sf-svg) { transition: none; }
</style>
