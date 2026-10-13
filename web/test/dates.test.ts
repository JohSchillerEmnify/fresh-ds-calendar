import { describe, expect, it } from 'vitest';
import { format as dateFnsFormat } from 'date-fns';
import {
  fetchRange, format, parseIsoDate, parseIsoMonth, monthGrid, nextFocus, parseParam, periodTitle, routePath, shiftPeriod, toIsoDate, weekDays,
} from '@/lib/dates';

const d = (s: string) => parseParam('day', s)!;

describe('period titles (en-GB)', () => {
  it.each([
    ['year', '2026-10-12', '2026'],
    ['month', '2026-10-12', 'October 2026'],
    ['week', '2026-10-12', '12 – 18 Oct 2026'],
    ['week', '2026-09-28', '28 Sep – 4 Oct 2026'],
    ['week', '2026-12-28', '28 Dec 2026 – 3 Jan 2027'],
    ['day', '2026-10-14', 'Wednesday, 14 October 2026'],
  ] as const)('%s %s -> %s', (view, date, title) => {
    expect(periodTitle(view, d(date))).toBe(title);
  });
});

describe('grids and params', () => {
  it('October 2026 grid is Mon 28 Sep .. Sun 1 Nov; Nov 2026 has 6 weeks', () => {
    const g = monthGrid(d('2026-10-12'));
    expect([toIsoDate(g[0][0]), toIsoDate(g.at(-1)![6])]).toEqual(['2026-09-28', '2026-11-01']);
    expect(monthGrid(d('2026-11-01'))).toHaveLength(6);
    expect(monthGrid(d('2027-02-01'))).toHaveLength(4);
  });
  it('rejects invalid params and normalises weeks to Monday', () => {
    expect(parseParam('month', '2026-13')).toBeNull();
    expect(parseParam('day', '2026-02-30')).toBeNull();
    expect(parseParam('year', '12')).toBeNull();
    expect(toIsoDate(parseParam('week', '2026-10-15')!)).toBe('2026-10-12');
    expect(routePath('week', d('2026-10-15'))).toBe('/week/2026-10-12');
    expect(routePath('year', d('2026-10-15'))).toBe('/year/2026');
  });
  it('shifts by exactly one period', () => {
    expect(routePath('month', shiftPeriod('month', d('2026-12-01'), 1))).toBe('/month/2027-01');
    expect(routePath('week', shiftPeriod('week', d('2026-12-28'), 1))).toBe('/week/2027-01-04');
    expect(routePath('year', shiftPeriod('year', d('2026-01-01'), 1))).toBe('/year/2027');
  });
  it('fetch range covers the visible month grid (to exclusive)', () => {
    expect(fetchRange('month', d('2026-10-01'))).toEqual(['2026-09-28', '2026-11-02']);
    expect(fetchRange('day', d('2026-10-14'))).toEqual(['2026-10-14', '2026-10-15']);
    expect(weekDays(d('2026-10-14'))).toHaveLength(7);
  });
});

describe('focus date', () => {
  const today = d('2026-10-12');
  it('keeps the focus when inside, else today if inside, else first day', () => {
    expect(toIsoDate(nextFocus('week', d('2026-10-12'), d('2026-10-15'), today))).toBe('2026-10-15');
    expect(toIsoDate(nextFocus('month', d('2026-10-01'), d('2026-12-05'), today))).toBe('2026-10-12');
    expect(toIsoDate(nextFocus('month', d('2026-12-01'), null, today))).toBe('2026-12-01');
  });
  it('week from a December month opens the week of its first day', () => {
    const f = nextFocus('month', d('2026-12-01'), null, today);
    expect(routePath('week', f)).toBe('/week/2026-11-30');
  });
});

describe('own format and ISO parsers (kept small instead of date-fns format/parse)', () => {
  it('format equals date-fns format for every token the app uses', () => {
    const patterns = ['yyyy-MM-dd', 'yyyy-MM', 'yyyy', 'MMMM yyyy', 'EEEE, d MMMM yyyy', 'd MMM yyyy', 'd MMM', 'd', 'EEE d MMM', 'EEE', 'dd'];
    for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2030, 0, 1); t += 86_400_000 * 5 + 3_600_000 * 7) {
      for (const p of patterns) expect(format(new Date(t), p), p).toBe(dateFnsFormat(new Date(t), p));
    }
    const early = new Date(2000, 5, 15);
    early.setFullYear(5);
    expect(format(early, 'yyyy-MM-dd')).toBe(dateFnsFormat(early, 'yyyy-MM-dd'));
    expect(() => format(new Date(NaN), 'yyyy')).toThrow(RangeError);
  });

  it('parses only dates that exist', () => {
    expect(parseIsoDate('2026-02-28')).toEqual(new Date(2026, 1, 28));
    expect(parseIsoDate('2024-02-29')).toEqual(new Date(2024, 1, 29));
    for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-01-00', '0000-01-01', '26-01-01', '2026-1-1', '', null, undefined]) {
      expect(parseIsoDate(bad), String(bad)).toBeNull();
    }
    expect(parseIsoMonth('2026-10')).toEqual(new Date(2026, 9, 1));
    expect(parseIsoMonth('2026-13')).toBeNull();
    expect(parseIsoMonth('2026-00')).toBeNull();
    expect(parseIsoDate('0050-03-04')!.getFullYear()).toBe(50);
  });
});
