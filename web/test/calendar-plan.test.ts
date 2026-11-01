import { describe, expect, it } from 'vitest';
import { planOff, planEffectiveHidden, nextPlanEdge, wallNow } from '@/lib/calendarPlan';

// Fri 17:00 -> Sun 16:00 every week; 2026-11-06 is a Friday
const weekend = { windows: [{ from: { day: 5, time: '17:00' }, to: { day: 0, time: '16:00' } }] };

describe('calendar plan (feature calendar-off-plan)', () => {
  it('is off inside the weekly window, on outside it, also across the week end', () => {
    expect(planOff(weekend, '2026-11-06T16:59')).toBe(false);
    expect(planOff(weekend, '2026-11-06T17:00')).toBe(true);
    expect(planOff(weekend, '2026-11-07T10:00')).toBe(true);
    expect(planOff(weekend, '2026-11-08T15:59')).toBe(true);
    expect(planOff(weekend, '2026-11-08T16:00')).toBe(false);
    expect(planOff(weekend, '2026-11-10T14:00')).toBe(false);
  });

  it('handles a window inside one day and Mon-Fri as Sat 00:00 to Mon 00:00', () => {
    const wed = { windows: [{ from: { day: 3, time: '08:00' }, to: { day: 3, time: '20:00' } }] };
    expect(planOff(wed, '2026-11-04T08:00')).toBe(true);
    expect(planOff(wed, '2026-11-04T20:00')).toBe(false);
    const weekdays = { windows: [{ from: { day: 6, time: '00:00' }, to: { day: 1, time: '00:00' } }] };
    expect(planOff(weekdays, '2026-11-07T00:00')).toBe(true);
    expect(planOff(weekdays, '2026-11-08T23:59')).toBe(true);
    expect(planOff(weekdays, '2026-11-09T00:00')).toBe(false);
  });

  it('is off for a while from when it was set until 00:00 of the day it is back', () => {
    const p = { until: '2026-11-06', since: '2026-11-04T08:00' };
    expect(planOff(p, '2026-11-04T08:00')).toBe(true);
    expect(planOff(p, '2026-11-05T23:59')).toBe(true);
    expect(planOff(p, '2026-11-06T00:00')).toBe(false);
  });

  it('is off when either the window or the off-for-a-while says so', () => {
    const both = { ...weekend, until: '2026-11-10', since: '2026-11-07T10:00' };
    expect(planOff(both, '2026-11-08T17:00')).toBe(true);
    expect(planOff(both, '2026-11-10T00:00')).toBe(false);
  });

  it('lets a tap hold until the next switch of the plan', () => {
    const tapped = { ...weekend, switchedAt: '2026-11-07T10:00' };
    // the tap showed the calendar (hidden false) inside the window
    expect(planEffectiveHidden(false, tapped, '2026-11-07T11:00')).toBe(false);
    expect(planEffectiveHidden(false, tapped, '2026-11-13T16:59')).toBe(false);
    expect(planEffectiveHidden(false, tapped, '2026-11-13T17:00')).toBe(true);
    // a tap before the window's last start no longer counts
    expect(planEffectiveHidden(false, { ...weekend, switchedAt: '2026-11-06T12:00' }, '2026-11-07T11:00')).toBe(true);
  });

  it('uses the manual switch when there is no plan', () => {
    expect(planEffectiveHidden(true, undefined, '2026-11-07T11:00')).toBe(true);
    expect(planEffectiveHidden(false, {}, '2026-11-07T11:00')).toBe(false);
  });

  it('finds the next edge of the plan', () => {
    expect(nextPlanEdge(weekend, '2026-11-07T10:00')).toBe('2026-11-08T16:00');
    expect(nextPlanEdge(weekend, '2026-11-08T16:00')).toBe('2026-11-13T17:00');
    expect(nextPlanEdge({ until: '2026-11-06', since: '2026-11-04T08:00' }, '2026-11-04T08:00')).toBe('2026-11-06T00:00');
    expect(nextPlanEdge({}, '2026-11-04T08:00')).toBeNull();
  });

  it('builds the wall time from the clock date and minutes', () => {
    expect(wallNow('2026-11-06', 17 * 60 + 5)).toBe('2026-11-06T17:05');
  });
});
