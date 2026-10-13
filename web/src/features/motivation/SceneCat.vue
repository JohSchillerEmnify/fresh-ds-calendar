<script setup lang="ts">
/**
 * The small cat that lives in every top bar scene (ARCHITECTURE "Season scenes and the support cat"): the shared
 * `CatFigure` drawing, posed for the scene. It sits, sways its tail and flicks the hooked tip, blinks (now and then a slow, content cat
 * blink), glances around, twitches an ear, tilts its head and on a long loop stretches and takes a short nap. Full
 * plays everything, Reduced only blinks and flicks slowly, Off is a still, awake cat. `delay` (seconds) shifts the loop so cats in different scenes do not move in step.
 */
import CatFigure from './CatFigure.vue';

withDefaults(defineProps<{ delay?: number }>(), { delay: 0 });
</script>

<template>
  <span class="scenecat" data-part="cat" aria-hidden="true" :style="{ '--cat-delay': `${-delay}s` }"><CatFigure /></span>
</template>

<style scoped>
.scenecat { display: block; aspect-ratio: 1; }
.scenecat :deep(.tail) { animation: cat-sway 4.600s ease-in-out infinite alternate; }
.scenecat :deep(.tail-tip) { animation: cat-tip 6.300s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.torso) { animation: cat-stretch 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.head) { animation: cat-head 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.eyes) { animation: cat-blink 9.200s linear infinite; }
.scenecat :deep(.pupils) { animation: cat-glance 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.ear-r) { animation: cat-ear 7.300s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.ear-l) { animation: cat-ear-l 11.100s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.eyes-nap) { animation: cat-eyes-nap 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.lids) { animation: cat-lids 26s ease-in-out var(--cat-delay) infinite; }
.scenecat :deep(.zz) { animation: cat-zz 26s ease-in-out var(--cat-delay) infinite; }

/* Full: everything; Reduced: blink + a slow tail; Off (and no level yet): a still, awake cat */
.scenecat :deep(:is(.tail, .tail-tip, .torso, .head, .eyes, .pupils, .ear-l, .ear-r, .eyes-nap, .lids, .zz)) { animation-play-state: paused; }
html[data-motion='full'] .scenecat :deep(:is(.tail, .tail-tip, .torso, .head, .eyes, .pupils, .ear-l, .ear-r, .eyes-nap, .lids, .zz)) { animation-play-state: running; }
html[data-motion='reduced'] .scenecat :deep(:is(.tail, .eyes)) { animation-play-state: running; }
html[data-motion='reduced'] .scenecat :deep(.tail) { animation-duration: 7s; }
html:not([data-motion='full']) .scenecat :deep(:is(.tail-tip, .torso, .head, .pupils, .ear-l, .ear-r, .eyes-nap, .lids, .zz)) { animation: none; }

@keyframes cat-sway { from { transform: rotate(-3deg); } to { transform: rotate(4deg); } }
/* the hook at the tip: still most of the time, then a quick double flick */
@keyframes cat-tip {
  0%, 62%, 80%, 100% { transform: none; }
  66% { transform: rotate(-22deg); }
  70% { transform: rotate(8deg); }
  74% { transform: rotate(-14deg); }
}
/* a quick blink, then later a slow, content one (close, hold half-shut, open) */
@keyframes cat-blink {
  0%, 44%, 50%, 78%, 100% { transform: scaleY(1); }
  47% { transform: scaleY(0.1); }
  83%, 89% { transform: scaleY(0.25); }
}
/* looks left (towards what the cat watches), back, right, back, during the awake part of the loop */
@keyframes cat-glance {
  0%, 8%, 18%, 26%, 36%, 100% { transform: translate(0, 0); }
  11%, 15% { transform: translate(-1.400px, 0.400px); }
  29%, 33% { transform: translate(1.300px, -0.300px); }
}
@keyframes cat-ear { 0%, 90%, 100% { transform: none; } 92% { transform: rotate(14deg); } 94% { transform: rotate(-4deg); } 96% { transform: rotate(9deg); } }
@keyframes cat-ear-l { 0%, 60%, 66%, 100% { transform: none; } 62% { transform: rotate(-12deg); } 64% { transform: rotate(3deg); } }
/* 26 s loop: sit (0-52 %), stretch (55-66 %), sit, nap (72-94 %), wake */
@keyframes cat-stretch {
  0%, 53%, 68%, 100% { transform: none; }
  58%, 63% { transform: scale(1.08, 0.88); }
  74%, 92% { transform: scale(1.04, 0.94); }
}
@keyframes cat-head {
  0%, 36%, 48%, 53%, 68%, 100% { transform: none; }
  40%, 45% { transform: rotate(-9deg); }
  58%, 63% { transform: translate(0, 6px) rotate(-5deg); }
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
