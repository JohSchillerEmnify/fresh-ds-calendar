/**
 * The "This task list / This and all following task lists" question of a repeating task list (feature tasklist-repeating):
 * renaming the list or adding, renaming or removing an item of a list with a `seriesId` asks first, as
 * Google asks for a repeating event. A changed rhythm asks "this and all following / all" instead (`question`).
 * One question at a time per host; `RepeatScopeDialog` shows it while `asking` is set.
 */
import { ref } from 'vue';
import type { ChangeScope, TaskList } from '@/api/types';
import type { RuleQuestion } from './repeatChange';

/** Ask for the scope of a change, and answer the open question. */
export function useRepeatScope() {
  /** A question is open. */
  const asking = ref(false);
  /** Set while the question is about how the list repeats. */
  const question = ref<RuleQuestion | null>(null);
  let settle: ((s: ChangeScope | null) => void) | null = null;

  /** Resolves to the chosen scope, null when cancelled; a list that does not repeat is never asked (`this` at once). */
  function ask(list: TaskList | null | undefined, rule?: RuleQuestion): Promise<ChangeScope | null> {
    if (!list?.seriesId) return Promise.resolve('this');
    // a question still open is cancelled by the new one
    settle?.(null);
    question.value = rule ?? null;
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

  return { asking, question, ask, answer };
}
