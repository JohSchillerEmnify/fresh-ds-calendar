/**
 * Pure rules of the Tasks view's filter (feature tasks-filter): category chips combined with "or", one When choice,
 * both combined with "and". No store or DOM access, so the rules are unit-tested with fixed dates.
 */
import type { TaskList, TasksFilter, TasksWhen } from '@/api/types';
import { addDays, parseIsoDate, toIsoDate } from '@/lib/dates';
import { weekEnd } from './tasksView';

/** The When choices in the order the menu shows them. */
export const WHEN_VALUES: readonly TasksWhen[] = ['all', 'nodate', 'dated', 'overdue', 'today', 'tomorrow', 'week'];
export const NO_FILTER: TasksFilter = { categories: [], when: 'all' };

/** Whether any chip or When choice is on. */
export const filterActive = (f: TasksFilter): boolean => f.categories.length > 0 || f.when !== 'all';

/** The filter with `id` switched on or off. */
export function toggleCategory(f: TasksFilter, id: string): TasksFilter {
  return { ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] };
}

/** Whether a list's date (null = undated) fits a When choice on the day `today` (`week` = today through the coming Sunday, feature tasks-filter). */
export function matchesWhen(date: string | null, when: TasksWhen, today: string): boolean {
  switch (when) {
    case 'all': return true;
    case 'nodate': return date === null;
    case 'dated': return date !== null;
    case 'overdue': return date !== null && date < today;
    case 'today': return date === today;
    case 'tomorrow': {
      const d = parseIsoDate(today);
      return date !== null && !!d && date === toIsoDate(addDays(d, 1));
    }
    case 'week': return date !== null && date >= today && date <= weekEnd(today);
  }
}

/** Whether a list passes the filter: one of the chosen categories (`none` = no category) and the When choice. */
export function matchesTasksFilter(l: Pick<TaskList, 'categoryId' | 'date'>, f: TasksFilter, today: string): boolean {
  if (f.categories.length && !f.categories.includes(l.categoryId ?? 'none')) return false;
  return matchesWhen(l.date, f.when, today);
}
