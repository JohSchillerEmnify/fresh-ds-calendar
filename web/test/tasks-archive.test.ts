import { describe, expect, it } from 'vitest';
import type { TaskList } from '@/api/types';
import { isFinished, matchesSearch, sortArchive, copyOf } from '@/features/tasklists/archive';

const tl = (title: string, o: Partial<TaskList> = {}): TaskList => ({
  kind: 'tasklist', id: title, calendarId: 'c', title, date: null, time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null,
  recurrence: null, categoryId: null, tags: [], color: '#000', calendarColor: '#000', completedOn: null, canvas: null, etag: 'e', updated: '2026-10-01T10:00:00+02:00', ...o,
});
const titles = (l: TaskList[]) => l.map((x) => x.title);

describe('isFinished', () => {
  it('needs items, all ticked', () => {
    expect(isFinished({ totalCount: 2, doneCount: 2 })).toBe(true);
    expect(isFinished({ totalCount: 2, doneCount: 1 })).toBe(false);
    expect(isFinished({ totalCount: 0, doneCount: 0 })).toBe(false);
  });
});

describe('sortArchive', () => {
  it('puts the newest completedOn first', () => {
    expect(titles(sortArchive([tl('a', { completedOn: '2026-10-08' }), tl('b', { completedOn: '2026-10-10' })]))).toEqual(['b', 'a']);
  });
  it('puts lists without completedOn last, newest date first, undated after dated', () => {
    const l = [tl('x', { date: '2026-01-01' }), tl('u'), tl('y', { date: '2026-03-01' }), tl('done', { completedOn: '2020-01-01' })];
    expect(titles(sortArchive(l))).toEqual(['done', 'y', 'x', 'u']);
  });
  it('breaks ties by title and does not change the input', () => {
    const l = [tl('b', { completedOn: '2026-10-10' }), tl('a', { completedOn: '2026-10-10' })];
    expect(titles(sortArchive(l))).toEqual(['a', 'b']);
    expect(titles(l)).toEqual(['b', 'a']);
  });
});

describe('matchesSearch', () => {
  const trip = tl('Trip', { items: [{ id: '1', title: 'Passport', done: true }] });
  it('matches the title and the item titles, case-insensitively', () => {
    expect(matchesSearch(trip, 'tRI')).toBe(true);
    expect(matchesSearch(trip, 'passp')).toBe(true);
    expect(matchesSearch(trip, 'visa')).toBe(false);
  });
  it('matches everything for a blank query', () => {
    expect(matchesSearch(trip, '  ')).toBe(true);
  });
});

describe('copyOf', () => {
  it('copies title, category and tags with open items and no date', () => {
    const src = tl('Shop', { date: '2026-10-10', time: '10:00', categoryId: 'shopping', tags: ['a'], recurrence: 'weekly', estimateMinutes: 30,
      items: [{ id: '1', title: 'Milk', done: true }, { id: '2', title: 'Bread', done: true }] });
    expect(copyOf(src)).toEqual({ title: 'Shop', date: null, categoryId: 'shopping', tags: ['a'], items: [{ title: 'Milk', done: false }, { title: 'Bread', done: false }] });
  });
});
