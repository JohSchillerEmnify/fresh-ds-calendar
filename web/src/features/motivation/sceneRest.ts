/**
 * When the season and holiday scenes move (feature theme-scenes): for {@link SCENE_AWAKE_MS} after the app opens,
 * after it comes back from the background and after the scene changes, and only at the Full animation level. The rest
 * of the time they are a still picture that costs nothing: `useSceneRest` (in the shell) mirrors the state to
 * `html[data-scenes]` (`moving` | `still`), `styles.css` then removes every animation of the seasonal scenes (the
 * same picture as the Off level), and `useSceneVisits` sends no visitor and keeps no timer.
 */
import { computed, onScopeDispose, ref, watch } from 'vue';
import { appTimeout, useListener, type Disposer } from '@/lib/timers';
import { motionLevel } from '@/motion/level';

/** How long a seasonal scene moves after the app opens or comes back (ms). */
export const SCENE_AWAKE_MS = 10_000;

/** Within the moving window. True until a shell runs the clock, so a scene on its own (tests, Motion lab) moves as before. */
const awake = ref(true);

/** Whether the seasonal scenes rest as a still picture now (read-only). */
export const sceneStill = computed(() => !awake.value || motionLevel.value !== 'full');

/**
 * Runs the moving window in the shell: wakes now, when the app becomes visible again and when `scene` changes; rests
 * while the app is hidden. One timer at most, none once the scene is still.
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
    awake.value = true;
    timer = appTimeout(rest, SCENE_AWAKE_MS);
  };

  wake();
  // a phone app "opens" again when it comes back from the background
  useListener(document, 'visibilitychange', () => (document.hidden ? rest() : wake()));
  watch(scene, wake);
  watch(sceneStill, (still) => (document.documentElement.dataset.scenes = still ? 'still' : 'moving'), { immediate: true });
  onScopeDispose(() => {
    stop();
    awake.value = true;
    delete document.documentElement.dataset.scenes;
  });
}
