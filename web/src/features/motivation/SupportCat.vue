<script setup lang="ts">
/**
 * One visit of the emotional support cat (ARCHITECTURE "Season scenes and the support cat"): walks in from the right (the left in
 * left-handed mode, drawn mirrored, standing at the start of the title)
 * (a stepping walk cycle with a little bob), stops at the end of the finished list's title, looks down at it and
 * swipes its paw across it — the host draws the title's strike line in the same window (`CAT_SWIPE`) — then twitches
 * an ear, tilts its head, looks at the viewer with a slow blink, grins with its eyes squinted into happy arcs and fades
 * out, then emits `done` (the host removes it). The tail tip flicks all along. Full ≈ 3 s; Reduced is shorter and
 * calmer (fades in already sitting, a gentle swipe, no tilt, twitch or flicks). The host never mounts it at level
 * Off. Fixed overlay, `pointer-events: none`, so it never blocks anything; only transforms and opacity animate.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useLeftHand } from '@/composables/useLeftHand';
import CatFigure from './CatFigure.vue';
import { catDuration } from './supportCat';

const props = defineProps<{
  /** Viewport rect of the finished list card when it finished. */
  card: { left: number; top: number; right: number; bottom: number };
  /** Viewport rect of the list title's text, if known: the cat stands at its end so the paw lands on it. */
  title?: { left: number; top: number; right: number; bottom: number } | null;
  level: 'full' | 'reduced';
}>();
const emit = defineEmits<{ done: [] }>();

const SIZE = 72;
const leftHand = useLeftHand();
const duration = catDuration(props.level);
/** The point of the cat box (px from its top left) that goes over the title end: the paw sweeps through it. */
const PAW_REACH = { x: 20, y: 54 };
/**
 * Stands at the end of the title (paw on its last letters) when the title is known, else just inside the card's
 * right edge near its top; never past the card's right edge and always inside the viewport.
 */
const style = computed(() => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 667;
  const maxX = Math.min(props.card.right, vw) - SIZE - 6;
  const t = props.title;
  // mirrored: the paw point sits SIZE - PAW_REACH.x from the box's left edge, over the title's start
  const x = leftHand.value
    ? Math.min(Math.max(4, t ? t.left - (SIZE - PAW_REACH.x) : props.card.left + 6), maxX)
    : Math.max(4, t ? Math.min(t.right - PAW_REACH.x, maxX) : maxX);
  const y = Math.max(4, Math.min(t ? (t.top + t.bottom) / 2 - PAW_REACH.y : props.card.top + 6, vh - SIZE - 4));
  return { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, '--cat-dur': `${duration}ms`, '--dir': leftHand.value ? -1 : 1 };
});

let stop: Disposer | null = null;
onMounted(() => { stop = appTimeout(() => { stop = null; emit('done'); }, duration); });
onBeforeUnmount(() => stop?.());
</script>

<template>
  <div class="support-cat" data-testid="support-cat" :data-level="level" :style="style" aria-hidden="true" :data-from="leftHand ? 'left' : 'right'">
    <CatFigure class="figure" />
  </div>
</template>

<style scoped>
.support-cat {
  position: fixed; width: 72px; height: 72px; z-index: 1000; pointer-events: none; opacity: 0;
  filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--md-sys-color-shadow, #000) 25%, transparent));
  animation: cat-visit var(--cat-dur) linear both;
}
.support-cat * { pointer-events: none; }
.support-cat .figure { transform: scaleX(var(--dir, 1)); }
.support-cat :deep(.torso) { animation: cat-body var(--cat-dur) ease-in-out both; }
.support-cat :deep(.paw) { animation: cat-paw var(--cat-dur) ease-in-out both; }
.support-cat :deep(.leg-b) { animation: cat-leg-b var(--cat-dur) ease-in-out both; }
.support-cat :deep(.head) { animation: cat-head var(--cat-dur) ease-in-out both; }
.support-cat :deep(.pupils) { animation: cat-look var(--cat-dur) ease-in-out both; }
.support-cat :deep(.eyes) { animation: cat-slow-blink var(--cat-dur) ease-in-out both; }
.support-cat :deep(.ear-r) { animation: cat-ear var(--cat-dur) ease-in-out both; }
.support-cat :deep(.ear-l) { animation: cat-ear-l var(--cat-dur) ease-in-out both; }
.support-cat :deep(.calm) { animation: cat-calm var(--cat-dur) step-end both; }
.support-cat :deep(.grin) { animation: cat-grin var(--cat-dur) step-end both; }
.support-cat :deep(.tail) { animation: cat-tail var(--cat-dur) ease-in-out both; }
.support-cat :deep(.tail-tip) { animation: cat-tip 0.900s ease-in-out infinite alternate; }

