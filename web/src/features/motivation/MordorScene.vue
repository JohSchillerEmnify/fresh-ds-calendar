<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { animate } from '@/motion/animate';
import { markEffect } from '@/motion/effects';
import { useAnimationLevel } from '@/motion/level';
import { springs } from '@/motion/spring';

/**
 * Original hand-made SVG: ash mountains, a Barad-dur-style tower silhouette, a flaming eye with a slit pupil.
 * Low contrast, pointer-events none. All motion is CSS and only when the level is Full (`data-animated`).
 * `intro` plays the eye-opening flare once (the parent decides "once per session").
 */
const props = defineProps<{ intro?: boolean }>();
const level = useAnimationLevel();
const eye = ref<SVGGElement | null>(null);
const glow = ref<SVGElement | null>(null);
let anims: Animation[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let fx: { end(): void } | null = null;

onMounted(() => {
  if (!props.intro || level.value !== 'full') return;
  const e = eye.value;
  if (!e) return;
  fx = markEffect('eye-open', e, 1200);
  const a = animate(e, [{ transform: 'scaleY(0.04)', opacity: 0.2 }, { transform: 'scaleY(1)', opacity: 1 }], { spring: springs.bouncy, reduced: 'skip' });
  const g = animate(glow.value, [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(2.4)', opacity: 0.95, offset: 0.35 }, { transform: 'scale(1)', opacity: 0.55 }], { duration: 1100, easing: 'ease-out', reduced: 'skip' });
  [a, g].forEach((x) => x && anims.push(x));
});
onBeforeUnmount(() => {
  anims.forEach((a) => a.cancel());
  if (timer) clearTimeout(timer);
  fx?.end();
});
</script>

<template>
  <div class="mo" data-testid="scene-mordor" aria-hidden="true" :data-animated="level === 'full'">
    <div class="mo-glow" />
    <svg class="mo-ash" viewBox="0 0 200 40" preserveAspectRatio="none" focusable="false">
      <path d="M0 40 V30 L10 24 L16 29 L28 14 L35 22 L44 18 L55 30 L66 20 L72 26 L86 10 L93 21 L104 17 L112 29 L125 19 L131 24 L146 8 L154 20 L163 16 L172 28 L184 17 L192 24 L200 18 V40Z" class="far" />
      <path d="M0 40 V34 L14 30 L22 35 L40 24 L50 32 L70 27 L82 34 L100 26 L116 35 L132 29 L150 36 L170 28 L186 34 L200 30 V40Z" class="near" />
    </svg>
    <svg class="mo-tower" data-part="mordor-tower" viewBox="0 -10 60 74" preserveAspectRatio="xMidYMax meet" focusable="false">
      <defs>
        <radialGradient id="mo-eye-g" cx="50%" cy="50%" r="55%">
          <stop offset="0" stop-color="#fff2a8" /><stop offset="0.45" stop-color="#ffa21a" /><stop offset="1" stop-color="#e5320f" />
        </radialGradient>
        <radialGradient id="mo-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#ff7a1a" stop-opacity="0.8" /><stop offset="1" stop-color="#ff3c0a" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle ref="glow" class="halo" cx="30" cy="12" r="20" fill="url(#mo-halo)" />
      <path class="body" d="M14 64 L19 50 L18 42 L22 38 L22 28 L25 25 L25 19 L29 17 L30 15 L31 17 L35 19 L35 25 L38 28 L38 38 L42 42 L41 50 L46 64Z" />
      <path class="spire" d="M22 38 L19 28 L24 33Z M38 38 L41 28 L36 33Z M18 48 L11 41 L20 44Z M42 48 L49 41 L40 44Z M25 25 L23 17 L27 22Z M35 25 L37 17 L33 22Z" />
      <path class="spire" d="M25 20 Q18 10 21 0 Q24 8 29 14Z M35 20 Q42 10 39 0 Q36 8 31 14Z" />
      <g ref="eye" class="eye" data-part="mordor-eye" data-testid="sauron-eye">
        <g class="flames"><path class="fl" d="M23 9 Q25 2 28 7 Q29 -2 31 6 Q33 -1 35 7 Q38 2 37 9 Q30 5 23 9Z" /></g>
        <path class="almond" d="M16 12 Q30 0 44 12 Q30 24 16 12Z" fill="url(#mo-eye-g)" />
        <g class="pupil-g"><ellipse class="pupil" cx="30" cy="12" rx="1.9" ry="8.6" /></g>
      </g>
    </svg>
    <div class="mo-embers"><i /><i /><i /><i /><i /><i /></div>
  </div>
</template>

<style scoped>
.mo { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.mo-glow { position: absolute; inset: auto 0 0 0; height: 100%; background: radial-gradient(ellipse 60% 90% at 72% 100%, rgba(255, 90, 20, 0.32), transparent 70%); }
.mo-ash { position: absolute; left: 0; bottom: 0; width: 100%; height: 62%; }
.mo-ash .far { fill: var(--md-sys-color-on-surface, #000); fill-opacity: 0.1; }
.mo-ash .near { fill: var(--md-sys-color-on-surface, #000); fill-opacity: 0.16; }
.mo-tower { position: absolute; right: 16%; bottom: 0; height: 100%; width: auto; aspect-ratio: 60 / 74; overflow: visible; }
.body { fill: var(--md-sys-color-on-surface, #000); fill-opacity: 0.34; }
.spire { fill: var(--md-sys-color-on-surface, #000); fill-opacity: 0.34; }
.halo { transform-box: fill-box; transform-origin: center; opacity: 0.55; }
.eye { transform-box: fill-box; transform-origin: 50% 50%; opacity: 0.88; }
.almond { filter: drop-shadow(0 0 2px rgba(255, 90, 20, 0.8)); }
.pupil { fill: #240500; }
.fl { fill: #ff7a1a; opacity: 0.8; }
.flames, .pupil-g { transform-box: fill-box; transform-origin: 50% 100%; }
.mo-embers i { position: absolute; bottom: 8%; width: 3px; height: 3px; border-radius: 50%; background: #ff9a3c; opacity: 0; }
.mo-embers i:nth-child(1) { left: 58%; } .mo-embers i:nth-child(2) { left: 64%; } .mo-embers i:nth-child(3) { left: 70%; }
.mo-embers i:nth-child(4) { left: 76%; } .mo-embers i:nth-child(5) { left: 82%; } .mo-embers i:nth-child(6) { left: 52%; }
/* static (Reduced / Off): a calm, readable frame */
.mo[data-animated='false'] .mo-embers { display: none; }
.mo[data-animated='true'] .eye { animation: mo-pulse 2.6s ease-in-out infinite alternate; }
.mo[data-animated='true'] .flames { animation: mo-flicker 0.9s steps(1) infinite; }
.mo[data-animated='true'] .pupil-g { animation: mo-glance 11s ease-in-out infinite; }
.mo[data-animated='true'] .halo { animation: mo-halo 2.6s ease-in-out infinite alternate; }
.mo[data-animated='true'] .mo-embers i { animation: mo-ember 5s linear infinite; }
.mo[data-animated='true'] .mo-embers i:nth-child(2) { animation-delay: -1.2s; animation-duration: 6s; }
.mo[data-animated='true'] .mo-embers i:nth-child(3) { animation-delay: -2.4s; }
.mo[data-animated='true'] .mo-embers i:nth-child(4) { animation-delay: -3.1s; animation-duration: 6.5s; }
.mo[data-animated='true'] .mo-embers i:nth-child(5) { animation-delay: -0.6s; animation-duration: 5.5s; }
.mo[data-animated='true'] .mo-embers i:nth-child(6) { animation-delay: -4s; }
@keyframes mo-pulse { from { opacity: 0.8; transform: scale(0.97); } to { opacity: 1; transform: scale(1.05); } }
@keyframes mo-halo { from { opacity: 0.4; transform: scale(0.95); } to { opacity: 0.7; transform: scale(1.12); } }
@keyframes mo-flicker { 0% { transform: scaleY(1) skewX(0); } 25% { transform: scaleY(1.18) skewX(-4deg); } 50% { transform: scaleY(0.9) skewX(3deg); } 75% { transform: scaleY(1.1) skewX(-2deg); } }
@keyframes mo-glance { 0%, 18% { transform: translateX(0); } 24%, 40% { transform: translateX(-5px); } 48%, 66% { transform: translateX(0); } 72%, 86% { transform: translateX(5px); } 94%, 100% { transform: translateX(0); } }
@keyframes mo-ember { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 12% { opacity: 0.85; } 100% { transform: translate(14px, -46px) scale(0.3); opacity: 0; } }
</style>
