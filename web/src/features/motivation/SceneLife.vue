<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { useAnimationLevel } from '@/motion/level';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useClockStore } from '@/stores/clock';
import { BUTTERFLY_VISIT_MS, butterflyFlight, butterflyWait, forcedButterfly, type ButterflyFlight } from './butterflyVisits';
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
 * a few sunflowers and a small sun; every scene has one small cat and, now and then, a visiting butterfly. Parts carry `data-part`. Sizes
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

/** The butterfly currently visiting (one at a time), or null between visits. */
const visit = ref<{ flight: ButterflyFlight; restX: number; tint: 'a' | 'b' } | null>(null);
const level = useAnimationLevel();
const clock = useClockStore();
let timer: Disposer | null = null;

function cancel() {
  timer?.();
  timer = null;
}

/** Waits for the next visit (the first one counts from the scene appearing); Off has none. */
function schedule(first: boolean) {
  cancel();
  if (level.value === 'off') return;
  const wait = butterflyWait(first, forcedButterfly(clock.config.testMode), Math.random());
  if (wait === 0) startVisit();
  else timer = appTimeout(startVisit, wait);
}

function startVisit() {
  const flight = butterflyFlight(level.value, Math.random());
  if (!flight) return;
  visit.value = { flight, restX: Math.round(15 + Math.random() * 65), tint: Math.random() < 0.5 ? 'a' : 'b' };
  timer = appTimeout(() => {
    visit.value = null;
    schedule(false);
  }, BUTTERFLY_VISIT_MS);
}

// a level change ends any visit and starts the wait afresh (Off: no butterflies at all)
watch(level, () => {
  visit.value = null;
  schedule(true);
}, { immediate: true });
onScopeDispose(cancel);
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
    <span v-if="visit" class="flutter" :class="[visit.tint, visit.flight]" data-part="butterfly" :style="{ '--rest-x': `${visit.restX}cqw` }">
      <span class="bob"><ButterflyWings /></span>
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

/* the visiting butterfly (~10 s): Full flutters through (sometimes resting on a flower), Reduced only rests in place */
.flutter { position: absolute; left: 0; top: 0; width: 18px; animation: 10s ease-in-out both; }
.flutter.b { --bw-wing: color-mix(in oklab, #ffc83d 70%, var(--md-sys-color-tertiary, #b5486f)); --bw-lower: color-mix(in oklab, #ff9a3d 60%, var(--md-sys-color-primary, #6750a4)); }
.flutter.fly { animation-name: life-fly; }
.flutter.fly-rest { animation-name: life-fly-rest; }
.flutter.rest { animation-name: life-rest; translate: var(--rest-x) 52cqh; }
.bob { display: block; animation: life-bob 1.300s ease-in-out infinite alternate; }
.rest .bob { animation: none; }
.bob :deep(.bw) { width: 100%; height: auto; }
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
  35%, 65% { translate: var(--rest-x) 52cqh; }
  85% { translate: calc((var(--rest-x) + 100cqw) / 2) 10cqh; }
  100% { translate: calc(100cqw + 24px) 30cqh; }
}
@keyframes life-rest { 0%, 100% { opacity: 0; } 12%, 88% { opacity: 1; } }
@keyframes life-bob { from { transform: translateY(-2px) rotate(-8deg); } to { transform: translateY(2px) rotate(8deg); } }
</style>
