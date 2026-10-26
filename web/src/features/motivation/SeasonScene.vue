<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { motionLevel } from '@/motion/level';
import { useClearOfControls } from './clearOfControls';
import { anchor, BAR, layoutFor, PARTICLE_SIZE, PARTICLE_TURN, particleScale, STILL } from './fallWinter';
import { sceneStill } from './sceneRest';
import type { BackdropScene } from './types';

/**
 * Subtle seasonal backdrop for the top bar and the theme menu: a soft gradient plus a few slowly drifting particles
 * (petals, sun motes, leaves, snow). Halloween is a dusk (light) or night (dark) sky with twinkling stars instead.
 * The holiday scenes use the same layer: Easter pastel petals, Summer holidays sea and rising bubbles, Christmas snow,
 * New Year's Eve a night sky with twinkling stars, New Year a sunrise with falling confetti. The drift and the
 * twinkle run only at the Full animation level and only while the scene moves (`sceneRest.ts`; `data-season` marks it).
 * In the top bar (`bar`) the Fall, Winter and Christmas particles rest at their spots (`fallWinter.ts`) while the scene
 * is still, spread over the whole bar; when the moving ends they glide there in one second instead of jumping.
 */
const props = defineProps<{ season: BackdropScene; bar?: boolean }>();
const particles = Array.from({ length: 9 }, (_, i) => ({
  left: `${6 + i * 11}%`, top: `${6 + ((i * 37) % 46)}%`, delay: `${-(i * 1.3) % 7}s`, dur: `${7 + (i % 4) * 1.6}s`, size: `${5 + (i % 3) * 2}px`,
}));

/** How long the particles take to glide to their resting spots (owner, 2026-10-26). */
const GLIDE_MS = 1000;

const root = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(root);
const resting = computed(() => (props.season === 'fall' || props.season === 'winter' || props.season === 'christmas') && props.bar ? props.season : null);
/** The particles' resting styles while the scene is still (bottom-based, so a taller bar with a status bar keeps them by the controls). */
const spots = computed(() => {
  const s = resting.value;
  if (!s || !sceneStill.value) return null;
  // the bar's height changes with its header layout: read the layout again then
  void height.value;
  const layout = layoutFor(width.value, root.value?.closest('[data-testid="top-bar"]')?.getAttribute('data-layout') ?? undefined), bar = BAR[layout], k = particleScale(s);
  return STILL[s][layout].map(([x, y], i) => ({
    ...anchor(x, PARTICLE_SIZE[i], bar.w), top: 'auto', bottom: `${bar.h - y - PARTICLE_SIZE[i]}px`,
    transform: `rotate(${PARTICLE_TURN[i]}deg) scale(${k})`, opacity: 0.95,
  }));
});

const els = () => [...(root.value?.querySelectorAll<HTMLElement>('.p') ?? [])];
// only the resting Fall, Winter and Christmas particles are kept clear; the other seasons never watch the bar
const check = resting.value ? useClearOfControls(root, '.p', () => !!spots.value) : () => {};
let glides: Animation[] = [];
/** Where each particle was when the moving window ended (centre and opacity), until the glide starts. */
let from: { x: number; y: number; o: number }[] | null = null;
// the moving window just ended at Full: note where the drifting particles are, before the still picture is applied
watch(sceneStill, (still) => {
  from = null;
  if (!still || !resting.value || motionLevel.value !== 'full' || !root.value) return;
  from = els().map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, o: Number(getComputedStyle(el).opacity) }; });
}, { flush: 'sync' });
// once the resting spots are drawn: glide from the noted places to them; a new moving window cancels the glide
watch(spots, (now) => {
  glides.forEach((a) => a.cancel());
  glides = [];
  const start = now && motionLevel.value === 'full' ? from : null;
  from = null;
  if (!start || !root.value || typeof Element.prototype.animate !== 'function') return check();
  // screen offsets, applied inside the scene layer: a mirrored scene (left-handed) turns the horizontal one round
  const flip = Math.sign(new DOMMatrix(getComputedStyle(root.value.closest('.tbs') ?? root.value).transform).a) || 1;
  glides = els().map((el, i) => {
    const r = el.getBoundingClientRect(), f = start[i];
    const dx = (f.x - (r.left + r.width / 2)) * flip, dy = f.y - (r.top + r.height / 2);
    return el.animate([{ translate: `${dx}px ${dy}px`, opacity: f.o }, { translate: '0 0', opacity: 0.95 }], { duration: GLIDE_MS, easing: 'ease-out' });
  });
  void Promise.all(glides.map((a) => a.finished)).then(check, () => {});
}, { flush: 'post' });
</script>

