/** The question before a repeat rhythm changes (feature tasklist-repeating): the choices Google offers, and the lists lost. */
import type { Recurrence, TaskList } from '@/api/types';

/** The choices (`following` = this and all following lists, `all`) and the lists lost by each, as this device knows them. */
export interface RuleQuestion {
  options: ('following' | 'all')[];
  lost: { following: number; all: number };
}

const textOf = (l: TaskList): string => JSON.stringify([l.title, l.items.map((i) => i.title)]);

/** Lists of the same list from `from` on (after `from`, unless `inclusive`) that were ticked or edited on their own, next to `shown`. */
function changedOnTheirOwn(shown: TaskList, all: readonly TaskList[], from: string, inclusive: boolean): number {
  const key = shown.seriesKey ?? shown.seriesId;
  // a ticked list counts anywhere in the list; a different text only within the same series (another part has its own on purpose)
  return all.filter((l) => l.kind === 'tasklist' && (l.seriesKey ?? l.seriesId) === key && !!l.date && (inclusive ? l.date >= from : l.date > from)
    && (l.doneCount > 0 || (l.seriesId === shown.seriesId && textOf(l) !== textOf(shown)))).length;
}

/** As in Google, "this and following" is not offered on the first list; ending offers no "all"; "this list" never. */
export function ruleQuestion(shown: TaskList, rule: Recurrence | null, all: readonly TaskList[], today: string): RuleQuestion {
  const first = !!shown.seriesSince && shown.date === shown.seriesSince;
  const options: RuleQuestion['options'] = first ? ['all'] : rule === null ? ['following'] : ['following', 'all'];
  return {
    options,
    lost: { following: shown.date ? changedOnTheirOwn(shown, all, shown.date, false) : 0, all: changedOnTheirOwn(shown, all, today, true) },
  };
}
