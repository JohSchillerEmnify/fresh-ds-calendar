<script setup lang="ts">
/**
 * The small cat that lives in every top bar scene (ARCHITECTURE "Season scenes and the support cat"): the shared
 * `CatFigure` drawing, posed for the scene. It sits and flicks its tail, blinks now and then, and on a long loop
 * stretches and takes a short nap. Full plays everything, Reduced only blinks and flicks slowly, Off is a still,
 * awake cat. `delay` (seconds) shifts the loop so cats in different scenes do not move in step.
 */
import CatFigure from './CatFigure.vue';

withDefaults(defineProps<{ delay?: number }>(), { delay: 0 });
</script>

<template>
  <span class="scenecat" data-part="cat" aria-hidden="true" :style="{ '--cat-delay': `${-delay}s` }"><CatFigure /></span>
</template>

<style scoped>
.scenecat { display: block; aspect-ratio: 1; }
.scenecat :deep(.tail) { animation: cat-flick 2.800s ease-in-out infinite alternate; }
.scenecat :deep(.torso) { animation: cat-stretch 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.head) { animation: cat-head 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.eyes) { animation: cat-blink 4.600s linear infinite; }
.scenecat :deep(.eyes-nap) { animation: cat-eyes-nap 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.lids) { animation: cat-lids 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.zz) { animation: cat-zz 26s ease-in-out var(--cat-delay) infinite; }

/* Full: everything; Reduced: blink + a slow tail; Off (and no level yet): a still, awake cat */
.scenecat :deep(:is(.tail, .torso, .head, .eyes, .eyes-nap, .lids, .zz)) { animation-play-state: paused; }
html[data-motion='full'] .scenecat :deep(:is(.tail, .torso, .head, .eyes, .eyes-nap, .lids, .zz)) { animation-play-state: running; }
html[data-motion='reduced'] .scenecat :deep(:is(.tail, .eyes)) { animation-play-state: running; }
html[data-motion='reduced'] .scenecat :deep(.tail) { animation-duration: 5s; }
html:not([data-motion='full']) .scenecat :deep(:is(.torso, .head, .eyes-nap, .lids, .zz)) { animation: none; }

@keyframes cat-flick { from { transform: rotate(-6deg); } to { transform: rotate(9deg); } }
@keyframes cat-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
/* 26 s loop: sit (0-52 %), stretch (55-66 %), sit, nap (72-94 %), wake */
@keyframes cat-stretch {
  0%, 53%, 68%, 100% { transform: none; }
  58%, 63% { transform: scale(1.14, 0.86); }
  74%, 92% { transform: scale(1.04, 0.94); }
}
@keyframes cat-head {
  0%, 53%, 68%, 100% { transform: none; }
  58%, 63% { transform: translate(-6px, 6px) rotate(-6deg); }
  74%, 92% { transform: translate(0, 4px) rotate(10deg); }
}
@keyframes cat-eyes-nap { 0%, 71%, 95%, 100% { transform: none; } 73%, 93% { transform: scaleY(0.05); } }
@keyframes cat-lids { 0%, 71%, 95%, 100% { opacity: 0; } 73%, 93% { opacity: 1; } }
@keyframes cat-zz {
  0%, 75% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  80% { opacity: 1; transform: translate(1px, -3px) scale(1); }
  86% { opacity: 0.7; transform: translate(4px, -7px) scale(1.15); }
  92%, 100% { opacity: 0; transform: translate(7px, -11px) scale(1.3); }
}
</style>
