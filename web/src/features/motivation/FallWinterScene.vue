<script setup lang="ts">
/**
 * The Fall and Winter part of the living scene layer (feature theme-scenes, round 3 mockups approved 2026-10-26). Fall:
 * a leaf-strewn ground across the whole bar, autumn trees, leaf piles and the cat's kite on a string to its paw (the
 * kite sways while the scene moves). Winter: a snow drift across the whole bar, snowy trees, a snowman and a sledge.
 * While the scene moves its visitor comes once: a flock of three birds flies across (Fall), a robin hops onto the
 * sledge (Winter). The spots per bar layout come from `fallWinter.ts`; a prop that would land under a control is left
 * out (`clearOfControls.ts`). The cat itself comes from `SceneLife`, at {@link CAT_X}.
 */
import { computed, ref, watch } from 'vue';
import { BUTTERFLY_RHYTHM } from './butterflyVisits';
import { useClearOfControls } from './clearOfControls';
import FallWinterProp from './FallWinterProp.vue';
import { anchor, BAR, CAT_X, catHeight, FLOCK_Y, KITE, PROPS, propWidth, ROBIN_X, type SceneLayout } from './fallWinter';
import { sceneStill } from './sceneRest';
import { useSceneVisits } from './useSceneVisits';

const props = defineProps<{ scene: 'fall' | 'winter'; layout: SceneLayout }>();

const bar = computed(() => BAR[props.layout]);
const items = computed(() => PROPS[props.scene][props.layout].map((p) => ({ ...p, style: { ...anchor(p.x, propWidth(p), bar.value.w, p.side), height: `${p.h}px` } })));

/** A box given by its left edge in mockup px, placed from the same side as the cat (so the string always meets its paw). */
function besideCat(left: number, width: number) {
  const cat = CAT_X.fall[props.layout], cw = catHeight(bar.value.h);
  return 'left' in anchor(cat, cw, bar.value.w) ? { left: `${left}px` } : { right: `${Math.round((bar.value.w - left - width) * 10) / 10}px` };
}

/** The kite (16 x 20, tail below) and its string from the bridle down to the cat's front paw, in px from the bar's bottom. */
const kite = computed(() => {
  const { h } = bar.value, k = KITE[props.layout], ch = catHeight(h);
  const paw = { x: CAT_X.fall[props.layout] + 0.66 * ch, up: 0.28 * ch - 1 };
  const bridle = { x: k.x + 8, up: h - k.y - 10 };
  return {
    fig: { ...besideCat(k.x, 16), bottom: `${h - k.y - 20}px` },
    string: { ...besideCat(paw.x, bridle.x - paw.x), width: `${bridle.x - paw.x}px`, bottom: `${paw.up}px`, height: `${bridle.up - paw.up}px` },
  };
});

const flock = computed(() => ({ bottom: `${bar.value.h - FLOCK_Y[props.layout] - 12}px` }));
const robin = computed(() => ({ ...anchor(ROBIN_X[props.layout], 17, bar.value.w), bottom: '8px' }));

/** The visitor of the moving window: once per window, never while the scene rests. */
const visit = useSceneVisits(BUTTERFLY_RHYTHM, () => true, { rests: () => sceneStill.value });

const root = ref<HTMLElement | null>(null);
const check = useClearOfControls(root, '.fwp, .kite-fig');
// another layout draws other props: measure them once they are drawn
watch(() => props.layout, check, { flush: 'post' });
</script>

<template>
  <div ref="root" class="fw" aria-hidden="true">
    <svg v-if="scene === 'fall'" class="ground litter" data-part="leaf-litter" viewBox="0 0 200 8" preserveAspectRatio="none" focusable="false">
      <path d="M0 8 C14 4.600 30 3.400 60 3.200 C100 3 140 3.400 170 3.300 C186 3.400 194 5 200 8 Z" />
    </svg>
    <svg v-else class="ground drift" data-part="snow-drift" viewBox="0 0 200 12" preserveAspectRatio="none" focusable="false">
      <path class="snow" d="M0 12 C18 9 34 5.500 60 4.600 C90 3.800 110 6 140 5 C166 4.200 184 8 200 12 Z" />
      <path class="rim" d="M0 12 C18 9 34 5.500 60 4.600 C90 3.800 110 6 140 5 C166 4.200 184 8 200 12" />
    </svg>
    <FallWinterProp v-for="(p, i) in items" :key="`${layout}-${i}`" :kind="p.kind" :h="p.h" :style="p.style" />
    <template v-if="scene === 'fall'">
      <svg class="kite-fig" data-part="kite" data-line=".kite-string path" viewBox="0 0 16 20" :style="kite.fig" focusable="false">
        <g class="sway">
          <path class="k-tail" d="M8 20 C5 23 11 26 8 29 C5 32 10 34 8 37" />
          <path class="k-bow" d="M6.400 24.400 L9.600 25.800 L9.600 23.200 L6.400 24.600 Z M6.200 31.200 L9.400 32.400 L9.400 30 L6.200 31.400 Z" />
          <path class="k-a" d="M8 0 L16 7 L8 20 Z" /><path class="k-b" d="M8 0 L0 7 L8 20 Z" />
          <path class="k-spar" d="M8 0 L8 20 M0 7 L16 7" />
        </g>
      </svg>
      <svg class="kite-string" viewBox="0 0 100 100" preserveAspectRatio="none" :style="kite.string" focusable="false">
        <path d="M0 100 Q58 62 100 0" />
      </svg>
      <svg v-if="visit" class="flock" data-part="bird-flock" viewBox="0 0 30 12" :style="flock" focusable="false">
        <path d="M1 7 Q3.800 3.600 6.600 6.800 Q9.400 3.600 12.200 7" /><path d="M11 3.400 Q13.400 0.600 15.800 3.200 Q18.200 0.600 20.600 3.400" /><path d="M18.400 10 Q21 7 23.600 9.800 Q26.200 7 28.800 10" />
      </svg>
    </template>
    <svg v-else-if="visit" class="robin" data-part="robin" viewBox="0 0 17 15" :style="robin" focusable="false">
      <path class="r-body" d="M3.600 7 L0.400 4.400 L1 8.800 Z" /><ellipse class="r-body" cx="8" cy="8.200" rx="5.600" ry="4.600" /><circle class="r-body" cx="12.400" cy="5" r="3.200" />
      <ellipse class="r-breast" cx="11.200" cy="8.400" rx="3.300" ry="3.600" /><path class="r-beak" d="M15.400 4.600 L17 5.400 L15.400 6.200 Z" />
      <circle class="r-eye" cx="13.300" cy="4.300" r="0.650" /><path class="r-leg" d="M7.600 12.400 L7.200 15 M9.600 12.400 L9.800 15" />
    </svg>
  </div>
