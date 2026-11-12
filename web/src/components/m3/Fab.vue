<script setup lang="ts">
import { vRipple } from '@/lib/ripple';

defineProps<{ label: string; expanded?: boolean }>();
</script>

<template>
  <button v-ripple class="fab" type="button" :aria-label="label" aria-haspopup="dialog">
    <span class="plus" :class="{ open: expanded }"><slot /></span>
  </button>
</template>

<style scoped>
.fab {
  width: 64px; height: 64px; border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
  box-shadow: var(--md-sys-elevation-3); display: inline-flex; align-items: center; justify-content: center;
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.fab:active { transform: scale(0.92); }
.fab :deep(svg) { width: 28px; height: 28px; }
.plus { display: inline-flex; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
.plus.open { transform: rotate(45deg); }
</style>
