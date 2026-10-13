<script setup lang="ts">
/**
 * The Halloween part of the living scene layer (ARCHITECTURE "Season scenes and the support cat"): a moon behind thin
 * clouds, a dark rolling hill, bare gnarled trees, jack-o'-lanterns with flickering candles, the pumpkin the cat sits
 * next to (`catLeft`, percent, is where `SceneLife` puts the cat) and, every 8–12 min for ~8 s, a small friendly
 * ghost floating past (the scene visitor scheduling of `useSceneVisits`; none at Off). Bats and the cat come from
 * `SceneLife`.
 */
import { GHOST_RHYTHM } from './butterflyVisits';
import BareTree from './BareTree.vue';
import JackOLantern from './JackOLantern.vue';
import SceneGhost from './SceneGhost.vue';
import SceneMoon from './SceneMoon.vue';
import { useSceneVisits } from './useSceneVisits';

defineProps<{ catLeft: number }>();

const LANTERNS = [
  { left: 16, face: 'smile', delay: 0, size: 'l-big' },
  { left: 63, face: 'grin', delay: 0.7, size: 'l-small' },
  { left: 89, face: 'smile', delay: 1.3, size: 'l-mid' },
] as const;

/** The ghost currently floating by, or null between visits. */
const ghost = useSceneVisits(GHOST_RHYTHM, (level) => ({ drift: level === 'full' ? ('float' as const) : ('fade' as const), x: Math.round(18 + Math.random() * 50) }));
</script>

<template>
  <div class="night" aria-hidden="true">
    <SceneMoon class="sky" />
    <SceneGhost v-if="ghost" :drift="ghost.drift" :x="ghost.x" />
    <svg class="hill" viewBox="0 0 400 16" preserveAspectRatio="none" focusable="false">
      <path d="M0 16 L0 9 C40 4.500 80 5.500 120 9 C160 12.500 200 7 250 6 C300 5 345 10.500 400 7.500 L400 16 Z" />
    </svg>
    <BareTree class="tree tall" eyes />
    <BareTree class="tree mid extra" style="left: 72%" mirrored />
    <JackOLantern v-for="(l, i) in LANTERNS" :key="i" :class="l.size" :style="{ left: `${l.left}%` }" :face="l.face" :delay="l.delay" />
    <JackOLantern class="pumpkin" :carved="false" :style="{ left: `calc(${catLeft}% - min(30cqh, 20px))` }" />
  </div>
</template>

<style scoped>
.night { position: absolute; inset: 0; pointer-events: none; }
.sky { position: absolute; right: 7%; top: 0; height: min(72cqh, 46px); width: auto; }
.hill { position: absolute; left: 0; bottom: 0; width: 100%; height: min(16cqh, 11px); }
.hill path { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 70%, var(--md-sys-color-primary, #e8650c)); }
html[data-theme='dark'] .hill path { fill: color-mix(in oklab, var(--md-sys-color-scrim, #000) 80%, var(--md-sys-color-tertiary, #7d5260)); }
.tree { position: absolute; bottom: 0; width: auto; }
.tall { left: -1%; height: min(84cqh, 60px); }
.tree.mid { height: min(64cqh, 46px); }
.l-big { height: min(40cqh, 27px); bottom: 0; }
.l-mid { height: min(34cqh, 23px); bottom: 1px; }
.l-small { height: min(29cqh, 19px); bottom: 2px; }
.pumpkin { height: min(27cqh, 18px); bottom: 0; }
@container (max-width: 520px) { .extra { display: none; } }
</style>
