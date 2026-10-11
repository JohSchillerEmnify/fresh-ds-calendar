import { describe, expect, it } from 'vitest';
import { monthGrid, parseParam, periodLabel, routePath, shiftPeriod, toIsoDate, weekDays } from '@/lib/dates';

describe('monthGrid (Monday start)', () => {
  it('October 2026 starts on Mon 28 Sep and ends on Sun 1 Nov', () => {
    const weeks = monthGrid(new Date(2026, 9, 12));
    expect(weeks).toHaveLength(5);
    expect(toIsoDate(weeks[0][0])).toBe('2026-09-28');
    expect(toIsoDate(weeks.at(-1)!.at(-1)!)).toBe('2026-11-01');
    for (const w of weeks) {
      expect(w).toHaveLength(7);
      expect(w[0].getDay()).toBe(1); // Monday
      expect(w[6].getDay()).toBe(0); // Sunday
    }
  });

  it('February 2027 (starts Monday) has exactly 4 rows', () => {
    const weeks = monthGrid(new Date(2027, 1, 1));
    expect(weeks).toHaveLength(4);
    expect(toIsoDate(weeks[0][0])).toBe('2027-02-01');
  });

  it('a month starting on Sunday needs 6 rows (March 2026)', () => {
    const weeks = monthGrid(new Date(2026, 2, 1));
    expect(weeks).toHaveLength(6);
    expect(toIsoDate(weeks[0][6])).toBe('2026-03-01');
  });
});

describe('weekDays', () => {
  it('Sunday belongs to the week starting the previous Monday', () => {
    const days = weekDays(new Date(2026, 9, 18));
    expect(days.map(toIsoDate)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
  });
});

describe('route helpers', () => {
  it('parses and rejects params', () => {
    expect(toIsoDate(parseParam('month', '2026-10')!)).toBe('2026-10-01');
    expect(toIsoDate(parseParam('day', '2026-10-12')!)).toBe('2026-10-12');
    expect(parseParam('day', '2026-13-01')).toBeNull();
    expect(parseParam('month', 'garbage')).toBeNull();
    expect(parseParam('week', undefined)).toBeNull();
  });

  it('builds paths and shifts periods', () => {
    const d = new Date(2026, 9, 12);
    expect(routePath('month', d)).toBe('/month/2026-10');
    expect(routePath('week', d)).toBe('/week/2026-10-12');
    expect(toIsoDate(shiftPeriod('month', d, 1))).toBe('2026-11-12');
    expect(toIsoDate(shiftPeriod('week', d, -1))).toBe('2026-10-05');
    expect(toIsoDate(shiftPeriod('day', d, 1))).toBe('2026-10-13');
  });

  it('labels periods', () => {
    const d = new Date(2026, 9, 12);
    expect(periodLabel('month', d)).toBe('October 2026');
    expect(periodLabel('week', d)).toBe('12–18 Oct 2026');
    expect(periodLabel('week', new Date(2026, 8, 30))).toBe('28 Sep – 4 Oct 2026');
  });
});
