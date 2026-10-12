<script setup lang="ts">
import ButterflyWings from './ButterflyWings.vue';
import LilyOfTheValley from './LilyOfTheValley.vue';
import SceneCat from './SceneCat.vue';
import SceneSun from './SceneSun.vue';
import SpringMeadow from './SpringMeadow.vue';
import SproutingTree from './SproutingTree.vue';
import SunflowerField from './SunflowerField.vue';

/**
 * The living layer of a themed top bar scene (ARCHITECTURE "Season scenes and the support cat"), drawn over the
 * scene's own backdrop: spring brings sprouting trees, lily of the valley and the first flowers in the grass, summer
 * a few sunflowers and a small sun; every scene has butterflies and one small cat. Parts carry `data-part`. Sizes
 * follow the bar height (container units), colours the theme tokens; motion follows `html[data-motion]`.
 */
type LifeScene = 'spring' | 'summer' | 'fall' | 'winter' | 'mordor';
defineProps<{ scene: LifeScene }>();

/** Summer is theme decoration, not the garden: a fixed handful of sunflowers whatever the motivation state. */
const SUMMER_SUNFLOWERS = 7;
/** Where the cat sits in each scene (percent from the left) and how far its loop is shifted. */
const CAT: Record<LifeScene, { left: number; delay: number }> = {
  spring: { left: 44, delay: 0 }, summer: { left: 33, delay: 6 }, fall: { left: 56, delay: 11 }, winter: { left: 40, delay: 15 }, mordor: { left: 47, delay: 20 },
};
/** Two butterflies, each wandering its own loop from its own start. */
const BUTTERFLIES = [
  { x: '8cqw', dur: '17s', delay: '-3s', tint: 'a' },
  { x: '52cqw', dur: '21s', delay: '-11s', tint: 'b' },
];
</script>

<template>
  <div class="life" :data-life="scene" aria-hidden="true">
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
    <span v-for="(b, i) in BUTTERFLIES" :key="i" class="flutter" :class="b.tint" data-part="butterfly" :style="{ '--x0': b.x, animationDuration: b.dur, animationDelay: b.delay }">
      <span class="bob" :style="{ animationDelay: b.delay }"><ButterflyWings /></span>
    </span>
    <SceneCat class="at cat" :style="{ left: `${CAT[scene].left}%` }" :delay="CAT[scene].delay" />
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

/* ambient butterflies: wander a loop across the bar at Full, rest where they are otherwise */
.flutter { position: absolute; left: 0; top: 0; width: 18px; animation: life-wander 18s ease-in-out infinite; animation-play-state: paused; translate: var(--x0) 40cqh; }
.flutter.b { --bw-wing: color-mix(in oklab, #ffc83d 70%, var(--md-sys-color-tertiary, #b5486f)); --bw-lower: color-mix(in oklab, #ff9a3d 60%, var(--md-sys-color-primary, #6750a4)); }
.bob { display: block; animation: life-bob 1.300s ease-in-out infinite alternate; animation-play-state: paused; }
.bob :deep(.bw) { width: 100%; height: auto; }
html[data-motion='full'] .flutter, html[data-motion='full'] .bob { animation-play-state: running; }
@keyframes life-wander {
  0%, 100% { translate: var(--x0) 55cqh; }
  20% { translate: calc(var(--x0) + 12cqw) 12cqh; }
  40% { translate: calc(var(--x0) + 30cqw) 38cqh; }
  55% { translate: calc(var(--x0) + 38cqw) 8cqh; }
  75% { translate: calc(var(--x0) + 20cqw) 62cqh; }
}
@keyframes life-bob { from { transform: translateY(-2px) rotate(-8deg); } to { transform: translateY(2px) rotate(8deg); } }
</style>
