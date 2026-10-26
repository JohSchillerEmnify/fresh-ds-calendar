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
/* Phone layouts (feature header-layout, PR 3): every scene part keeps its as-built size. The scene's layer is the as-built
   96 px box with its ground line on the bar's bottom edge, the bar clips what rises above it; sky parts and tall props move
   down so they keep their place at the top. Fall and Winter keep their own spots (FallWinterScene) and their own sky: only the box. */
/* One row: the 49 px hare is left out (owner-approved mockup, scenes.cjs; its only gap is the cat's) */
[data-layout='one-row'] .tbs :deep(.hare) { display: none; }
[data-layout='one-row'] .tbs { --d: 44px; --t60: 8px; --t58: 6px; --t56: 4px; }
[data-layout='two-rows'] .tbs { --d: 12px; --t60: 0px; --t58: 0px; --t56: 0px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(:is(.life, .mo, .sl)) { inset: auto 0 0 0; height: 96px; overflow: visible; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs:not([data-scene='fall'], [data-scene='winter']) :deep(:is(.life :is(.sky, .at-sky, .sun, .fw), .mo-tower)) { translate: 0 var(--d); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.sl .cloud) { margin-top: var(--d); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .tree.tall) { translate: 0 var(--t60); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .at.tall) { translate: 0 var(--t58); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .at.tree) { translate: 0 var(--t56); }
html[data-hand='left'][data-touch] .tbs:is([data-scene='fall'], [data-scene='winter']) { transform: scaleX(-1); }
</style>
