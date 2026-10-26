<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useClockStore } from '@/stores/clock';
import { BUTTERFLY_RHYTHM, butterflyFlight, forcedButterfly } from './butterflyVisits';
import BatWings from './BatWings.vue';
import BeachScene from './BeachScene.vue';
import ChristmasNight from './ChristmasNight.vue';
import EasterScene from './EasterScene.vue';
import FallWinterScene from './FallWinterScene.vue';
import { anchor, BAR, CAT_X, catHeight, layoutFor } from './fallWinter';
import ButterflyWings from './ButterflyWings.vue';
import HalloweenNight from './HalloweenNight.vue';
import LilyOfTheValley from './LilyOfTheValley.vue';
import NewYearMorning from './NewYearMorning.vue';
import NewYearsEveNight from './NewYearsEveNight.vue';
import SceneCat from './SceneCat.vue';
import SceneSun from './SceneSun.vue';
import SpringMeadow from './SpringMeadow.vue';
import SproutingTree from './SproutingTree.vue';
import SunflowerField from './SunflowerField.vue';
import { halloweenVisitor, sceneStill } from './sceneRest';
import { useSceneVisits } from './useSceneVisits';

/**
 * The living layer of a themed top bar scene (feature theme-scenes), drawn over the
 * scene's own backdrop: spring brings sprouting trees, lily of the valley and the first flowers in the grass, summer
 * a few sunflowers and a small sun, Halloween its night (moon, bare trees, jack-o'-lanterns, now and then a ghost);
 * the holiday scenes bring eggs and a hare (Easter), sea and umbrella (Summer holidays), an Advent candle timeline ending in the tree
 * (Christmas), fireworks (New Year's Eve) and a sunrise (New Year); Fall and Winter their trees, leaf piles, kite, snowman
 * and sledge (`FallWinterScene`). Every scene has one small cat and a visiting
 * butterfly (at Halloween the bat or the ghost, in Fall a flock of birds, in Winter a robin; none at Christmas, New Year's Eve and New Year): in the seasonal scenes
 * it passes once while the scene moves, at Mordor on its rhythm. Parts carry `data-part`.
 * Sizes follow the bar height (container units), colours the theme tokens; motion follows `html[data-motion]`, and
 * the seasonal scenes rest as a still picture after their first ten seconds (`sceneRest.ts`; `data-life` marks the layer).
 */
type LifeScene = 'spring' | 'summer' | 'fall' | 'winter' | 'mordor' | 'halloween' | 'easter' | 'summerholidays' | 'christmas' | 'newyearseve' | 'newyear';
const props = defineProps<{ scene: LifeScene }>();

/** Summer is theme decoration, not the garden: a fixed handful of sunflowers whatever the motivation state. */
const SUMMER_SUNFLOWERS = 7;
/** Where the cat sits in each scene (percent from the left) and how far its loop is shifted. */
const CAT: Record<LifeScene, { left: number; delay: number }> = {
  spring: { left: 44, delay: 0 }, summer: { left: 33, delay: 6 }, fall: { left: 56, delay: 11 }, winter: { left: 40, delay: 15 },
  mordor: { left: 47, delay: 20 }, halloween: { left: 45, delay: 3 },
  easter: { left: 40, delay: 8 }, summerholidays: { left: 50, delay: 13 }, christmas: { left: 60, delay: 5 }, newyearseve: { left: 52, delay: 9 }, newyear: { left: 30, delay: 17 },
};

/** The scenes without a visiting butterfly: the winter holidays (snow, night, early morning); Fall and Winter have their own visitors. */
const NO_FLYER: LifeScene[] = ['fall', 'winter', 'christmas', 'newyearseve', 'newyear'];
const clock = useClockStore();
/** The butterfly (or bat) currently visiting, one at a time, or null between visits. */
const visit = useSceneVisits(
  BUTTERFLY_RHYTHM,
  (level) => {
    // at Halloween the bat comes only when it is the bat's turn (otherwise the ghost passes, HalloweenNight)
    const none = NO_FLYER.includes(props.scene) || (props.scene === 'halloween' && halloweenVisitor(forcedButterfly(clock.config.testMode)) !== 'bat');
    const flight = none ? null : butterflyFlight(level, Math.random());
    return flight && { flight, restX: Math.round(15 + Math.random() * 65), tint: Math.random() < 0.5 ? ('a' as const) : ('b' as const) };
  },
  {
    forced: () => forcedButterfly(clock.config.testMode),
    // Mordor is not a seasonal scene: its butterfly keeps its rhythm; the seasonal ones pass once per moving window
    rests: props.scene === 'mordor' ? undefined : () => sceneStill.value,
  },
);
/** At Halloween bats come instead of butterflies (same rhythm, same test hook). */
const flyer = props.scene === 'halloween' ? 'bat' : 'butterfly';

