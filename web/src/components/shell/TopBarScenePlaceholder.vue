<script setup lang="ts">
/**
 * Stand-in for `features/motivation/TopBarScene.vue` until that module is merged: a quiet tinted gradient.
 * The shell uses the real component automatically as soon as the file exists (see AppTopBar.vue).
 */
defineProps<{ scene: 'sunflowers' | 'mordor' | 'none' }>();
</script>

<template>
  <div v-if="scene !== 'none'" class="scene" :class="scene" :data-scene="scene" />
</template>

<style scoped>
.scene { position: absolute; inset: 0; }
.sunflowers { background: linear-gradient(0deg, color-mix(in srgb, #f6bf26 22%, transparent), transparent 70%); }
.mordor { background: radial-gradient(120% 140% at 80% 130%, color-mix(in srgb, #ff5a00 55%, transparent), transparent 60%), linear-gradient(0deg, color-mix(in srgb, #2a0a00 60%, transparent), transparent); }
</style>
