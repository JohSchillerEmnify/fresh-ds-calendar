<script setup lang="ts">
/** M3 top app bar container. Slots: `background` (scene layer, non-interactive) and the default slot (content, own layout). */
defineProps<{ scrolled?: boolean }>();
</script>

<template>
  <header class="top-bar" :class="{ scrolled }" data-testid="top-bar">
    <div class="bg" data-testid="top-bar-background" aria-hidden="true"><slot name="background" /></div>
    <div class="content"><slot /></div>
  </header>
</template>

<style scoped>
.top-bar {
  position: relative; flex: none; padding-top: var(--safe-top); background: var(--md-sys-color-surface);
  transition: background var(--md-sys-motion-duration-medium); z-index: 5;
}
.top-bar.scrolled { background: var(--md-sys-color-surface-container); }
.bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.content { position: relative; z-index: 1; }
</style>
