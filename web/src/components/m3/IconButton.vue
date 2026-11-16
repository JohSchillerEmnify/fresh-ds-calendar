<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

// `pressed` stays undefined unless given: a plain button must not announce itself as a toggle
withDefaults(defineProps<{ label: string; variant?: 'standard' | 'tonal' | 'filled' | 'outlined'; pressed?: boolean; disabled?: boolean }>(), { pressed: undefined });
</script>

<template>
  <button v-ripple class="icon-btn" :class="variant ?? 'standard'" type="button" :aria-label="label" :title="label" :aria-pressed="pressed" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
/* 40 px drawn at Comfortable (_md-comp-icon-button state-layer-size, moved by the density shift) in a 48 px tap area
   (material-web iconbutton touch target): the transparent border is tappable, while the background, state layer and
   ripple stop at the drawn padding box */
.icon-btn {
  --h: calc(40px + var(--md-density-shift)); --tap: max(0px, calc((48px - var(--h)) / 2));
  position: relative; width: calc(var(--h) + 2 * var(--tap)); height: calc(var(--h) + 2 * var(--tap)); border: var(--tap) solid transparent; background-clip: padding-box; border-radius: var(--md-sys-shape-corner-full); flex: none;
  display: inline-flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface-variant);
}
.icon-btn :deep(svg) { width: 24px; height: 24px; }
.tonal { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.filled { background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
/* outlined sits on a solid surface so a scene behind never shows through */
.outlined { background-color: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); box-shadow: inset 0 0 0 1px var(--md-sys-color-outline); }
.icon-btn[aria-pressed='true'] { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.icon-btn:disabled { opacity: 0.38; }
</style>
