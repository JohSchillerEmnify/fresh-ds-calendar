/**
 * Pure grouping and sorting of the Tasks view (feature tasks-view).
 * No store or DOM access, so the rules are unit-tested with fixed dates.
 */
import type { Category, TaskList, TasksGroupBy, TasksSortBy, TasksSortDir } from '@/api/types';
import { t } from '@/i18n';
import { addDays, parseIsoDate, toIsoDate } from '@/lib/dates';
import { displayTitle } from '@/lib/items';
import { isComplete } from './format';

/** The time buckets, in display order. */
export type TimeGroup = 'overdue' | 'today' | 'week' | 'later' | 'nodate';
export const TIME_GROUPS: readonly TimeGroup[] = ['overdue', 'today', 'week', 'later', 'nodate'];
/** The heading of a time bucket in the active language. */
export const timeGroupTitle = (g: TimeGroup): string => t(`tasks.view.timeGroup.${g}`);

/** One heading of the Tasks view with its lists, already sorted. */
export interface TaskGroup {
  /** `data-group`: a {@link TimeGroup}, a category id, `none` (no category) or `all` (grouped by None). */
  key: string;
  /** Heading text; empty for the single group of "None". */
  title: string;
  lists: TaskList[];
}

/** A list is open until every item is ticked; a list without items yet still counts (feature tasks-view). */
export const isOpen = (l: Pick<TaskList, 'totalCount' | 'doneCount'>): boolean => !isComplete(l);

/** The Sunday that ends the week of `today` (weeks start on Monday); `today` itself on a Sunday. */
export function weekEnd(today: string): string {
  const d = parseIsoDate(today);
  if (!d) return today;
  return toIsoDate(addDays(d, (7 - d.getDay()) % 7));
}

/** The time bucket of a list: Overdue before today, Today, This week (tomorrow to Sunday), Later, No date. */
export function timeGroupOf(date: string | null, today: string): TimeGroup {
  if (date === null) return 'nodate';
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  return date <= weekEnd(today) ? 'week' : 'later';
}

const byName = (a: TaskList, b: TaskList): number => displayTitle(a).toLowerCase().localeCompare(displayTitle(b).toLowerCase());
/** Earliest date first, undated last; on one day untimed before timed, then by time. */
const byDate = (a: TaskList, b: TaskList): number =>
  (a.date === null ? 1 : 0) - (b.date === null ? 1 : 0)
  || (a.date ?? '').localeCompare(b.date ?? '')
  || Number(a.time !== null) - Number(b.time !== null)
  || (a.time ?? '').localeCompare(b.time ?? '');
const share = (l: TaskList): number => (l.totalCount ? l.doneCount / l.totalCount : 0);

/**
 * A comparator for the chosen sort; ties fall back to date, then name. `dir` is relative to the key's own default
 * direction (feature tasks-view): `reversed` flips the key only, not the tie-break.
 */
export function comparator(sortBy: TasksSortBy, categories: Pick<Category, 'id'>[], dir: TasksSortDir = 'default'): (a: TaskList, b: TaskList) => number {
  // no category (or an unknown one) sorts after every category
  const rank = (l: TaskList) => { const i = categories.findIndex((c) => c.id === l.categoryId); return i < 0 ? categories.length : i; };
  const primary: Record<TasksSortBy, (a: TaskList, b: TaskList) => number> = {
    date: byDate,
    name: byName,
    category: (a, b) => rank(a) - rank(b),
    changed: (a, b) => b.updated.localeCompare(a.updated),
    progress: (a, b) => share(b) - share(a),
  };
  const sign = dir === 'reversed' ? -1 : 1;
  return (a, b) => sign * primary[sortBy](a, b) || byDate(a, b) || byName(a, b);
}

/** Sorted copy of `lists`. */
export function sortLists(lists: TaskList[], sortBy: TasksSortBy, categories: Pick<Category, 'id'>[], dir: TasksSortDir = 'default'): TaskList[] {
  return [...lists].sort(comparator(sortBy, categories, dir));
}

/**
 * The lists in groups, each group sorted by `sortBy`, empty groups left out. Time groups come in the order
 * Overdue, Today, This week, Later, No date; category groups in the settings order followed by "No category".
 */
export function groupLists(lists: TaskList[], groupBy: TasksGroupBy, sortBy: TasksSortBy, today: string, categories: Category[], dir: TasksSortDir = 'default'): TaskGroup[] {
  const sorted = sortLists(lists, sortBy, categories, dir);
  if (groupBy === 'none') return sorted.length ? [{ key: 'all', title: '', lists: sorted }] : [];
  if (groupBy === 'time') {
    return TIME_GROUPS
      .map((g) => ({ key: g as string, title: timeGroupTitle(g), lists: sorted.filter((l) => timeGroupOf(l.date, today) === g) }))
      .filter((g) => g.lists.length);
  }
  const known = new Set(categories.map((c) => c.id));
  const groups: TaskGroup[] = categories.map((c) => ({ key: c.id, title: c.name, lists: sorted.filter((l) => l.categoryId === c.id) }));
  groups.push({ key: 'none', title: t('tasks.noCategory'), lists: sorted.filter((l) => l.categoryId === null || !known.has(l.categoryId)) });
  return groups.filter((g) => g.lists.length);
}
