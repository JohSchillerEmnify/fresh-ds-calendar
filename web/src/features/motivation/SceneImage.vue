<script setup lang="ts">
/**
 * A theme's own scene picture (SVG) shown as an image, never inlined (ADR 0016).
 * Light and dark variants: `dark` picks one; without it the page's `data-theme` does.
 */
import { useSceneUrls } from '@/theme/svg';

// `dark` stays undefined (not false) when absent: that is what selects the page's theme
const props = withDefaults(defineProps<{ svg?: { light?: string; dark?: string }; dark?: boolean }>(), { dark: undefined });
const urls = useSceneUrls(() => props.svg);
</script>

<template>
  <span v-if="urls" class="scene-img" data-testid="scene-image" aria-hidden="true">
    <img v-if="dark !== undefined || urls.light === urls.dark" :src="dark ? urls.dark : urls.light" alt="" draggable="false" />
    <template v-else>
      <img class="l" :src="urls.light" alt="" draggable="false" />
      <img class="d" :src="urls.dark" alt="" draggable="false" />
    </template>
  </span>
</template>

<style>
.scene-img { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.scene-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scene-img .d { display: none; }
:root[data-theme='dark'] .scene-img .d { display: block; }
:root[data-theme='dark'] .scene-img .l { display: none; }
</style>