/* Full (3 s): walk in from the right with a bob per step (0-30 %), stop at the title, fade out at the end. */
@keyframes cat-visit {
  0% { opacity: 0; transform: translate(calc(var(--dir, 1) * 70px), 0); }
  5% { opacity: 1; }
  7.500% { transform: translate(calc(var(--dir, 1) * 56px), -2px); }
  15% { transform: translate(calc(var(--dir, 1) * 38px), 0); }
  22.500% { transform: translate(calc(var(--dir, 1) * 18px), -2px); }
  30% { transform: translate(0, 0); }
  88% { opacity: 1; transform: translate(0, 0); }
  100% { opacity: 0; transform: translate(0, 3px); }
}
/* walking sways the body from leg to leg; leaning into the swipe */
@keyframes cat-body {
  0% { transform: rotate(0deg); }
  3.750%, 18.750% { transform: rotate(-3deg); }
  11.250%, 26.250% { transform: rotate(3deg); }
  30%, 34% { transform: rotate(0deg); }
  44%, 52% { transform: rotate(-5deg); }
  62%, 100% { transform: rotate(0deg); }
}
/* steps (lift and set down, opposite to the other leg), then the swipe: lift, sweep across the title (36-52 %, the
   strike line draws in the same window), rest on the card, put back */
@keyframes cat-paw {
  0%, 7.500%, 15%, 22.500%, 30% { transform: translate(0, 0); }
  3.750%, 18.750% { transform: translate(0, -3px); }
  33% { transform: rotate(-12deg) translate(0, -2px); }
  36% { transform: rotate(18deg) translate(0, -2px); }
  52% { transform: rotate(96deg) translate(0, 5px); }
  58%, 74% { transform: rotate(84deg) translate(0, 3px); }
  84%, 100% { transform: rotate(0deg); }
}
@keyframes cat-leg-b {
  0%, 7.500%, 15%, 22.500%, 30%, 100% { transform: translate(0, 0); }
  11.250%, 26.250% { transform: translate(0, -3px); }
}
@keyframes cat-head {
  0%, 30% { transform: rotate(0deg); }
  38%, 52% { transform: rotate(-9deg) translate(-1px, 1px); }
  60%, 86% { transform: rotate(6deg); }
  100% { transform: rotate(0deg); }
}
/* pupils: ahead while walking, down at the title under the paw, then up at the viewer */
@keyframes cat-look {
  0%, 26% { transform: translate(-1.300px, 0); }
  34%, 54% { transform: translate(-1.300px, 1.200px); }
  60%, 100% { transform: translate(0, 0); }
}
/* a slow, friendly blink at the viewer just before the grin */
@keyframes cat-slow-blink { 0%, 62%, 70%, 100% { transform: scaleY(1); } 65%, 67% { transform: scaleY(0.12); } }
@keyframes cat-ear { 0%, 54%, 62%, 100% { transform: none; } 56% { transform: rotate(16deg); } 58% { transform: rotate(-5deg); } 60% { transform: rotate(8deg); } }
@keyframes cat-ear-l { 0%, 12%, 18%, 100% { transform: none; } 14% { transform: rotate(-10deg); } 16% { transform: rotate(3deg); } }
@keyframes cat-calm { 0% { opacity: 1; } 70% { opacity: 0; } }
@keyframes cat-grin { 0% { opacity: 0; } 70% { opacity: 1; } }
/* the tail trails a little behind while walking, then stands up straight */
@keyframes cat-tail { 0%, 26% { transform: rotate(9deg); } 36%, 100% { transform: rotate(0deg); } }
@keyframes cat-tip { from { transform: rotate(-16deg); } to { transform: rotate(10deg); } }

/* Reduced (2 s): fades in already sitting, one gentle swipe (28-46 %), no steps, tilt, twitch or flicks. */
.support-cat[data-level='reduced'] { animation-name: cat-visit-calm; }
.support-cat[data-level='reduced'] :deep(.paw) { animation-name: cat-paw-calm; }
.support-cat[data-level='reduced'] :deep(:is(.torso, .leg-b, .head, .ear-l, .ear-r, .tail, .tail-tip)) { animation: none; }
@keyframes cat-visit-calm {
  0% { opacity: 0; }
  15%, 85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes cat-paw-calm {
  0%, 24% { transform: rotate(0deg); }
  28% { transform: rotate(14deg); }
  46%, 78% { transform: rotate(80deg); }
  90%, 100% { transform: rotate(0deg); }
}
</style>
