import type { Component } from 'vue';
import MordorIntro from './MordorIntro.vue';
import SunflowerScene from './SunflowerScene.vue';
import type { SceneName } from './types';

/** Scene registry. Add a scene = add an entry (+ the name to SceneName). `none` renders nothing. */
export const scenes: Record<SceneName, Component | null> = {
  sunflowers: SunflowerScene,
  mordor: MordorIntro,
  none: null,
};
