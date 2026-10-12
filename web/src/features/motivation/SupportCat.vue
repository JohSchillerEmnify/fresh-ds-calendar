<script setup lang="ts">
/**
 * One visit of the emotional support cat (ARCHITECTURE "Season scenes and the support cat"): walks in at the right
 * edge of the finished list card, puts a paw on the card while looking down at it, tilts its head and twitches an
 * ear, looks at the viewer with a slow blink, grins with its eyes squinted into happy arcs and fades out, then emits
 * `done` (the host removes it). Full ≈ 3 s; Reduced is shorter and calmer (no walk, smaller paw, no tilt or twitch,
 * still tail). The host never
 * mounts it at level Off. Fixed overlay, `pointer-events: none`, so it never blocks anything.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import CatFigure from './CatFigure.vue';
import { catDuration } from './supportCat';

const props = defineProps<{
  /** Viewport rect of the finished list card when it finished. */
  card: { left: number; top: number; right: number; bottom: number };
  level: 'full' | 'reduced';
}>();
const emit = defineEmits<{ done: [] }>();

const SIZE = 72;
const duration = catDuration(props.level);
/** Sits just inside the card's right edge near its top, so the paw lands on the card; always inside the viewport. */
const style = computed(() => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 667;
  const x = Math.max(4, Math.min(props.card.right, vw) - SIZE - 6);
  const y = Math.max(4, Math.min(props.card.top + 6, vh - SIZE - 4));
  return { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, '--cat-dur': `${duration}ms` };
});

let stop: Disposer | null = null;
onMounted(() => { stop = appTimeout(() => { stop = null; emit('done'); }, duration); });
onBeforeUnmount(() => stop?.());
</script>

<template>
  <div class="support-cat" data-testid="support-cat" :data-level="level" :style="style" aria-hidden="true">
    <CatFigure />
  </div>
</template>

<style scoped>
.support-cat {
  position: fixed; width: 72px; height: 72px; z-index: 1000; pointer-events: none; opacity: 0;
  filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--md-sys-color-shadow, #000) 25%, transparent));
  animation: cat-visit var(--cat-dur) linear both;
}
.support-cat * { pointer-events: none; }
.support-cat :deep(.paw) { animation: cat-paw var(--cat-dur) ease-in-out both; }
.support-cat :deep(.head) { animation: cat-head var(--cat-dur) ease-in-out both; }
.support-cat :deep(.pupils) { animation: cat-look var(--cat-dur) ease-in-out both; }
.support-cat :deep(.eyes) { animation: cat-slow-blink var(--cat-dur) ease-in-out both; }
.support-cat :deep(.ear-r) { animation: cat-ear var(--cat-dur) ease-in-out both; }
.support-cat :deep(.calm) { animation: cat-calm var(--cat-dur) step-end both; }
.support-cat :deep(.grin) { animation: cat-grin var(--cat-dur) step-end both; }
.support-cat :deep(.tail) { animation: cat-tail 1.1s ease-in-out infinite alternate; }

/* Full: walk in from the right with a little bob, sit, fade out. */
@keyframes cat-visit {
  0% { opacity: 0; transform: translate(64px, 0); }
  6% { opacity: 1; }
  10% { transform: translate(48px, -2px); }
  16% { transform: translate(32px, 0); }
  22% { transform: translate(16px, -2px); }
  30% { transform: translate(0, 0); }
  86% { opacity: 1; transform: translate(0, 0); }
  100% { opacity: 0; transform: translate(0, 4px); }
}
@keyframes cat-paw {
  0%, 32% { transform: rotate(0deg); }
  40% { transform: rotate(80deg) translate(0, -2px); }
  47%, 78% { transform: rotate(58deg); }
  88%, 100% { transform: rotate(0deg); }
}
@keyframes cat-head {
  0%, 30% { transform: rotate(0deg); }
  38%, 50% { transform: rotate(-8deg) translate(-1px, 1px); }
  58%, 86% { transform: rotate(5deg); }
  100% { transform: rotate(0deg); }
}
/* pupils: down at the card under the paw, then up at the viewer */
@keyframes cat-look {
  0%, 22% { transform: translate(-1.300px, 0); }
  30%, 48% { transform: translate(-1.500px, 1.300px); }
  54%, 100% { transform: translate(0, 0); }
}
/* a slow, friendly blink at the viewer just before the grin */
@keyframes cat-slow-blink { 0%, 55%, 64%, 100% { transform: scaleY(1); } 59%, 61% { transform: scaleY(0.12); } }
@keyframes cat-ear { 0%, 48%, 58%, 100% { transform: none; } 51% { transform: rotate(15deg); } 54% { transform: rotate(-5deg); } 56% { transform: rotate(8deg); } }
@keyframes cat-calm { 0% { opacity: 1; } 64% { opacity: 0; } }
@keyframes cat-grin { 0% { opacity: 0; } 64% { opacity: 1; } }
@keyframes cat-tail { from { transform: rotate(-6deg); } to { transform: rotate(10deg); } }

/* Reduced: fades in already sitting, a small paw, still tail. */
.support-cat[data-level='reduced'] { animation-name: cat-visit-calm; }
.support-cat[data-level='reduced'] :deep(.paw) { animation-name: cat-paw-calm; }
.support-cat[data-level='reduced'] :deep(:is(.head, .ear-r)) { animation: none; }
.support-cat[data-level='reduced'] :deep(.tail) { animation: none; }
@keyframes cat-visit-calm {
  0% { opacity: 0; }
  15%, 85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes cat-paw-calm {
  0%, 18% { transform: rotate(0deg); }
  32%, 78% { transform: rotate(50deg); }
  90%, 100% { transform: rotate(0deg); }
}
</style>
