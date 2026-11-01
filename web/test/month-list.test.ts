import { describe, expect, it } from 'vitest';
import { listLayout, MONTH_COUNT, monthAtOffset, monthDate, monthIndex, mostInView, weeksOf } from '@/lib/monthList';

const L = listLayout({ weekH: 96, headerH: 40 });
const idx = (y: number, m: number) => monthIndex(new Date(y, m - 1, 1));

describe('month list geometry', () => {
  it('maps months to list positions and back, clamped to the list', () => {
    expect(monthDate(idx(2026, 10)).getMonth()).toBe(9);
    expect(monthIndex(monthDate(idx(2027, 2)))).toBe(idx(2027, 2));
    expect(monthIndex(new Date(1800, 0, 1))).toBe(0);
    expect(monthIndex(new Date(2300, 0, 1))).toBe(MONTH_COUNT - 1);
  });
  it('counts the week rows of a month that starts on a new Monday-based row', () => {
    expect(weeksOf(idx(2026, 10))).toBe(5);
    expect(weeksOf(idx(2026, 11))).toBe(6); // 1 November 2026 is a Sunday
    expect(weeksOf(idx(2027, 2))).toBe(4); // a Monday start and 28 days
  });
  it('lays months end to end: header plus fixed week rows', () => {
    const oct = idx(2026, 10);
    expect(L.tops[oct + 1] - L.tops[oct]).toBe(40 + 5 * 96);
    expect(L.tops[MONTH_COUNT]).toBeGreaterThan(L.tops[oct]);
  });
  it('finds the month at an offset', () => {
    const nov = idx(2026, 11);
    expect(monthAtOffset(L, L.tops[nov])).toBe(nov);
    expect(monthAtOffset(L, L.tops[nov] - 1)).toBe(nov - 1);
    expect(monthAtOffset(L, 1e12)).toBe(MONTH_COUNT - 1);
  });
  it('names the month with the largest visible share', () => {
    const oct = idx(2026, 10);
    const view = 600;
    expect(mostInView(L, L.tops[oct], view)).toBe(oct);
    // scrolled until only 100 px of October are left above November
    expect(mostInView(L, L.tops[oct + 1] - 100, view)).toBe(oct + 1);
    // a tie goes to the earlier month
    expect(mostInView(L, L.tops[oct + 1] - view / 2, view)).toBe(oct);
  });
});
