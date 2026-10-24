/**
 * The "This task list / This and all following task lists" question of a repeating task list (feature tasklist-repeating,
 * owner 2026-10-24): renaming the list or adding, renaming or removing an item of a list with a `seriesId` asks first, as
 * Google asks for a repeating event. One question at a time per host; `RepeatScopeDialog` shows it while `asking` is set.
 */
import { ref } from 'vue';
import type { ChangeScope, TaskList } from '@/api/types';

/** Ask for the scope of a change, and answer the open question. */
export function useRepeatScope() {
  /** A question is open. */
  const asking = ref(false);
  let settle: ((s: ChangeScope | null) => void) | null = null;

  /** Resolves to the chosen scope, null when cancelled; a list that does not repeat is never asked (`this` at once). */
  function ask(list: TaskList | null | undefined): Promise<ChangeScope | null> {
    if (!list?.seriesId) return Promise.resolve('this');
    // a question still open is cancelled by the new one
    settle?.(null);
    asking.value = true;
    return new Promise((resolve) => { settle = resolve; });
  }

  /** The person answered (null = cancelled). */
  function answer(s: ChangeScope | null): void {
    const done = settle;
    settle = null;
    asking.value = false;
    done?.(s);
  }

  return { asking, ask, answer };
}
