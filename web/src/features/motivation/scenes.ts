import { defineComponent, h, type Component, type VNode } from 'vue';
import MordorIntro from './MordorIntro.vue';
import SceneLife from './SceneLife.vue';
import SeasonScene from './SeasonScene.vue';
import SunflowerScene from './SunflowerScene.vue';
import ThemeOwnScene from './ThemeOwnScene.vue';
import type { BackdropScene, SceneName } from './types';

/** A themed scene: its own backdrop plus the living layer (scene parts, butterflies and the cat) on top. */
const lively = (scene: Exclude<SceneName, 'sunflowers' | 'none' | 'custom'>, backdrop: () => VNode): Component =>
  defineComponent({ name: `Scene-${scene}`, render: () => [backdrop(), h(SceneLife, { scene })] });
const season = (s: BackdropScene): Component => lively(s, () => h(SeasonScene, { season: s }));

/** Scene registry. Add a scene = add an entry (+ the name to SceneName). `none` renders nothing. */
export const scenes: Record<SceneName, Component | null> = {
  sunflowers: SunflowerScene,
  mordor: lively('mordor', () => h(MordorIntro)),
  spring: season('spring'),
  summer: season('summer'),
  fall: season('fall'),
  winter: season('winter'),
  halloween: season('halloween'),
  easter: season('easter'),
  summerholidays: season('summerholidays'),
  christmas: season('christmas'),
  newyearseve: season('newyearseve'),
  newyear: season('newyear'),
  custom: ThemeOwnScene,
  none: null,
};