<template>
  <div ref="root" class="season" :class="[season, { rest: spots }]" :data-season="season">
    <i v-for="(p, n) in particles" :key="n" class="p" :style="spots ? { ...spots[n], width: p.size, height: p.size } : { left: p.left, '--top': p.top, animationDelay: p.delay, animationDuration: p.dur, width: p.size, height: p.size }" />
  </div>
</template>

<style scoped>
.season { position: absolute; inset: 0; overflow: hidden; opacity: 0.9; }
.spring { background: linear-gradient(180deg, color-mix(in srgb, #f8bbd0 38%, transparent), transparent 80%); }
.summer { background: radial-gradient(circle at 88% -30%, color-mix(in srgb, #ffd54f 70%, transparent), transparent 60%); }
.fall { background: linear-gradient(180deg, color-mix(in srgb, #ff8f00 26%, transparent), transparent 85%); }
.winter { background: linear-gradient(180deg, color-mix(in srgb, #90caf9 30%, transparent), transparent 85%); }
/* dusk (light): violet sky into a warm horizon; night (dark): deep indigo with an ember glow low down */
.halloween { opacity: 1; background: linear-gradient(180deg, color-mix(in oklab, #7b5aa6 30%, transparent), color-mix(in oklab, #ff9d4d 30%, transparent)); }
html[data-theme='dark'] .halloween { background: linear-gradient(180deg, color-mix(in oklab, #1d1442 62%, transparent), color-mix(in oklab, #3a1f4f 40%, transparent) 70%, color-mix(in oklab, #ff7a1a 16%, transparent)); }
.easter { background: linear-gradient(180deg, color-mix(in srgb, #d1b3f0 36%, transparent), color-mix(in srgb, #fff3a8 22%, transparent) 85%); }
.summerholidays { background: linear-gradient(180deg, color-mix(in srgb, #8fd9ff 42%, transparent) 40%, color-mix(in srgb, #0097a7 40%, transparent) 78%); }
.christmas { background: linear-gradient(180deg, color-mix(in srgb, #1b5e3a 34%, transparent), color-mix(in srgb, #c62828 14%, transparent) 90%); }
/* New Year's Eve: always a night sky; the first of January: sunrise */
.newyearseve { opacity: 1; background: linear-gradient(180deg, color-mix(in oklab, #0b1030 70%, transparent), color-mix(in oklab, #3b2a6b 45%, transparent) 75%, color-mix(in oklab, #d4af37 18%, transparent)); }
.newyear { background: linear-gradient(180deg, color-mix(in srgb, #7fb8e8 36%, transparent), color-mix(in srgb, #ffb74d 38%, transparent) 90%); }
.p { position: absolute; top: -10px; opacity: 0.8; animation: drift 9s linear infinite; animation-play-state: paused; }
html[data-motion='full'] .p { animation-play-state: running; }
.spring .p { background: #f48fb1; border-radius: 80% 0 80% 0; }
.summer .p { background: #ffe082; border-radius: 50%; filter: blur(1px); animation-name: rise; top: auto; bottom: -10px; }
.fall .p { background: #e65100; border-radius: 0 80% 0 80%; }
.winter .p, .christmas .p { background: #fff; border-radius: 50%; }
/* at rest the white flakes get a thin blue-grey rim, so they show on the pale light bar */
html:not([data-theme='dark']) :is(.winter, .christmas).rest .p { box-shadow: 0 0 0 0.600px #9db3c9; }
.p[data-hidden] { visibility: hidden; }
.easter .p { background: #ffe082; border-radius: 80% 0 80% 0; }
.summerholidays .p { background: #e0f7fa; border-radius: 50%; animation-name: rise; top: auto; bottom: -10px; }
.newyear .p:nth-child(3n) { background: #ef5350; }
.newyear .p:nth-child(3n + 1) { background: #ffd54f; }
.newyear .p:nth-child(3n + 2) { background: #4fc3f7; }
.newyear .p { border-radius: 1px; }
.halloween .p, .newyearseve .p { top: var(--top); width: 2px !important; height: 2px !important; border-radius: 50%; background: color-mix(in oklab, #fff6d6 85%, var(--md-sys-color-primary, #e8650c)); box-shadow: 0 0 3px #fff6d6; opacity: 0.35; animation-name: twinkle; animation-timing-function: ease-in-out; animation-direction: alternate; }
html[data-theme='dark'] .halloween .p, .newyearseve .p { opacity: 0.9; }
.halloween .p:nth-child(3n), .newyearseve .p:nth-child(3n) { width: 3px !important; height: 3px !important; }
@keyframes drift { from { transform: translate(0, 0) rotate(0); } to { transform: translate(14px, 70px) rotate(240deg); opacity: 0; } }
@keyframes twinkle { from { opacity: 0.15; transform: scale(0.7); } to { opacity: 0.95; transform: scale(1.1); } }
@keyframes rise { from { transform: translateY(0); } to { transform: translateY(-60px); opacity: 0; } }
</style>
