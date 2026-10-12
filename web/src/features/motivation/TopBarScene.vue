<script setup lang="ts">
import { computed } from 'vue';
import { getActivePinia } from 'pinia';
import { scenes } from './scenes';
import { useMotivationStore } from './store';
import type { ChangeKind, Mood, SceneName } from './types';

/**
 * Background scene for the top bar `background` slot. `scene` is the EFFECTIVE scene resolved by the shell
 * (mordor | sunflowers | none). Sunflower data comes from the motivation store unless overridden by props.
 * Absolutely positioned, pointer-events none: it fills its positioned parent.
 */
const props = defineProps<{ scene: SceneName; flowers?: number; mood?: Mood; change?: { id: number; kinds: ChangeKind[] } | null }>();
const store = getActivePinia() ? useMotivationStore() : null;
const comp = computed(() => scenes[props.scene] ?? null);
const bind = computed(() =>
  props.scene === 'sunflowers'
    ? {
        flowers: props.flowers ?? store?.motivation?.plant.flowers ?? 0,
        mood: props.mood ?? store?.motivation?.plant.mood ?? 'happy',
        change: props.change ?? store?.change ?? null,
      }
    : {},
);
</script>

<template>
  <div v-if="comp" class="tbs" data-testid="top-bar-scene" :data-scene="scene" aria-hidden="false">
    <component :is="comp" v-bind="bind" />
  </div>
</template>

<style scoped>
.tbs { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
</style>
