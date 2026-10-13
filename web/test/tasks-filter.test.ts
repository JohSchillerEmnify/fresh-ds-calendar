import { describe, expect, it } from 'vitest';
import type { TasksFilter, TasksWhen } from '@/api/types';
import { filterActive, matchesTasksFilter, matchesWhen, NO_FILTER, toggleCategory, WHEN_VALUES } from '@/features/tasklists/tasksFilter';

const TODAY = '2026-10-12'; // a Monday
const f = (categories: string[] = [], when: TasksWhen = 'all'): TasksFilter => ({ categories, when });

describe('When', () => {
  const dates = [null, '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-18', '2026-10-19'];
  const hits = (when: TasksWhen) => dates.filter((d) => matchesWhen(d, when, TODAY));
  it.each([
    ['all', dates],
    ['nodate', [null]],
    ['dated', ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-18', '2026-10-19']],
    ['overdue', ['2026-10-11']],
    ['today', ['2026-10-12']],
    ['tomorrow', ['2026-10-13']],
    ['week', ['2026-10-12', '2026-10-13', '2026-10-18']],
  ] as const)('%s', (when, expected) => {
    expect(hits(when)).toEqual(expected);
  });
  it('this week is only today on a Sunday', () => {
    expect(['2026-10-18', '2026-10-19'].filter((d) => matchesWhen(d, 'week', '2026-10-18'))).toEqual(['2026-10-18']);
  });
  it('tomorrow crosses a month end', () => {
    expect(matchesWhen('2026-11-01', 'tomorrow', '2026-10-31')).toBe(true);
  });
  it('knows every choice', () => {
    expect(WHEN_VALUES).toHaveLength(7);
  });
});

describe('categories and When together', () => {
  const l = (categoryId: string | null, date: string | null) => ({ categoryId, date });
  it('shows everything without a filter', () => {
    expect(matchesTasksFilter(l(null, null), NO_FILTER, TODAY)).toBe(true);
  });
  it('combines several chips with "or" and understands "none"', () => {
    const chips = f(['shopping', 'none']);
    expect(matchesTasksFilter(l('shopping', null), chips, TODAY)).toBe(true);
    expect(matchesTasksFilter(l(null, null), chips, TODAY)).toBe(true);
    expect(matchesTasksFilter(l('work', null), chips, TODAY)).toBe(false);
  });
  it('combines the chips with When using "and"', () => {
    const both = f(['shopping'], 'overdue');
    expect(matchesTasksFilter(l('shopping', '2026-10-10'), both, TODAY)).toBe(true);
    expect(matchesTasksFilter(l('shopping', '2026-10-14'), both, TODAY)).toBe(false);
    expect(matchesTasksFilter(l('work', '2026-10-10'), both, TODAY)).toBe(false);
  });
  it('a category that does not exist any more matches nothing', () => {
    expect(matchesTasksFilter(l('work', null), f(['gone']), TODAY)).toBe(false);
  });
});

describe('helpers', () => {
  it('is active with a chip or a When choice', () => {
    expect([filterActive(NO_FILTER), filterActive(f(['a'])), filterActive(f([], 'today'))]).toEqual([false, true, true]);
  });
  it('toggles a chip without touching When', () => {
    const on = toggleCategory(f([], 'week'), 'a');
    expect(on).toEqual(f(['a'], 'week'));
    expect(toggleCategory(on, 'a')).toEqual(f([], 'week'));
  });
});
