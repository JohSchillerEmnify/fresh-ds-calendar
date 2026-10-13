import { describe, expect, it } from 'vitest';
import { addDays, christmasState, easterSunday, firstAdvent, holidayOf } from '@/theme/holidays';

const h = holidayOf;

describe('holiday calendar', () => {
  it('computes Easter Sunday', () => {
    expect([2025, 2026, 2027].map(easterSunday)).toEqual(['2025-04-20', '2026-04-05', '2027-03-28']);
  });

  it('finds the 1st Advent Sunday (the 4th Sunday before 25 December)', () => {
    // 24 Dec 2026 is a Thursday, 24 Dec 2023 a Sunday (the 4th Advent itself)
    expect([2026, 2023, 2027].map(firstAdvent)).toEqual(['2026-11-29', '2023-12-03', '2027-11-28']);
  });

  it('adds days across month and year ends', () => {
    expect([addDays('2026-12-31', 1), addDays('2027-03-01', -1)]).toEqual(['2027-01-01', '2027-02-28']);
  });

  it('lights one candle more each Advent Sunday and keeps the tree dark until 24 December', () => {
    const at = (d: string) => christmasState(d);
    expect(at('2026-11-29')).toEqual({ candles: 1, lights: false });
    expect(at('2026-12-05')).toEqual({ candles: 1, lights: false });
    expect(at('2026-12-06')).toEqual({ candles: 2, lights: false });
    expect(at('2026-12-13')).toEqual({ candles: 3, lights: false });
    expect(at('2026-12-20')).toEqual({ candles: 4, lights: false });
    expect(at('2026-12-23')).toEqual({ candles: 4, lights: false });
    expect(at('2026-12-24')).toEqual({ candles: 4, lights: true });
    expect(at('2026-12-30')).toEqual({ candles: 4, lights: true });
  });

  it('shows the full Christmas outside its dates (hand-picked scene)', () => {
    expect(christmasState('2026-04-12')).toEqual({ candles: 4, lights: true });
  });

  it('names the holiday of a date, New Year\'s Eve before Christmas', () => {
    expect(h('2026-11-28')).toBeNull();
    expect(h('2026-11-29')).toBe('Christmas');
    expect(h('2026-12-30')).toBe('Christmas');
    expect(h('2026-12-31')).toBe('New Year\'s Eve');
    expect(h('2027-01-01')).toBe('New Year');
    expect(h('2027-01-02')).toBeNull();
  });

  it('opens the Easter window a week before and closes it six days after Easter Sunday', () => {
    // Easter 2027 is 28 March
    expect([h('2027-03-20'), h('2027-03-21'), h('2027-03-25'), h('2027-04-03'), h('2027-04-04')]).toEqual([null, 'Easter', 'Easter', 'Easter', null]);
  });
});
