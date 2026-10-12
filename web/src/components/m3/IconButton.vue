<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

defineProps<{ label: string; variant?: 'standard' | 'tonal' | 'filled'; pressed?: boolean; disabled?: boolean }>();
</script>

<template>
  <button v-ripple class="icon-btn" :class="variant ?? 'standard'" type="button" :aria-label="label" :title="label" :aria-pressed="pressed" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  width: 44px; height: 44px; border-radius: var(--md-sys-shape-corner-full); flex: none;
  display: inline-flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface-variant);
}
.icon-btn :deep(svg) { width: 24px; height: 24px; }
.tonal { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.filled { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.icon-btn[aria-pressed='true'] { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.icon-btn:disabled { opacity: 0.38; }
</style>
