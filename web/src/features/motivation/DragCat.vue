<script setup lang="ts">
/**
 * The drag helper cat (ARCHITECTURE "Drag helper"): mounted once in the shell; on each pick-up it may come along
 * (setting "Support cat": Off / Sometimes ≈ every 5th drag / Every time; never at animation level Off). It follows the
 * lifted card: above it pushing down while the card moves later, below it pulling up while it moves earlier, beside it
 * pushing sideways towards another day; when the pointer rests it sits beside the card with a paw on it, head tilted,
 * with a questioning look. On drop or cancel it hops away and is removed. Reduced: it sits beside the card, no walking
 * or pushing. It only reads `watchDrags` (motion/drag.ts) from inside the drag's own rAF frame and writes the root's
 * transform there; it has no pointer events and no loop of its own.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { getMotionLevel, watchDrags, type DragFrame, type MotionLevel } from '@/motion';
import { usePrefsStore } from '@/stores/prefs';
import { useClockStore } from '@/stores/clock';
import CatFigure from './CatFigure.vue';
import { catComes, takeForcedCat } from './supportCat';
import { DRAG_CAT_CHANCE, DRAG_CAT_HOP_MS, dragCatPose, dragCatSide, type DragCatPose } from './dragCat';

const prefs = usePrefsStore();
const clock = useClockStore();

/** Cat box size in px. */
const SIZE = 56;
/** How far the cat's box overlaps the card edge, so paws land on the card. */
const OVERLAP = 10;
/** Share of the remaining distance the cat closes per frame: it trots after the card instead of being glued to it. */
const FOLLOW = 0.3;

const active = ref(false);
const leaving = ref(false);
const pose = ref<DragCatPose>('push-down');
const side = ref<'left' | 'right'>('right');
const level = ref<Exclude<MotionLevel, 'off'>>('full');
const root = ref<HTMLElement | null>(null);
let pos: { x: number; y: number } | null = null;
let walking = false;
let hop: Disposer | null = null;

