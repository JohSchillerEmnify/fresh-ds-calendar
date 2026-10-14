import { describe, expect, it } from 'vitest';
import { CELL_METRICS, maxLanes } from '@/features/tasklists/layout';

describe('maxLanes', () => {
  it('is uncapped while the grid is unmeasured', () => {
    expect(maxLanes(0, true)).toBe(Infinity);
    expect(maxLanes(Number.NaN, false)).toBe(Infinity);
  });

  it('leaves room for one entry row below the lanes on a phone', () => {
    const m = CELL_METRICS.phone;
    const fixed = m.num + m.pad + 2 + m.chip;
    for (const lanes of [1, 2, 3, 4]) {
      expect(maxLanes(fixed + lanes * m.lane, true)).toBe(lanes);
      expect(maxLanes(fixed + lanes * m.lane - 0.5, true)).toBe(Math.max(1, lanes - 1));
    }
  });

  it('always keeps one lane, however small the cell', () => {
    expect(maxLanes(10, true)).toBe(1);
    expect(maxLanes(54, true)).toBe(1);
    expect(maxLanes(10, false)).toBe(1);
  });

  it('is stable for fractional heights (floor, no flip-flop)', () => {
    const h = 100.4;
    expect(maxLanes(h, true)).toBe(maxLanes(h + 0.01, true));
    expect(maxLanes(h, false)).toBeLessThanOrEqual(maxLanes(h, true));
  });

  it('gives the phone day number a smaller header than the wide layout', () => {
    expect(CELL_METRICS.phone.num + CELL_METRICS.phone.pad).toBeLessThan(CELL_METRICS.wide.num + CELL_METRICS.wide.pad);
  });
});
