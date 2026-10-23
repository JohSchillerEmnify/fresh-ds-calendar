import { describe, expect, it } from 'vitest';
import { dropIndex, moveTo, rowShifts, slotOffset } from '@/features/tasklists/reorder';

const rows = [
  { top: 0, bottom: 40 },
  { top: 40, bottom: 80 },
  { top: 80, bottom: 130 },
];

describe('moveTo', () => {
  it('moves an item up and down', () => {
    expect(moveTo(['Milk', 'Eggs', 'Bread'], 2, 0)).toEqual(['Bread', 'Milk', 'Eggs']);
    expect(moveTo(['Milk', 'Eggs', 'Bread'], 0, 2)).toEqual(['Eggs', 'Bread', 'Milk']);
  });
  it('leaves the order alone for the same place, clamps and ignores a bad source', () => {
    expect(moveTo(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']);
    expect(moveTo(['a', 'b', 'c'], 2, -4)).toEqual(['c', 'a', 'b']);
    expect(moveTo(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
  it('does not change its input', () => {
    const l = ['a', 'b'];
    moveTo(l, 0, 1);
    expect(l).toEqual(['a', 'b']);
  });
});

describe('dropIndex', () => {
  it('is the row under the pointer, the first above and the last below', () => {
    expect(dropIndex(rows, 50)).toBe(1);
    expect(dropIndex(rows, -20)).toBe(0);
    expect(dropIndex(rows, 500)).toBe(2);
    expect(dropIndex([], 10)).toBe(0);
  });
});

describe('slotOffset', () => {
  it('aligns tops moving up and bottoms moving down', () => {
    expect(slotOffset(rows, 2, 0)).toBe(-80);
    expect(slotOffset(rows, 0, 2)).toBe(90);
    expect(slotOffset(rows, 1, 1)).toBe(0);
  });
});

describe('rowShifts', () => {
  const even = [{ top: 0, bottom: 40 }, { top: 40, bottom: 80 }, { top: 80, bottom: 120 }, { top: 120, bottom: 160 }];
  it('shifts nothing over the lifted row\'s own place', () => {
    expect(rowShifts(even, 1, 1)).toEqual([0, 0, 0, 0]);
  });
  it('moves the rows between up when lifted downwards', () => {
    expect(rowShifts(even, 0, 2)).toEqual([0, -40, -40, 0]);
    expect(rowShifts(even, 1, 3)).toEqual([0, 0, -40, -40]);
  });
  it('moves the rows between down when lifted upwards', () => {
    expect(rowShifts(even, 3, 1)).toEqual([0, 40, 40, 0]);
    expect(rowShifts(even, 2, 0)).toEqual([40, 40, 0, 0]);
  });
  it('uses the lifted row\'s height plus the spacing between rows', () => {
    const spaced = [{ top: 0, bottom: 40 }, { top: 48, bottom: 98 }, { top: 106, bottom: 146 }];
    expect(rowShifts(spaced, 1, 0)).toEqual([58, 0, 0]);
    expect(rowShifts(spaced, 0, 1)).toEqual([0, -48, 0]);
  });
  it('is all zero for a bad index', () => {
    expect(rowShifts(even, 9, 0)).toEqual([0, 0, 0, 0]);
  });
});