/** Where the cat's box goes for a pose, around the card's drawn rect (viewport px, kept on screen). */
function place(r: DragFrame['rect'], p: DragCatPose, s: 'left' | 'right') {
  const cx = r.left + r.width / 2;
  let x: number;
  let y: number;
  if (p === 'push-down') { x = cx - SIZE / 2; y = r.top - SIZE + OVERLAP; }
  else if (p === 'pull-up') { x = cx - SIZE / 2; y = r.top + r.height - OVERLAP; }
  else {
    x = s === 'left' ? r.left - SIZE + OVERLAP : r.left + r.width - OVERLAP;
    y = r.top + Math.min(r.height, SIZE) - SIZE + OVERLAP / 2;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return { x: Math.max(0, Math.min(x, vw - SIZE)), y: Math.max(0, Math.min(y, vh - SIZE)) };
}

function begin() {
  const lvl = getMotionLevel();
  const forced = takeForcedCat(clock.config.testMode);
  if (lvl === 'off' || !catComes({ level: lvl, setting: prefs.supportCat, forced, random: Math.random(), chance: DRAG_CAT_CHANCE })) return;
  hop?.();
  hop = null;
  level.value = lvl;
  leaving.value = false;
  pose.value = lvl === 'full' ? 'push-down' : 'push-side';
  side.value = 'right';
  pos = null;
  walking = false;
  active.value = true;
}

/** One drag frame: pick the pose, move the box towards its place (transform only). */
function follow(f: DragFrame) {
  const p = dragCatPose({ dx: f.dx, dy: f.dy, vy: f.vy, width: f.rect.width, stillMs: f.stillMs, level: level.value }, pose.value);
  if (p !== pose.value) pose.value = p;
  // keep the side while waiting, so the cat sits down where it was pushing
  if (p !== 'wait') side.value = dragCatSide(f.dx, p);
  const to = place(f.rect, p, side.value);
  pos = !pos || level.value !== 'full' ? to : { x: pos.x + (to.x - pos.x) * FOLLOW, y: pos.y + (to.y - pos.y) * FOLLOW };
  const el = root.value;
  if (!el) return;
  el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
  el.dataset.placed = 'true';
  const w = level.value === 'full' && p !== 'wait' && f.stillMs < 150;
  if (w !== walking) {
    walking = w;
    el.dataset.walking = String(w);
  }
}

function end() {
  leaving.value = true;
  hop = appTimeout(() => { hop = null; active.value = false; leaving.value = false; }, DRAG_CAT_HOP_MS[level.value]);
}

let unwatch: (() => void) | null = null;
onMounted(() => {
  unwatch = watchDrags((f) => {
    if (f.phase === 'start') begin();
    if (!active.value || leaving.value) return;
    if (f.phase === 'end') end();
    else follow(f);
  });
});
onBeforeUnmount(() => { unwatch?.(); hop?.(); });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active"
      ref="root"
      class="drag-cat"
      data-testid="support-cat"
      data-role="drag"
      :data-pose="pose"
      :data-side="side"
      :data-level="level"
      :data-leaving="leaving"
      aria-hidden="true"
    >
      <div class="hop" :style="{ '--hop-ms': `${DRAG_CAT_HOP_MS[level]}ms` }">
        <CatFigure />
        <span class="ask">?</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drag-cat {
  position: fixed; left: 0; top: 0; width: 56px; height: 56px; z-index: 1000; pointer-events: none;
  will-change: transform;
}
/* not shown until the first drag frame has placed it next to the card */
.drag-cat:not([data-placed]) { visibility: hidden;
  filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--md-sys-color-shadow, #000) 25%, transparent));
}
.drag-cat * { pointer-events: none; }
.hop { position: relative; width: 100%; height: 100%; animation: drag-cat-in 220ms ease-out both; }
/* the paws and the body: every pose is a transform on the shared drawing's named parts */
.drag-cat :deep(:is(.paw, .leg-b, .torso, .head, .pupils, .tail)) { transition: transform 180ms ease-out; }
.ask {
  position: absolute; right: -2px; top: -8px; font: 700 15px/1 system-ui, sans-serif;
  color: var(--md-sys-color-primary, #6750a4); opacity: 0; transform: scale(0.4); transition: opacity 160ms, transform 200ms;
}

/* push-down: above the card, both front legs pressing onto its top edge, body leaning into it */
.drag-cat[data-pose='push-down'] :deep(.torso) { transform: scaleY(0.94); }
.drag-cat[data-pose='push-down'] :deep(.pupils) { transform: translate(0, 1.300px); }
/* pull-up: below the card, both front legs raised over the head gripping its bottom edge, leaning back */
.drag-cat[data-pose='pull-up'] :deep(.paw) { transform: translate(-4px, -14px) rotate(145deg); }
.drag-cat[data-pose='pull-up'] :deep(.leg-b) { transform: translate(4px, -14px) rotate(-145deg); }
.drag-cat[data-pose='pull-up'] :deep(.torso) { transform: scaleY(1.04); }
.drag-cat[data-pose='pull-up'] :deep(.pupils) { transform: translate(0, -1.300px); }
/* push-side: beside the card, legs stretched towards it, leaning in */
.drag-cat[data-pose='push-side'][data-side='left'] :deep(.paw) { transform: rotate(-78deg); }
.drag-cat[data-pose='push-side'][data-side='left'] :deep(.leg-b) { transform: rotate(-86deg); }
.drag-cat[data-pose='push-side'][data-side='left'] :deep(.torso) { transform: rotate(6deg); }
.drag-cat[data-pose='push-side'][data-side='left'] :deep(.pupils) { transform: translate(1.300px, 0); }
.drag-cat[data-pose='push-side'][data-side='right'] :deep(.paw) { transform: rotate(86deg); }
.drag-cat[data-pose='push-side'][data-side='right'] :deep(.leg-b) { transform: rotate(78deg); }
.drag-cat[data-pose='push-side'][data-side='right'] :deep(.torso) { transform: rotate(-6deg); }
.drag-cat[data-pose='push-side'][data-side='right'] :deep(.pupils) { transform: translate(-1.300px, 0); }
/* wait: sitting beside the card, one paw resting on it, head tilted, looking at the person, a small "?" */
.drag-cat[data-pose='wait'][data-side='right'] :deep(.paw) { transform: rotate(74deg) translate(0, 1px); }
.drag-cat[data-pose='wait'][data-side='left'] :deep(.leg-b) { transform: rotate(-74deg) translate(0, 1px); }
.drag-cat[data-pose='wait'] :deep(.head) { transform: rotate(12deg); }
.drag-cat[data-pose='wait'][data-side='left'] :deep(.head) { transform: rotate(-12deg); }
.drag-cat[data-pose='wait'] :deep(.pupils) { transform: translate(0, -0.600px); }
.drag-cat[data-pose='wait'] :deep(.ear-r) { animation: drag-cat-ear 1.400s ease-in-out infinite; }
.drag-cat[data-pose='wait'] .ask { opacity: 1; transform: scale(1); }
.drag-cat[data-pose='wait'][data-side='left'] .ask { right: auto; left: -2px; }

/* walking alongside: the legs that are not pushing step, the body bobs; the tail tip always flicks */
.drag-cat[data-walking='true'] .hop { animation: drag-cat-in 220ms ease-out both, drag-cat-bob 300ms ease-in-out infinite alternate; }
.drag-cat[data-walking='true'][data-pose='push-down'] :deep(.paw) { animation: drag-cat-step 300ms ease-in-out infinite alternate; }
.drag-cat[data-walking='true'][data-pose='push-down'] :deep(.leg-b) { animation: drag-cat-step 300ms ease-in-out -300ms infinite alternate; }
.drag-cat :deep(.tail-tip) { animation: drag-cat-tip 0.800s ease-in-out infinite alternate; }

/* on drop or cancel: a little crouch, a hop up and away, gone */
.drag-cat[data-leaving='true'] .hop { animation: drag-cat-hop var(--hop-ms) ease-in both; }
.drag-cat[data-leaving='true'] .ask { opacity: 0; }

@keyframes drag-cat-in { from { opacity: 0; transform: scale(0.6) translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes drag-cat-bob { from { transform: translateY(0); } to { transform: translateY(-2px); } }
@keyframes drag-cat-step { from { transform: translateY(0); } to { transform: translateY(-3px); } }
@keyframes drag-cat-tip { from { transform: rotate(-16deg); } to { transform: rotate(10deg); } }
@keyframes drag-cat-ear { 0%, 70%, 100% { transform: none; } 78% { transform: rotate(14deg); } 86% { transform: rotate(-4deg); } }
@keyframes drag-cat-hop {
  0% { opacity: 1; transform: none; }
  18% { opacity: 1; transform: translateY(3px) scaleY(0.88); }
  55% { opacity: 1; transform: translate(26px, -34px) rotate(10deg); }
  100% { opacity: 0; transform: translate(56px, -12px) rotate(16deg) scale(0.85); }
}

/* Reduced: no stepping, flicks or hop — it appears sitting beside the card and fades out */
.drag-cat[data-level='reduced'] :deep(:is(.paw, .leg-b, .torso, .head, .pupils, .tail, .tail-tip, .ear-r)) { animation: none; transition: none; }
.drag-cat[data-level='reduced'] .hop { animation: drag-cat-fade-in 200ms ease-out both; }
.drag-cat[data-level='reduced'][data-leaving='true'] .hop { animation: drag-cat-fade-out var(--hop-ms) ease-out both; }
@keyframes drag-cat-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes drag-cat-fade-out { from { opacity: 1; } to { opacity: 0; } }
</style>
