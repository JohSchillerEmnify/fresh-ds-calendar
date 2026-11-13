<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

// `pressed` stays undefined unless given: a plain button must not announce itself as a toggle
withDefaults(defineProps<{ label: string; variant?: 'standard' | 'tonal' | 'filled'; pressed?: boolean; disabled?: boolean }>(), { pressed: undefined });
</script>

<template>
  <button v-ripple class="icon-btn" :class="variant ?? 'standard'" type="button" :aria-label="label" :title="label" :aria-pressed="pressed" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
/* 40 px drawn (_md-comp-icon-button state-layer-size) in a 48 px tap area (material-web iconbutton touch target): the
   transparent border is tappable, while the background, state layer and ripple stop at the 40 px padding box */
.icon-btn {
  position: relative; width: 48px; height: 48px; border: 4px solid transparent; background-clip: padding-box; border-radius: var(--md-sys-shape-corner-full); flex: none;
  display: inline-flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface-variant);
}
.icon-btn :deep(svg) { width: 24px; height: 24px; }
.tonal { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.filled { background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.icon-btn[aria-pressed='true'] { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.icon-btn:disabled { opacity: 0.38; }
</style>
