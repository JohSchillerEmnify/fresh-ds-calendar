<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useAnimationLevel } from '@/motion/level';
import Butterfly from './Butterfly.vue';
import SunflowerField from './SunflowerField.vue';
import { onceFlag } from './session';
import type { ChangeKind, Mood } from './types';

/** Sunflower field + once-per-session butterfly (Full animations and >= 1 flower only). */
const props = defineProps<{ flowers: number; mood?: Mood; change?: { id: number; kinds: ChangeKind[] } | null }>();
const level = useAnimationLevel();
const root = ref<HTMLElement | null>(null);
const showButterfly = ref(false);
let alive = true;

watch(
  () => [props.flowers, level.value] as const,
  async ([n, lv]) => {
    if (showButterfly.value || lv !== 'full' || n < 1) return;
    await nextTick();
    if (!alive || !onceFlag('butterfly')) return;
    showButterfly.value = true;
  },
  { immediate: true },
);
onBeforeUnmount(() => (alive = false));
</script>

<template>
  <div ref="root" class="ss" data-testid="scene-sunflowers">
    <SunflowerField :flowers="flowers" :mood="mood" :change="change" />
    <Butterfly v-if="showButterfly" :container="root" @done="showButterfly = false" />
  </div>
</template>

<style scoped>
.ss { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
</style>
