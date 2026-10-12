import { defineComponent, h, type Component, type VNode } from 'vue';
import MordorIntro from './MordorIntro.vue';
import SceneLife from './SceneLife.vue';
import SeasonScene from './SeasonScene.vue';
import SunflowerScene from './SunflowerScene.vue';
import type { SceneName } from './types';

/** A themed scene: its own backdrop plus the living layer (scene parts, butterflies and the cat) on top. */
const lively = (scene: 'spring' | 'summer' | 'fall' | 'winter' | 'halloween' | 'mordor', backdrop: () => VNode): Component =>
  defineComponent({ name: `Scene-${scene}`, render: () => [backdrop(), h(SceneLife, { scene })] });
const season = (s: 'spring' | 'summer' | 'fall' | 'winter' | 'halloween'): Component => lively(s, () => h(SeasonScene, { season: s }));

/** Scene registry. Add a scene = add an entry (+ the name to SceneName). `none` renders nothing. */
export const scenes: Record<SceneName, Component | null> = {
  sunflowers: SunflowerScene,
  mordor: lively('mordor', () => h(MordorIntro)),
  spring: season('spring'),
  summer: season('summer'),
  fall: season('fall'),
  winter: season('winter'),
  halloween: season('halloween'),
  none: null,
};
