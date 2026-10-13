<script setup lang="ts">
/** Top bar scene of an imported theme: its own SVG picture, light or dark by the page's theme. */
import { useThemeStore } from '@/stores/theme';
import SceneImage from './SceneImage.vue';

const theme = useThemeStore();
</script>

<template>
  <SceneImage :svg="theme.resolved.sceneSvg" />
</template>
