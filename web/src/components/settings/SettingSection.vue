<script setup lang="ts">
/** One rounded container of a settings page: an optional bold title, then the rows (and notes) that belong together. */
defineProps<{ title?: string }>();
</script>

<template>
  <section class="sec" data-testid="settings-section" :data-section="title ?? ''">
    <h2 v-if="title">{{ title }}</h2>
    <slot />
  </section>
</template>

<style scoped>
.sec { display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-extra-large); background: var(--md-sys-color-surface-container); padding: 16px 16px 8px; }
h2 { margin: 0 0 4px; font: var(--md-sys-typescale-title-medium); font-weight: 700; color: var(--md-sys-color-primary); }
.sec :deep(.note) { margin: 0 0 4px; padding: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
