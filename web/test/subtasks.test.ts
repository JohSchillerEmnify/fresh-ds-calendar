import { describe, expect, it } from 'vitest';
import { blockEnd, blockIds, clampLevels, indentOf, parseIndented, reopenParents } from '@calendar/shared/subtasks';

const it4 = (levels: number[]) => levels.map((l, n) => ({ id: `i${n}`, title: `T${n}`, ...(l ? { level: l } : {}) }));

describe('subtask rules', () => {
  it('clamps: first is a task, one level deeper at most, three levels at most', () => {
    expect(clampLevels(it4([1, 2, 0, 3, 3, 1])).map((i) => i.level ?? 0)).toEqual([0, 1, 0, 1, 2, 1]);
  });
  it('keeps valid items as they are', () => {
    const items = it4([0, 1, 2, 0]);
    expect(clampLevels(items)).toEqual(items);
    expect(clampLevels(items)[0]).toBe(items[0]);
  });
  it('a block is the item and the deeper ones after it', () => {
    const items = it4([0, 1, 2, 1, 0]);
    expect(blockEnd(items, 0)).toBe(4);
    expect(blockEnd(items, 1)).toBe(3);
    expect(blockEnd(items, 4)).toBe(5);
    expect(blockIds(items, 'i1')).toEqual(['i1', 'i2']);
    expect(blockIds(items, 'nope')).toEqual([]);
  });
  it('typed lines: nearest less-indented line above is the parent, one space is enough', () => {
    expect(parseIndented('Tent\n  Pegs\n    Poles\nFood')).toEqual([
      { title: 'Tent', level: 0 }, { title: 'Pegs', level: 1 }, { title: 'Poles', level: 2 }, { title: 'Food', level: 0 },
    ]);
    expect(parseIndented('Tent\n      Pegs\n Poles').map((l) => l.level)).toEqual([0, 1, 1]);
  });
  it('typed lines: first line indented is a task, four levels stop at three, empty lines vanish', () => {
    expect(parseIndented('  A\n\n B\n  C\n   D\n    E').map((l) => l.level)).toEqual([0, 0, 1, 2, 2]);
    expect(parseIndented('A\n B\n  C\n   D').map((l) => l.level)).toEqual([0, 1, 2, 2]);
  });
  it('indents two spaces per level in Google', () => {
    expect(indentOf({ level: 2 })).toBe('    ');
    expect(indentOf({})).toBe('');
  });

  it('a done task over an open subtask opens, up the whole chain; the rest stays', () => {
    const items = [
      { id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: true, level: 1 }, { id: 'c', title: 'C', done: false, level: 2 },
      { id: 'd', title: 'D', done: true }, { id: 'e', title: 'E', done: true, level: 1 },
    ];
    expect(reopenParents(items).map((i) => i.done)).toEqual([false, false, false, true, true]);
    const fine = [{ id: 'a', title: 'A', done: false }, { id: 'b', title: 'B', done: true, level: 1 }];
    expect(reopenParents(fine)).toBe(fine);
  });
  it('an open sibling of a done subtask does not open the task', () => {
    const items = [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: true, level: 1 }, { id: 'c', title: 'C', done: false }];
    expect(reopenParents(items).map((i) => i.done)).toEqual([true, true, false]);
  });
});
