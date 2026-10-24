import { describe, expect, it } from 'vitest';
import { packWeek, seenCount } from '@/lib/monthSlots';

const ones = (n: number) => Array.from({ length: n }, () => 1);

describe('packWeek', () => {
  it('starts a day no bar touches at slot 0', () => {
    const r = packWeek([{ startCol: 0, endCol: 2, lane: 0 }], [ones(1), ones(1), ones(1), ones(2), [], [], []]);
    expect(r[3].slots).toEqual([0, 1]);
    expect(r[3].taken).toBe(0);
    expect(r[0].slots).toEqual([1]);
    expect(r[0].taken).toBe(1);
  });

  it('fills the free slot above a bar, then continues below', () => {
    const bars = [{ startCol: 0, endCol: 3, lane: 1 }];
    const r = packWeek(bars, [ones(3), [], [], [], [], [], []]);
    expect(r[0].slots).toEqual([0, 2, 3]);
    expect(r[0].used).toBe(4);
  });

  it('skips only the slots of bars that cover the day', () => {
    const bars = [{ startCol: 1, endCol: 2, lane: 0 }, { startCol: 2, endCol: 4, lane: 1 }];
    const r = packWeek(bars, [ones(1), ones(1), ones(1), ones(1), ones(1), ones(1), []]);
    expect(r.map((d) => d.slots[0])).toEqual([0, 1, 2, 0, 0, 0, undefined]);
    expect(r[3].taken).toBe(1);
  });

  it('counts a bar below the last entry in used', () => {
    expect(packWeek([{ startCol: 0, endCol: 0, lane: 2 }], [ones(1)])[0].used).toBe(3);
  });

  it('cuts a wide entry to the free run it starts in and never overlaps a bar', () => {
    const r = packWeek([{ startCol: 0, endCol: 0, lane: 2 }], [[3, 1]]);
    expect(r[0].slots).toEqual([0, 3]);
    expect(r[0].spans).toEqual([2, 1]);
  });

  it('gives a wide entry its full span when nothing is in the way', () => {
    const r = packWeek([], [[3, 1]]);
    expect(r[0].spans).toEqual([3, 1]);
    expect(r[0].slots).toEqual([0, 3]);
  });
});

describe('seenCount', () => {
  it('counts the entries that start above the bottom of the room', () => {
    expect(seenCount([0, 1, 2, 3, 4], 20, 61)).toBe(4);
    expect(seenCount([0, 1, 2, 3, 4], 20, 60)).toBe(3);
  });

  it('keeps an entry below a bar gap or a wide card by its first slot', () => {
    expect(seenCount([0, 3, 4], 20, 70)).toBe(2);
  });

  it('keeps everything while the cell is unmeasured or roomy', () => {
    expect(seenCount([0, 1, 2], 20, Infinity)).toBe(3);
    expect(seenCount([], 20, 10)).toBe(0);
  });
});
