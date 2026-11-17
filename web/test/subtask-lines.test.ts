import { describe, expect, it } from 'vitest';
import { gapLines, linesFor } from '@/features/tasklists/subtaskLines';

const lv = (...l: number[]) => l.map((level) => ({ level }));

describe('subtask lines', () => {
  it('a task has none, unless it has subtasks: then a stem under its checkbox', () => {
    expect(linesFor(lv(0, 0), 1, 'straight')).toEqual([]);
    expect(linesFor(lv(0, 1), 0, 'tree')).toEqual([{ col: 0, kind: 'stem' }]);
  });
  it('straight: one guide per level', () => {
    expect(linesFor(lv(0, 1, 2), 2, 'straight')).toEqual([{ col: 0, kind: 'guide' }, { col: 1, kind: 'guide' }]);
    expect(linesFor(lv(0, 1, 2), 1, 'straight')).toEqual([{ col: 0, kind: 'guide' }, { col: 1, kind: 'stem' }]);
  });
  it('tree: a branch per subtask, round on the last, a guide through while more follow', () => {
    const items = lv(0, 1, 1);
    expect(linesFor(items, 1, 'tree')).toEqual([{ col: 0, kind: 'branch', end: false }, { col: 0, kind: 'guide' }]);
    expect(linesFor(items, 2, 'tree')).toEqual([{ col: 0, kind: 'branch', end: true }]);
  });
  it('tree: an ancestor line continues only while its task has a next sibling', () => {
    expect(linesFor(lv(0, 1, 2, 1), 2, 'tree')).toEqual([{ col: 0, kind: 'guide' }, { col: 1, kind: 'branch', end: true }]);
    expect(linesFor(lv(0, 1, 2, 0), 2, 'tree')).toEqual([{ col: 1, kind: 'branch', end: true }]);
  });
  it('the gap shows the line of the level it will get', () => {
    expect(gapLines(0, 'tree')).toEqual([]);
    expect(gapLines(2, 'straight')).toEqual([{ col: 0, kind: 'guide' }, { col: 1, kind: 'guide' }]);
    expect(gapLines(2, 'tree')).toEqual([{ col: 1, kind: 'branch', end: true }]);
  });
});