/** The bar layout Fall and Winter place their parts for, from the layer's width. */
const root = ref<HTMLElement | null>(null);
const { width } = useElementSize(root);
const layout = computed(() => layoutFor(width.value));
/** Where the cat sits: at its Fall / Winter spot, elsewhere at its percentage. */
const catStyle = computed(() => {
  if (props.scene !== 'fall' && props.scene !== 'winter') return { left: `${CAT[props.scene].left}%` };
  // a fixed height (not the bar's), so the kite's string meets the paw in a taller bar too (a status bar above it)
  const bar = BAR[layout.value], h = catHeight(bar.h);
  return { ...anchor(CAT_X[props.scene][layout.value], h, bar.w), height: `${h}px` };
});
</script>

<template>
  <div ref="root" class="life" :data-life="scene" aria-hidden="true">
    <template v-if="scene === 'spring'">
      <SpringMeadow />
      <SproutingTree class="at tall" style="left: 2%" />
      <SproutingTree class="at mid extra" style="left: 66%" mirrored />
      <LilyOfTheValley class="at short" style="left: 20%" />
      <LilyOfTheValley class="at short" style="left: 85%" mirrored />
    </template>
    <template v-else-if="scene === 'summer'">
      <SceneSun class="at-sky" />
      <SunflowerField :flowers="SUMMER_SUNFLOWERS" />
    </template>
    <HalloweenNight v-else-if="scene === 'halloween'" :cat-left="CAT.halloween.left" />
    <EasterScene v-else-if="scene === 'easter'" />
    <BeachScene v-else-if="scene === 'summerholidays'" />
    <ChristmasNight v-else-if="scene === 'christmas'" />
    <NewYearsEveNight v-else-if="scene === 'newyearseve'" />
    <NewYearMorning v-else-if="scene === 'newyear'" />
    <FallWinterScene v-else-if="scene === 'fall' || scene === 'winter'" :scene="scene" :layout="layout" />
    <span v-if="visit" class="flutter" :class="[visit.tint, visit.flight, flyer]" :data-part="flyer" :style="{ '--rest-x': `${visit.restX}cqw` }">
      <span class="bob"><BatWings v-if="flyer === 'bat'" /><ButterflyWings v-else /></span>
    </span>
    <SceneCat class="at cat" :style="catStyle" :delay="CAT[scene].delay" />
  </div>
</template>

<style scoped>
.life { position: absolute; inset: 0; overflow: hidden; pointer-events: none; container-type: size; }
.at { position: absolute; bottom: 0; width: auto; }
.tall { height: min(78cqh, 58px); }
.mid { height: min(62cqh, 46px); }
.short { height: min(52cqh, 38px); }
.cat { height: min(44cqh, 30px); bottom: -1px; }
.at-sky { position: absolute; right: 13%; top: -10%; height: min(62cqh, 40px); width: auto; }
@container (max-width: 520px) { .extra { display: none; } }

/* the visiting butterfly (~10 s): Full flutters through (sometimes resting on a flower), Reduced only rests in place.
   Longhands, not `animation: 10s …`: the build's minifier turns a shorthand without a name into `animation: none`. */
.flutter { position: absolute; left: 0; top: 0; width: 18px; animation-duration: 10s; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.flutter.b { --bw-wing: color-mix(in oklab, #ffc83d 70%, var(--md-sys-color-tertiary, #b5486f)); --bw-lower: color-mix(in oklab, #ff9a3d 60%, var(--md-sys-color-primary, #6750a4)); }
.flutter.fly { animation-name: life-fly; }
.flutter.fly-rest { animation-name: life-fly-rest; }
.flutter.rest { animation-name: life-rest; translate: var(--rest-x) var(--rest-y, 52cqh); }
.bob { display: block; animation: life-bob 1.300s ease-in-out infinite alternate; }
.rest .bob { animation: none; }
.bob :deep(:is(.bw, .batfig)) { width: 100%; height: auto; }
/* bats are a little bigger, fly a bumpier line and hover high (they never land on a flower) */
.flutter.bat { width: 24px; --rest-y: 14cqh; }
.bat .bob { animation: life-bat-bob 0.45s ease-in-out infinite alternate; }
.bat.rest .bob { animation: life-bat-bob 1.6s ease-in-out infinite alternate; }
@keyframes life-bat-bob { from { transform: translateY(-3px) rotate(-10deg); } to { transform: translateY(2px) rotate(6deg); } }
@keyframes life-fly {
  0% { translate: -24px 50cqh; }
  25% { translate: 22cqw 14cqh; }
  50% { translate: 48cqw 46cqh; }
  75% { translate: 74cqw 10cqh; }
  100% { translate: calc(100cqw + 24px) 36cqh; }
}
@keyframes life-fly-rest {
  0% { translate: -24px 40cqh; }
  20% { translate: calc(var(--rest-x) / 2) 12cqh; }
  35%, 65% { translate: var(--rest-x) var(--rest-y, 52cqh); }
  85% { translate: calc((var(--rest-x) + 100cqw) / 2) 10cqh; }
  100% { translate: calc(100cqw + 24px) 30cqh; }
}
@keyframes life-rest { 0%, 100% { opacity: 0; } 12%, 88% { opacity: 1; } }
@keyframes life-bob { from { transform: translateY(-2px) rotate(-8deg); } to { transform: translateY(2px) rotate(8deg); } }
</style>
