import { describe, expect, it } from 'vitest';
import { dropIndex, moveTo, rowShifts, slotBox, slotOffset } from '@/features/tasklists/reorder';

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

describe('rowShifts with a gap of another height', () => {
  const even = [{ top: 0, bottom: 40 }, { top: 40, bottom: 80 }, { top: 80, bottom: 120 }, { top: 120, bottom: 160 }];
  it('opens the taller place and lets the rows after it follow', () => {
    expect(rowShifts(even, 0, 2, 60)).toEqual([0, -40, -40, 20]);
    expect(rowShifts(even, 3, 1, 60)).toEqual([0, 60, 60, 0]);
    expect(rowShifts(even, 1, 1, 60)).toEqual([0, 0, 20, 20]);
  });
});

describe('slotBox', () => {
  it('starts at the checkbox of the level and ends at the grip', () => {
    // a task: checkbox target 4..52, grip 260..308 in a list 340 wide
    const row = { cb: { left: 4, right: 52 }, grip: { left: 260, right: 308 } };
    expect(slotBox(row, 0, 0, 28, 340, 52)).toEqual({ left: 11, right: 308, cbLeft: 4 });
    expect(slotBox(row, 0, 2, 28, 340, 52)).toEqual({ left: 67, right: 308, cbLeft: 60 });
    expect(slotBox({ cb: { left: 60, right: 108 }, grip: row.grip }, 2, 0, 28, 340, 52).cbLeft).toBe(4);
  });
  it('ends before the bin when no row shows a grip', () => {
    expect(slotBox({ cb: { left: 4, right: 52 }, grip: null }, 0, 1, 28, 340, 52)).toEqual({ left: 39, right: 288, cbLeft: 32 });
  });
  it('is right for a mirrored row: the checkbox at the end, the indent on the grip side', () => {
    const mirrored = { cb: { left: 288, right: 336 }, grip: { left: 4, right: 52 } };
    expect(slotBox(mirrored, 0, 1, 28, 340, 52)).toEqual({ left: 36, right: 329, cbLeft: 288 });
  });
});
