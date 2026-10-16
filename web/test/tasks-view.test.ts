import { describe, expect, it } from 'vitest';
import type { Category, TaskList } from '@/api/types';
import { groupLists, isOpen, sortLists, timeGroupOf, weekEnd } from '@/features/tasklists/tasksView';

const TODAY = '2026-10-12'; // a Monday
const cats = [
  { id: 'shopping', name: 'Shopping' }, { id: 'work', name: 'Work' },
] as Category[];
const tl = (title: string, o: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id: title, calendarId: 'c', title, date: null, time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null,
  recurrence: null, categoryId: null, tags: [], color: '#000', completedOn: null, etag: 'e', updated: '2026-10-01T10:00:00+02:00', ...o,
});
const titles = (l: TaskList[]) => l.map((x) => x.title);

describe('time groups', () => {
  it('the week ends on Sunday', () => {
    expect(weekEnd('2026-10-12')).toBe('2026-10-18');
    expect(weekEnd('2026-10-17')).toBe('2026-10-18');
    expect(weekEnd('2026-10-18')).toBe('2026-10-18');
  });
  it('puts dates into Overdue, Today, This week, Later and No date', () => {
    expect(timeGroupOf('2026-10-11', TODAY)).toBe('overdue');
    expect(timeGroupOf('2026-10-12', TODAY)).toBe('today');
    expect(timeGroupOf('2026-10-13', TODAY)).toBe('week');
    expect(timeGroupOf('2026-10-18', TODAY)).toBe('week');
    expect(timeGroupOf('2026-10-19', TODAY)).toBe('later');
    expect(timeGroupOf(null, TODAY)).toBe('nodate');
    // on a Sunday nothing is left of "this week"
    expect(timeGroupOf('2026-10-19', '2026-10-18')).toBe('later');
    expect(timeGroupOf('2026-10-18', '2026-10-18')).toBe('today');
  });
  it('groups by time in fixed order and leaves empty groups out', () => {
    const g = groupLists([tl('later', { date: '2026-11-01' }), tl('none'), tl('late', { date: '2026-10-01' }), tl('now', { date: TODAY })], 'time', 'date', TODAY, cats);
    expect(g.map((x) => [x.key, x.title, titles(x.lists)])).toEqual([
      ['overdue', 'Overdue', ['late']], ['today', 'Today', ['now']], ['later', 'Later', ['later']], ['nodate', 'No date', ['none']],
    ]);
  });
});

describe('category and none groups', () => {
  const lists = [tl('c', { categoryId: 'work' }), tl('a', { categoryId: 'shopping' }), tl('x'), tl('b', { categoryId: 'work' }), tl('gone', { categoryId: 'deleted' })];
  it('follows the settings order with "No category" last (unknown ids count as none)', () => {
    const g = groupLists(lists, 'category', 'name', TODAY, cats);
    expect(g.map((x) => [x.key, titles(x.lists)])).toEqual([['shopping', ['a']], ['work', ['b', 'c']], ['none', ['gone', 'x']]]);
  });
  it('None is one untitled group, empty when there are no lists', () => {
    expect(groupLists(lists, 'none', 'name', TODAY, cats).map((x) => [x.key, x.title, titles(x.lists)])).toEqual([['all', '', ['a', 'b', 'c', 'gone', 'x']]]);
    expect(groupLists([], 'none', 'name', TODAY, cats)).toEqual([]);
  });
});

describe('sorting', () => {
  it('by date: earliest first, undated last, untimed before timed, ties by name', () => {
    const l = [tl('u'), tl('b', { date: '2026-10-14' }), tl('timed', { date: '2026-10-13', time: '08:00' }), tl('a', { date: '2026-10-14' }), tl('untimed', { date: '2026-10-13' })];
    expect(titles(sortLists(l, 'date', cats))).toEqual(['untimed', 'timed', 'a', 'b', 'u']);
  });
  it('by name, ignoring case; an untitled list has an empty name and sorts first', () => {
    expect(titles(sortLists([tl('b'), tl('A'), tl('', { id: 'e' })], 'name', cats))).toEqual(['', 'A', 'b']);
  });
  it('by category in settings order, no category last, ties by date', () => {
    const l = [tl('n'), tl('w', { categoryId: 'work' }), tl('s2', { categoryId: 'shopping', date: '2026-10-20' }), tl('s1', { categoryId: 'shopping', date: '2026-10-13' })];
    expect(titles(sortLists(l, 'category', cats))).toEqual(['s1', 's2', 'w', 'n']);
  });
  it('by last change, newest first', () => {
    const l = [tl('old', { updated: '2026-10-01T10:00:00+02:00' }), tl('new', { updated: '2026-10-11T09:00:00+02:00' }), tl('mid', { updated: '2026-10-05T10:00:00+02:00' })];
    expect(titles(sortLists(l, 'changed', cats))).toEqual(['new', 'mid', 'old']);
  });
  it('by progress, most done first; a list without items counts as 0 %', () => {
    const l = [
      tl('quarter', { doneCount: 1, totalCount: 4 }), tl('empty'), tl('half', { doneCount: 1, totalCount: 2 }), tl('third', { doneCount: 1, totalCount: 3 }),
      tl('zero', { doneCount: 0, totalCount: 2 }),
    ];
    expect(titles(sortLists(l, 'progress', cats))).toEqual(['half', 'third', 'quarter', 'empty', 'zero']);
  });
  it('reverses the default direction of every key, keeping the tie-break', () => {
    const l = [tl('a', { date: '2026-10-13', doneCount: 1, totalCount: 2, updated: '2026-10-01T10:00:00+02:00', categoryId: 'shopping' }),
      tl('b', { date: '2026-10-14', doneCount: 0, totalCount: 2, updated: '2026-10-02T10:00:00+02:00', categoryId: 'work' }), tl('c')];
    const order = (k: Parameters<typeof sortLists>[1]) => [titles(sortLists(l, k, cats)), titles(sortLists(l, k, cats, 'reversed'))];
    expect(order('date')).toEqual([['a', 'b', 'c'], ['c', 'b', 'a']]);
    expect(order('name')).toEqual([['a', 'b', 'c'], ['c', 'b', 'a']]);
    expect(order('category')).toEqual([['a', 'b', 'c'], ['c', 'b', 'a']]);
    expect(order('changed')).toEqual([['b', 'a', 'c'], ['a', 'c', 'b']]);
    expect(order('progress')).toEqual([['a', 'b', 'c'], ['b', 'c', 'a']]);
    // equal keys keep date, then name order even when reversed
    const same = [tl('y', { date: '2026-10-14' }), tl('x', { date: '2026-10-14' })];
    expect(titles(sortLists(same, 'progress', cats, 'reversed'))).toEqual(['x', 'y']);
  });
  it('does not change the input', () => {
    const l = [tl('b'), tl('a')];
    sortLists(l, 'name', cats);
    expect(titles(l)).toEqual(['b', 'a']);
  });
});

describe('open lists', () => {
  it('a list is open until every item is ticked; one without items is still open', () => {
    expect(isOpen({ totalCount: 0, doneCount: 0 })).toBe(true);
    expect(isOpen({ totalCount: 2, doneCount: 1 })).toBe(true);
    expect(isOpen({ totalCount: 2, doneCount: 2 })).toBe(false);
  });
});