</template>

<style scoped>
.fw { position: absolute; inset: 0; pointer-events: none; }
[data-hidden], .kite-fig[data-hidden] ~ .kite-string { visibility: hidden; }
.ground { position: absolute; left: 0; bottom: 0; width: 100%; }
.litter { height: 6px; }
.litter path { fill: #9a5224; }
html[data-theme='dark'] .litter path { fill: #6e3a1a; }
.drift { height: 12px; }
.drift .snow { fill: #e2ebf5; }
.drift .rim { fill: none; stroke: #93aac2; stroke-width: 1; vector-effect: non-scaling-stroke; }
html[data-theme='dark'] .drift .snow { fill: #dfe8f2; }
html[data-theme='dark'] .drift .rim { stroke: #fff; }

/* the kite hangs from the sky on its string; only the kite sways (about its bridle), and only while the scene moves */
.kite-fig { position: absolute; z-index: 1; width: 16px; height: 20px; overflow: visible; }
.sway { transform-origin: 8px 10px; animation: kite-sway 2.600s ease-in-out infinite alternate; animation-play-state: paused; }
html[data-motion='full'] .sway { animation-play-state: running; }
.k-a { fill: #e2552a; }
.k-b, .k-bow { fill: #f6bd3b; }
.k-spar { fill: none; stroke: #7a4a1e; stroke-width: 0.800; }
.k-tail { fill: none; stroke: #e2552a; stroke-width: 0.800; }
.kite-string { position: absolute; overflow: visible; }
.kite-string path { fill: none; stroke: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 55%, transparent); stroke-width: 0.700; vector-effect: non-scaling-stroke; }
@keyframes kite-sway { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }

/* the visitors (~10 s, once per moving window). Longhands: the minifier drops a shorthand without a name. */
.flock { position: absolute; left: 0; height: 12px; width: 30px; animation-name: flock-fly; animation-duration: 10s; animation-timing-function: linear; animation-fill-mode: both; }
.flock path { fill: none; stroke: color-mix(in oklab, var(--md-sys-color-on-surface, #1d1b20) 80%, #5a3a20); stroke-width: 1.300; stroke-linecap: round; stroke-linejoin: round; transform-box: fill-box; transform-origin: center; animation: flock-flap 0.700s ease-in-out infinite alternate; }
.flock path:nth-child(2) { animation-delay: -0.300s; }
.flock path:nth-child(3) { animation-delay: -0.500s; }
@keyframes flock-fly {
  0% { translate: -40px 6px; }
  50% { translate: 50cqw -4px; }
  100% { translate: calc(100cqw + 40px) 4px; }
}
@keyframes flock-flap { from { transform: scaleY(1); } to { transform: scaleY(0.45); } }
.robin { position: absolute; height: 15px; width: 17px; animation-name: robin-visit; animation-duration: 10s; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.r-body { fill: #6b4f3a; }
html[data-theme='dark'] .r-body { fill: #8a6a50; }
.r-breast { fill: #e8662a; }
.r-beak { fill: #d9a63a; }
.r-eye { fill: #111; }
.r-leg { fill: none; stroke: #4a3a2e; stroke-width: 0.700; }
/* hops in from the right, pecks about on the sledge, flies off to the left */
@keyframes robin-visit {
  0% { opacity: 0; translate: 26px -14px; }
  10% { opacity: 1; translate: 0 0; }
  40% { translate: 0 0; }
  44% { translate: -3px -3px; }
  48%, 84% { translate: -4px 0; }
  100% { opacity: 0; translate: -36px -18px; }
}
</style>
