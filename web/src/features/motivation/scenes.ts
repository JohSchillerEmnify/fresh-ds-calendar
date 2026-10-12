import { defineComponent, h, type Component } from 'vue';
import MordorIntro from './MordorIntro.vue';
import SeasonScene from './SeasonScene.vue';
import SunflowerScene from './SunflowerScene.vue';
import type { SceneName } from './types';

const season = (s: 'spring' | 'summer' | 'fall' | 'winter'): Component => defineComponent({ render: () => h(SeasonScene, { season: s }) });

/** Scene registry. Add a scene = add an entry (+ the name to SceneName). `none` renders nothing. */
export const scenes: Record<SceneName, Component | null> = {
  sunflowers: SunflowerScene,
  mordor: MordorIntro,
  spring: season('spring'),
  summer: season('summer'),
  fall: season('fall'),
  winter: season('winter'),
  none: null,
};
