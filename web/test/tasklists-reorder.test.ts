import { describe, expect, it } from 'vitest';
import { dropIndex, moveTo, slotOffset } from '@/features/tasklists/reorder';

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
