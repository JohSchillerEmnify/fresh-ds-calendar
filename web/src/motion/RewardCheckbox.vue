<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useAnimationLevel } from './level';
import { animate } from './animate';
import { spawnSparkle } from './effects';
import { haptic } from './haptics';
import { springs } from './spring';

/**
 * Springy checkbox: SVG check draws itself, the label strikes through left to right, sparkles burst on tick.
 * `change` / `update:modelValue` are emitted synchronously from the native input; animation never delays state.
 */
const props = defineProps<{ modelValue: boolean; label?: string; disabled?: boolean; id?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; change: [v: boolean] }>();

const level = useAnimationLevel();
const animated = computed(() => level.value === 'full');
const box = ref<HTMLElement | null>(null);
let anims: Animation[] = [];

function onChange(e: Event) {
  const v = (e.target as HTMLInputElement).checked;
  emit('update:modelValue', v);
  emit('change', v);
  if (!v) return;
  haptic(8);
  if (level.value === 'off') return;
  const b = box.value;
  anims.forEach((a) => a.cancel());
  anims = [];
  const pop = animate(b, [{ transform: 'scale(0.78)' }, { transform: 'scale(1)' }], { spring: springs.pop });
  if (pop) anims.push(pop);
  // the mark is drawn by whichever glyph the theme shows; the others are display: none and ignore the animation
  if (level.value === 'full') {
    for (const p of b?.querySelectorAll<SVGPathElement>('.rcb-check') ?? []) {
      if (typeof p.animate === 'function') anims.push(p.animate([{ strokeDashoffset: 24 }, { strokeDashoffset: 0 }], { duration: 260, delay: 40, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'backwards' }));
    }
  }
  if (b) spawnSparkle(b);
}
onBeforeUnmount(() => anims.forEach((a) => a.cancel()));
</script>

<template>
  <label class="rcb" :class="{ 'is-checked': modelValue, 'is-anim': animated, 'is-disabled': disabled }" data-testid="reward-checkbox">
    <input :id="id" class="rcb-input" type="checkbox" :checked="modelValue" :disabled="disabled" @change="onChange" />
    <span ref="box" class="rcb-box" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24">
        <rect class="rcb-bg" x="3" y="3" width="18" height="18" rx="5.5" />
        <path class="rcb-check" data-glyph="tick" d="M7.5 12.5l3.3 3.3 6-7" pathLength="24" />
        <path class="rcb-check" data-glyph="bold" d="M7.5 12.5l3.3 3.3 6-7" pathLength="24" />
        <path class="rcb-check" data-glyph="cross" d="M8.5 8.5l7 7M15.5 8.5l-7 7" pathLength="24" />
        <path class="rcb-check" data-glyph="dot" d="M12 12h.01" pathLength="24" />
      </svg>
    </span>
    <span v-if="label !== undefined || $slots.default" class="rcb-label"><slot>{{ label }}</slot></span>
  </label>
</template>

<style scoped>
.rcb { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-height: 44px; position: relative; -webkit-tap-highlight-color: transparent; }
.rcb-input { position: absolute; opacity: 0; width: 44px; height: 44px; margin: 0; left: -8px; cursor: pointer; }
.rcb-box { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border-radius: 50%; position: relative; }
.rcb-input:focus-visible + .rcb-box { outline: 2px solid var(--md-sys-color-primary, #6750a4); outline-offset: 1px; }
.rcb-bg { rx: var(--cb-rx, 5.5px); fill: transparent; stroke: var(--md-sys-color-outline, #79747e); stroke-width: 2; }
.rcb-check { fill: none; stroke: var(--md-sys-color-on-primary, #fff); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 24; stroke-dashoffset: 24; }
.is-checked .rcb-bg { fill: var(--md-sys-color-primary, #6750a4); stroke: var(--md-sys-color-primary, #6750a4); }
.is-checked .rcb-check { stroke-dashoffset: 0; }
.rcb-check[data-glyph='bold'] { stroke-width: 3.8; }
.rcb-check[data-glyph='dot'] { stroke-width: 6; stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0; }
.is-checked .rcb-check[data-glyph='dot'] { opacity: 1; }
:global(html[data-checkfill='outline']) .is-checked .rcb-bg { fill: transparent; }
:global(html[data-checkfill='outline']) .is-checked .rcb-check { stroke: var(--md-sys-color-primary, #6750a4); }
.rcb-label { background: linear-gradient(currentColor, currentColor) no-repeat 0 58% / 0% 1.6px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.is-checked .rcb-label { background-size: 100% 1.6px; opacity: 0.6; }
.is-anim .rcb-bg { transition: fill 160ms ease-out, stroke 160ms ease-out; }
.is-anim .rcb-label { transition: background-size 280ms cubic-bezier(0.3, 0, 0.2, 1) 60ms, opacity 240ms ease-out 60ms; }
.is-disabled { opacity: 0.5; cursor: default; }
</style>
