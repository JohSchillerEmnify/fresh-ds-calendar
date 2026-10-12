import { describe, expect, it } from 'vitest';
import { clampLeft } from '@/lib/clamp';

describe('clampLeft', () => {
  it('keeps an in-range anchor', () => expect(clampLeft(40, 260, 800)).toBe(40));
  it('pulls a right-edge anchor back inside the viewport', () => expect(clampLeft(340, 260, 375)).toBe(103));
  it('never goes below the margin', () => expect(clampLeft(-50, 260, 375)).toBe(12));
  it('narrow viewport wins over the right bound', () => expect(clampLeft(100, 400, 375)).toBe(12));
});

import { isComplete, itemClass } from '@/features/tasklists/format';
describe('completed task list styling', () => {
  it('complete only when all ticked and non-empty', () => {
    expect(isComplete({ totalCount: 3, doneCount: 3 })).toBe(true);
    expect(isComplete({ totalCount: 3, doneCount: 2 })).toBe(false);
    expect(isComplete({ totalCount: 0, doneCount: 0 })).toBe(false);
  });
  it('struck-through class for done items', () => {
    expect(itemClass(true)).toBe('it done');
    expect(itemClass(false)).toBe('it');
  });
});
