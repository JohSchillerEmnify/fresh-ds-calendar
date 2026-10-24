/**
 * Runs a scene visitor inside a component. On a rhythm (`butterflyVisits.ts`, Mordor): waits, starts a visit, ends it
 * after the rhythm's length and waits again; a change of animation level ends any visit and starts the wait afresh.
 * A seasonal scene passes `rests` instead (see `sceneRest.ts`): its visitor passes once at the start of each moving
 * window and never again until the scene moves again; while it rests nothing comes and no timer runs. At Off nothing
 * comes. All timers go through `appTimeout` and are cleared when the scope ends.
 */
import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useAnimationLevel, type MotionLevel } from '@/motion/level';
import { visitWait, type VisitRhythm } from './butterflyVisits';

/**
 * The current visit (whatever `start` made of it) or null between visits. `start` may return null to skip a visit;
 * `forced` asks for the next visit at once (the test hook); `rests` (seasonal scenes) says the scene is at rest and
 * switches from the rhythm to one visit per moving window.
 */
export function useSceneVisits<T>(
  rhythm: VisitRhythm, start: (level: MotionLevel) => T | null, forced: () => boolean = () => false, rests?: () => boolean,
): Ref<T | null> {
  const visit = ref(null) as Ref<T | null>;
  const level = useAnimationLevel();
  let timer: Disposer | null = null;

  function cancel() {
    timer?.();
    timer = null;
  }

  function schedule(first: boolean) {
    cancel();
    if (level.value === 'off') return;
    const wait = visitWait(rhythm, first, forced(), Math.random());
    if (wait === 0) begin();
    else timer = appTimeout(begin, wait);
  }

  function begin() {
    const next = start(level.value);
    if (next === null) return;
    visit.value = next;
    timer = appTimeout(() => {
      visit.value = null;
      // a seasonal scene's visitor comes once per moving window
      if (rests) timer = null;
      else schedule(false);
    }, rhythm.lengthMs);
  }

  watch([level, () => rests?.()], () => {
    visit.value = null;
    cancel();
    if (!rests) schedule(true);
    else if (level.value !== 'off' && !rests()) begin();
  }, { immediate: true });
  onScopeDispose(cancel);
  return visit;
}
