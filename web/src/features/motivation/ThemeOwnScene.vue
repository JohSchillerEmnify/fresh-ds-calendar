<script setup lang="ts">
/** Top bar scene of an own theme: its own SVG picture when it has one, otherwise the scene the app draws. */
import { useThemeStore } from '@/stores/theme';
import DrawnScene from './DrawnScene.vue';
import SceneImage from './SceneImage.vue';

const theme = useThemeStore();
</script>

<template>
  <SceneImage v-if="theme.resolved.sceneSvg" :svg="theme.resolved.sceneSvg" />
  <DrawnScene v-else-if="theme.resolved.sceneDraw" v-bind="theme.resolved.sceneDraw" />
</template>
