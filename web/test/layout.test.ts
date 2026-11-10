import { describe, expect, it } from 'vitest';
import { clampLeft } from '@/lib/clamp';
import { cardLayout } from '@/features/tasklists/layout';

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

describe('cardLayout with ink', () => {
  it('fits fewer rows in the same height because every row is as tall as the ink line', () => {
    const base = { variant: 'card', grown: false, titles: false, mini: false, height: 100, timed: false, titled: true, open: 6, total: 6 };
    expect(cardLayout({ ...base, inked: true }).shown).toBeLessThan(cardLayout(base).shown);
  });
});

describe('cardLayout with one untitled item', () => {
  it('moves the item into the title slot instead of listing it below', () => {
    const base = { variant: 'card', grown: false, titles: false, mini: false, height: 100, timed: false, titled: false, open: 1, total: 1 };
    expect(cardLayout(base)).toMatchObject({ shown: 0, lead: true, inline: false });
  });
});

describe('cardLayout on a narrow time-grid card', () => {
  const base = { variant: 'block', grown: false, titles: false, mini: true, timed: true, titled: false, open: 2, total: 2 };
  it('shows both items when a 40 px card has room for both rows', () => {
    expect(cardLayout({ ...base, height: 40 })).toMatchObject({ shown: 2, more: 0 });
  });
  it('shows the first item as a row (which fades out) on a 30 px card instead of hiding the rest without a cue', () => {
    expect(cardLayout({ ...base, height: 30 })).toMatchObject({ shown: 1, more: 1, lead: false });
  });
});
