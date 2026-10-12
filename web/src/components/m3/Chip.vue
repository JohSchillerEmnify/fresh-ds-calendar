<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

defineProps<{ selected?: boolean; variant?: 'filter' | 'assist' }>();
</script>

<template>
  <button v-ripple class="chip" :class="[variant ?? 'filter', { selected }]" type="button" :aria-pressed="variant === 'assist' ? undefined : !!selected">
    <span v-if="$slots.leading" class="lead"><slot name="leading" /></span>
    <span class="txt"><slot /></span>
  </button>
</template>

<style scoped>
.chip {
  position: relative; flex: none; height: 36px; padding: 0 14px; border-radius: var(--md-sys-shape-corner-small);
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  border: 1px solid var(--md-sys-color-outline); color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large);
  transition: background var(--md-sys-motion-duration-short), border-radius var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.chip::after { content: ''; position: absolute; inset: -4px 0; }
.chip.selected { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); border-color: transparent; border-radius: var(--md-sys-shape-corner-medium); }
.lead { display: inline-flex; align-items: center; }
.lead :deep(svg) { width: 18px; height: 18px; }
.txt { overflow: hidden; text-overflow: ellipsis; }
</style>
