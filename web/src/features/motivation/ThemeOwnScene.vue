<script setup lang="ts">
/** Top bar scene of an own theme: its own SVG picture when it has one, otherwise the scene the app draws. */
import { computed } from 'vue';
import { previewData } from '@/composables/usePreview';
import { useThemeStore } from '@/stores/theme';
import DrawnScene from './DrawnScene.vue';
import SceneImage from './SceneImage.vue';

const store = useThemeStore();
// a sample calendar in the theme menu shows its own candidate theme, in that theme's light or dark
const sample = previewData();
const own = computed(() => sample?.theme ?? store.resolved);
const dark = computed(() => sample?.dark);
</script>

<template>
  <SceneImage v-if="own.sceneSvg" :svg="own.sceneSvg" :dark="dark" />
  <DrawnScene v-else-if="own.sceneDraw" v-bind="own.sceneDraw" :dark="dark" />
</template>
