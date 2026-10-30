import { defineAsyncComponent, defineComponent, h, type Component, type VNode } from 'vue';
import SunflowerScene from './SunflowerScene.vue';
import type { BackdropScene, SceneName } from './types';

/** The scene parts that are not in the main bundle. */
export interface ScenePieces { MordorIntro: Component; SceneLife: Component; SeasonScene: Component; ThemeOwnScene: Component }

/**
 * The themed scenes are lazy chunks: only the active scene is downloaded, so the first load carries none of the
 * holiday art. The sunflower scene (the default) stays in the main bundle.
 */
const lazyPieces: ScenePieces = {
  MordorIntro: defineAsyncComponent(() => import('./MordorIntro.vue')),
  SceneLife: defineAsyncComponent(() => import('./SceneLife.vue')),
  SeasonScene: defineAsyncComponent(() => import('./SeasonScene.vue')),
  ThemeOwnScene: defineAsyncComponent(() => import('./ThemeOwnScene.vue')),
};

/** A themed scene: its own backdrop plus the living layer (scene parts, butterflies and the cat) on top. */
const lively = (scene: Exclude<SceneName, 'sunflowers' | 'none' | 'custom'>, backdrop: () => VNode, { SceneLife }: ScenePieces): Component =>
  defineComponent({ name: `Scene-${scene}`, render: () => [backdrop(), h(SceneLife, { scene })] });

/**
 * Builds the scene registry from its pieces (unit tests pass the pieces eagerly so a mounted scene is complete at once).
 * Add a scene = add an entry (+ the name to SceneName). `none` renders nothing.
 */
export function buildScenes(p: ScenePieces): Record<SceneName, Component | null> {
  const season = (s: BackdropScene): Component => lively(s, () => h(p.SeasonScene, { season: s, bar: true }), p);
  return {
    sunflowers: SunflowerScene,
    mordor: lively('mordor', () => h(p.MordorIntro), p),
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
    custom: p.ThemeOwnScene,
    none: null,
  };
}

/** Scene registry. */
export const scenes = buildScenes(lazyPieces);
