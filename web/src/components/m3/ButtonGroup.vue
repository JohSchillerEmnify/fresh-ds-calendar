<script setup lang="ts">
/** A connected button group of actions: the buttons touch (2 px apart), the ends are round, the inner corners small. */
defineProps<{ label: string }>();
</script>

<template>
  <div class="grp" role="group" :aria-label="label"><slot /></div>
</template>

<style scoped>
.grp { display: flex; gap: 2px; max-width: 100%; }
.grp :slotted(.m3-btn) { flex: 1 1 auto; min-width: 0; min-height: 40px; padding: 0 16px; border-radius: var(--md-sys-shape-corner-extra-small); }
.grp :slotted(.m3-btn:first-child) { border-radius: var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-full); }
.grp :slotted(.m3-btn:last-child) { border-radius: var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-full) var(--md-sys-shape-corner-extra-small); }
</style>
