/**
 * The "Task categories" switch (pref `taskCategories`, ARCHITECTURE "Task categories switch"): pure fall-back rules for
 * what the Tasks UI shows while categories are off, plus a composable that binds them to the prefs store. Nothing here
 * changes stored data: the stored filter, grouping, sort and the lists' `categoryId`s stay as they are.
 */
import { computed } from 'vue';
import type { CalendarItem, TaskList, TasksFilter, TasksGroupBy, TasksSortBy } from '@/api/types';
import { usePrefsStore } from '@/stores/prefs';

/** Grouping to apply: "category" falls back to the default "time" while categories are off. */
export const effectiveGroupBy = (g: TasksGroupBy, on: boolean): TasksGroupBy => (!on && g === 'category' ? 'time' : g);

/** Sorting to apply: "category" falls back to the default "date" while categories are off. */
export const effectiveSortBy = (s: TasksSortBy, on: boolean): TasksSortBy => (!on && s === 'category' ? 'date' : s);

/** Filter to apply: category chips are ignored while categories are off, so no list silently vanishes. */
export const effectiveFilter = (f: TasksFilter, on: boolean): TasksFilter => (on || !f.categories.length ? f : { ...f, categories: [] });

/** Colour of a list: its category colour, or the tasks calendar's colour while categories are off. */
export const listColor = (l: Pick<TaskList, 'color' | 'calendarColor'>, on: boolean): string => (on ? l.color : l.calendarColor ?? l.color);

/** Colour of any calendar item: events keep theirs, task lists follow {@link listColor}. */
export const itemColor = (i: CalendarItem, on: boolean): string => (i.kind === 'tasklist' ? listColor(i, on) : i.color);

/** Category of a list as the UI sees it: none while categories are off. */
export const listCategoryId = (l: Pick<TaskList, 'categoryId'>, on: boolean): string | null => (on ? l.categoryId : null);

/** The switch bound to the prefs store, with the fall-back rules curried. */
export function useTaskCategories() {
  const prefs = usePrefsStore();
  const on = computed(() => prefs.taskCategories);
  return {
    on,
    color: (l: Pick<TaskList, 'color' | 'calendarColor'>): string => listColor(l, on.value),
    itemColor: (i: CalendarItem): string => itemColor(i, on.value),
    categoryId: (l: Pick<TaskList, 'categoryId'>): string | null => listCategoryId(l, on.value),
    groupBy: computed(() => effectiveGroupBy(prefs.tasksGroupBy, on.value)),
    sortBy: computed(() => effectiveSortBy(prefs.tasksSortBy, on.value)),
    filter: computed(() => effectiveFilter(prefs.tasksFilter, on.value)),
  };
}
