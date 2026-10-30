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
/* Mordor's tower, with its eye, stands in the gap between the date and the icons, clear of every control (feature header-expressive); the glow follows it */
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.mo-tower) { right: auto; left: calc(55% - var(--tw) / 2); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.mo-glow) { background: radial-gradient(ellipse 60% 90% at 55% 100%, rgba(255, 90, 20, 0.32), transparent 70%); }
html[data-hand='left'][data-touch] :is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.mo-tower) { left: calc(45% - var(--tw) / 2); }
html[data-hand='left'][data-touch] :is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.mo-glow) { background: radial-gradient(ellipse 60% 90% at 45% 100%, rgba(255, 90, 20, 0.32), transparent 70%); }
[data-layout='one-row'] .tbs { --d: 44px; --t60: 0px; --t58: 0px; --t56: 0px; }
[data-layout='two-rows'] .tbs { --d: 12px; --t60: 0px; --t58: 0px; --t56: 0px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(:is(.life, .mo, .sl)) { inset: auto 0 0 0; height: 96px; overflow: visible; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs:not([data-scene='fall'], [data-scene='winter']) :deep(:is(.life :is(.sky, .at-sky, .sun, .fw), .mo-tower)) { translate: 0 var(--d); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.sl .cloud) { margin-top: var(--d); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .tree.tall) { translate: 0 var(--t60); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .at.tall) { translate: 0 var(--t58); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs :deep(.life .at.tree) { translate: 0 var(--t56); }
html[data-hand='left'][data-touch] .tbs:is([data-scene='fall'], [data-scene='winter']) { transform: scaleX(-1); }
/* Every hero of a scene stands whole in the gap between the date and the icons, whose middle is about 50% of the bar (feature header-expressive); the heroes are centred at 50% */
[data-layout='one-row'] .tbs { --bar-h: 52px; }
[data-layout='two-rows'] .tbs { --bar-h: 84px; }
/* the umbrella stands left of the sun's middle, the Christmas tree as tall as a Compact bar allows */
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='summerholidays'] :deep(.umbrella) { left: calc(50% - 58px); }
[data-layout='one-row'] .tbs[data-scene='christmas'] :deep(.tree) { height: 46px; }
/* the tower is as tall as the bar, so the whole of it and its eye show */
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='mordor'] :deep(.mo-tower) { height: var(--bar-h); translate: 0 0 !important; }
[data-layout='one-row'] .tbs { --tw: 42px; }
[data-layout='two-rows'] .tbs { --tw: 68px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='halloween'] :deep(.sky) { right: auto; left: calc(50% - 29px); top: 2px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='summer'] :deep(.at-sky) { right: auto; left: calc(50% - 20px); top: 2px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='summerholidays'] :deep(.sun) { right: auto; left: calc(50% - 19px); top: 2px; }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='newyear'] :deep(.sunrise) { left: calc(50% - 26px); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='christmas'] :deep(.tree) { left: calc(50% - 18px); }
:is([data-layout='one-row'], [data-layout='two-rows']) .tbs[data-scene='easter'] :deep(.hare) { left: calc(50% - 21px); }
</style>
