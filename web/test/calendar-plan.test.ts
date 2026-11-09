import { describe, expect, it } from 'vitest';
import { awayActive, hasPlan, wallNow } from '@/lib/calendarPlan';

describe('calendar plan helpers (feature calendar-off-plan)', () => {
  it('builds the wall time from the clock date and minutes', () => {
    expect(wallNow('2026-11-06', 17 * 60 + 5)).toBe('2026-11-06T17:05');
  });

  it('knows whether a plan has anything that switches the calendar', () => {
    expect(hasPlan(undefined)).toBe(false);
    expect(hasPlan({})).toBe(false);
    expect(hasPlan({ until: '2026-11-10' })).toBe(true);
  });

  it('keeps "Off for a while" active until 00:00 of its day', () => {
    expect(awayActive({ until: '2026-11-06' }, '2026-11-05T23:59')).toBe(true);
    expect(awayActive({ until: '2026-11-06' }, '2026-11-06T00:00')).toBe(false);
  });
});
