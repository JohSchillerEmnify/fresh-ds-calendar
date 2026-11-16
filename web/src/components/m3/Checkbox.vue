<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAnimationLevel } from '@/motion/level';
import { useRewardTick } from '@/motion/reward';
import { onColor } from '@/api/colors';

/** The M3 checkbox (_md-comp-checkbox, material-web tokens v0.192): 18 px box, 2 px outline, 40 px state layer, 48 px
 * target; a user's tick plays the reward. Corner and mark follow the theme's checkbox choices; emits synchronously.
 * `color` replaces the primary colour of the ticked box (a calendar's colour). */
const props = defineProps<{ modelValue: boolean; label?: string; disabled?: boolean; id?: string; color?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; change: [v: boolean] }>();

const level = useAnimationLevel();
const animated = computed(() => level.value === 'full');
const box = ref<HTMLElement | null>(null);
const reward = useRewardTick();

function onChange(e: Event) {
  const v = (e.target as HTMLInputElement).checked;
  emit('update:modelValue', v);
  emit('change', v);
  if (v && !props.disabled) reward.play(box.value);
}
</script>

<template>
  <span class="cb" :class="{ 'is-checked': modelValue, 'is-anim': animated, 'is-disabled': disabled }" :style="color ? { '--cb-c': color, '--cb-on': onColor(color) } : undefined" :data-color="color">
    <span class="cb-layer" aria-hidden="true" />
    <span ref="box" class="cb-box" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24">
        <rect class="rcb-bg" x="4" y="4" width="16" height="16" rx="5.5" />
        <path class="rcb-check" data-glyph="tick" d="M7.5 12.5l3.3 3.3 6-7" pathLength="24" />
        <path class="rcb-check" data-glyph="bold" d="M7.5 12.5l3.3 3.3 6-7" pathLength="24" />
        <path class="rcb-check" data-glyph="cross" d="M8.5 8.5l7 7M15.5 8.5l-7 7" pathLength="24" />
        <path class="rcb-check" data-glyph="dot" d="M12 12h.01" pathLength="24" />
      </svg>
    </span>
    <input :id="id" class="cb-in" type="checkbox" :checked="modelValue" :disabled="disabled" :aria-label="label" @change="onChange" />
  </span>
</template>

<style scoped>
.cb {
  --h: calc(40px + var(--md-density-shift)); position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px;
  color: var(--md-sys-color-on-surface); -webkit-tap-highlight-color: transparent;
}
.cb.is-checked { color: var(--cb-c, var(--md-sys-color-primary)); }
/* the state layer (40 px at Comfortable, moved by the density shift): hover 8 %, focus and press 10 % (the kit's v-ripple values) */
.cb-layer { position: absolute; width: var(--h); height: var(--h); border-radius: var(--md-sys-shape-corner-full); background: currentColor; opacity: 0; pointer-events: none; transition: opacity var(--md-sys-motion-duration-short); }
@media (hover: hover) { .cb:hover:not(.is-disabled) .cb-layer { opacity: 0.08; } }
.cb:has(.cb-in:focus-visible) .cb-layer, .cb:active:not(.is-disabled) .cb-layer { opacity: 0.1; }
.cb:has(.cb-in:focus-visible) .cb-box { outline: 2px solid var(--md-sys-color-primary); outline-offset: 1px; border-radius: 4px; }
.cb-box { display: inline-flex; width: 24px; height: 24px; pointer-events: none; }
/* the whole 48 px square takes the tap */
.cb-in { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.cb-in:focus-visible { outline: 0; }
/* rx is the stroke's centre line: the outer corner is rx + 1 px */
.rcb-bg { rx: calc(var(--cb-rx, 5.5px) - 1px); fill: transparent; stroke: var(--md-sys-color-on-surface-variant); stroke-width: 2; }
.rcb-check { fill: none; stroke: var(--cb-on, var(--md-sys-color-on-primary)); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 24; stroke-dashoffset: 24; }
.is-checked .rcb-bg { fill: var(--cb-c, var(--md-sys-color-primary)); stroke: var(--cb-c, var(--md-sys-color-primary)); }
.is-checked .rcb-check { stroke-dashoffset: 0; }
.rcb-check[data-glyph='bold'] { stroke-width: 3.8; }
.rcb-check[data-glyph='dot'] { stroke-width: 6; stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0; }
.is-checked .rcb-check[data-glyph='dot'] { opacity: 1; }
:global(html[data-checkfill='outline']) .is-checked .rcb-bg { fill: transparent; }
:global(html[data-checkfill='outline']) .is-checked .rcb-check { stroke: var(--cb-c, var(--md-sys-color-primary)); }
.is-anim .rcb-bg { transition: fill 160ms ease-out, stroke 160ms ease-out; }
.is-disabled { opacity: 0.38; }
.is-disabled .cb-in { cursor: default; }
</style>
