<script setup lang="ts">
import { computed } from 'vue';
import { useAnimationLevel } from './level';

/** Circular progress. Give either `value` (0..1) or `done` + `total`. */
const props = withDefaults(
  defineProps<{ value?: number; done?: number; total?: number; size?: number; stroke?: number; testid?: string }>(),
  { size: 28, stroke: 3.5, testid: 'tasklist-progress-ring' },
);
const level = useAnimationLevel();
const frac = computed(() => {
  const f = props.value ?? (props.total ? (props.done ?? 0) / props.total : 0);
  return Math.min(1, Math.max(0, f));
});
const percent = computed(() => Math.round(frac.value * 100));
const r = computed(() => (props.size - props.stroke) / 2);
const c = computed(() => 2 * Math.PI * r.value);
</script>

<template>
  <span
    class="pring"
    :class="{ 'is-anim': level === 'full', 'is-full': percent === 100 }"
    :data-testid="testid"
    :data-percent="percent"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size">
      <circle class="track" :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="stroke" />
      <circle
        class="bar"
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        :stroke-width="stroke"
        :stroke-dasharray="c"
        :stroke-dashoffset="c * (1 - frac)"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
  </span>
</template>

<style scoped>
.pring { display: inline-flex; flex: none; }
.track { fill: none; stroke: var(--md-sys-color-surface-container-highest, #e6e0e9); }
.bar { fill: none; stroke: var(--md-sys-color-primary, #6750a4); stroke-linecap: round; }
.is-full .bar { stroke: var(--md-sys-color-tertiary, #7d5260); }
.is-anim .bar { transition: stroke-dashoffset 480ms cubic-bezier(0.3, 0, 0.2, 1), stroke 300ms; }
</style>
