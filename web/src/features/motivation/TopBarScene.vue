<script setup lang="ts">
import { computed } from 'vue';
import { getActivePinia } from 'pinia';
import { scenes } from './scenes';
import { useMotivationStore } from './store';
import { SUNFLOWER_MAX, type ChangeKind, type Mood, type SceneName } from './types';

/**
 * Background scene for the top bar `background` slot. `scene` is the EFFECTIVE scene resolved by the shell
 * (mordor | sunflowers | none). Sunflower data comes from the motivation store unless overridden by props; with
 * `fieldMode` 'full' the sunflower field is a fixed full field that never grows (no flower count, no bloom).
 * Absolutely positioned, pointer-events none: it fills its positioned parent. In left-handed mode on a touch screen the
 * Fall and Winter scenes are flipped, like the bar.
 */
const props = defineProps<{ scene: SceneName; fieldMode?: 'grow' | 'full'; flowers?: number; mood?: Mood; change?: { id: number; kinds: ChangeKind[] } | null }>();
const store = getActivePinia() ? useMotivationStore() : null;
const comp = computed(() => scenes[props.scene] ?? null);
const bind = computed(() =>
  props.scene === 'sunflowers'
    ? {
        flowers: props.fieldMode === 'full' ? SUNFLOWER_MAX : (props.flowers ?? store?.motivation?.plant.flowers ?? 0),
        mood: props.mood ?? store?.motivation?.plant.mood ?? 'happy',
        change: props.fieldMode === 'full' ? null : (props.change ?? store?.change ?? null),
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
/* left-handed mode mirrors the bar on touch screens; the Fall and Winter scenes are drawn mirrored with it (owner, 2026-10-26) */
html[data-hand='left'][data-touch] .tbs:is([data-scene='fall'], [data-scene='winter']) { transform: scaleX(-1); }
</style>
