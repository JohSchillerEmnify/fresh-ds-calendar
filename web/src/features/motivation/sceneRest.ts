/**
 * When the season and holiday scenes move (feature theme-scenes): for {@link SCENE_AWAKE_MS} after the app opens,
 * after it comes back from the background and after the scene changes, and only at the Full animation level. The rest
 * of the time they are a still picture that costs nothing: `useSceneRest` (in the shell) mirrors the state to
 * `html[data-scenes]` (`moving` | `still`), `styles.css` then removes every animation of the seasonal scenes (the
 * same picture as the Off level), and `useSceneVisits` sends no visitor and keeps no timer. A visitor passes once at
 * the start of each moving window.
 */
import { computed, onScopeDispose, ref, watch } from 'vue';
import { appTimeout, useListener, type Disposer } from '@/lib/timers';
import { motionLevel } from '@/motion/level';

/** How long a seasonal scene moves after the app opens or comes back (ms). */
export const SCENE_AWAKE_MS = 10_000;

/** Within the moving window. True until the shell runs the clock, so a scene mounted without it (unit tests) moves as before. */
const awake = ref(true);

/** Whether the seasonal scenes rest as a still picture now (read-only). */
export const sceneStill = computed(() => !awake.value || motionLevel.value !== 'full');

/** Rolled at each wake: which visitor the Halloween scene sends in this moving window. */
const roll = ref(0);

/**
 * The Halloween visitor of the current moving window: the bat or the little ghost, half the time each. The test hook
 * (`forced`) always brings the bat.
 */
export function halloweenVisitor(forced: boolean): 'bat' | 'ghost' {
  return forced || roll.value < 0.5 ? 'bat' : 'ghost';
}

/**
 * Runs the moving window in the shell: opens it now, when the app becomes visible again, when `scene` changes and when
 * the animation level becomes Full; rests while the app is hidden and below Full. One timer at most, and only at Full
 * while visible; none once the scene is still.
 *
 * @param scene - The effective top bar scene; a change plays the new scene's ten seconds.
 */
export function useSceneRest(scene: () => unknown): void {
  let timer: Disposer | null = null;
  const stop = () => {
    timer?.();
    timer = null;
  };
  const rest = () => {
    stop();
    awake.value = false;
  };
  const wake = () => {
    stop();
    roll.value = Math.random();
    awake.value = true;
    timer = appTimeout(rest, SCENE_AWAKE_MS);
  };

  // a hidden app or a level below Full never starts the window (and so never a timer)
  const open = () => (document.hidden || motionLevel.value !== 'full' ? rest() : wake());

  open();
  // a phone app "opens" again when it comes back from the background
  useListener(document, 'visibilitychange', open);
  watch(scene, open);
  watch(motionLevel, open);
  watch(sceneStill, (still) => (document.documentElement.dataset.scenes = still ? 'still' : 'moving'), { immediate: true });
  onScopeDispose(() => {
    stop();
    awake.value = true;
    delete document.documentElement.dataset.scenes;
  });
}
