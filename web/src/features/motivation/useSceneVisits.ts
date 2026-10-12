/**
 * Runs a scene visitor's rhythm (`butterflyVisits.ts`) inside a component: waits, starts a visit, ends it after the
 * rhythm's length and waits again. A change of animation level ends any visit and starts the wait afresh; at Off
 * nothing comes. All timers go through `appTimeout` and are cleared when the scope ends.
 */
import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useAnimationLevel, type MotionLevel } from '@/motion/level';
import { visitWait, type VisitRhythm } from './butterflyVisits';

/**
 * The current visit (whatever `start` made of it) or null between visits. `start` may return null to skip a visit;
 * `forced` asks for the next visit at once (the test hook).
 */
export function useSceneVisits<T>(rhythm: VisitRhythm, start: (level: MotionLevel) => T | null, forced: () => boolean = () => false): Ref<T | null> {
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
      schedule(false);
    }, rhythm.lengthMs);
  }

  watch(level, () => {
    visit.value = null;
    schedule(true);
  }, { immediate: true });
  onScopeDispose(cancel);
  return visit;
}
