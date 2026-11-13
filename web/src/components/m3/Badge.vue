<script setup lang="ts">
/** A notification badge on the corner of its (positioned) parent: a 6 px dot, or a 16 px pill with a short `label`; sizes and error colours from _md-comp-badge (v0.192). */
defineProps<{ label?: string | number }>();
</script>

<template>
  <span class="m3-badge" :class="{ large: label !== undefined }">{{ label }}</span>
</template>

<style scoped>
.m3-badge {
  position: absolute; inset-block-start: 4px; inset-inline-start: 50%; margin-inline-start: 6px; pointer-events: none;
  width: 6px; height: 6px; border-radius: var(--md-sys-shape-corner-full); background-color: var(--md-sys-color-error);
}
.m3-badge.large {
  inset-block-start: 1px; margin-inline-start: 2px; width: auto; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-error); font: var(--md-sys-typescale-label-small);
}
</style>
