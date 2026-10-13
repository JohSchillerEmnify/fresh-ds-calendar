import { describe, expect, it } from 'vitest';
import { absMinutes, bedtimeWindows, clipToDay, trackBands, DEFAULT_BEDTIME, firstTimedStart, tonight, type SegmentSource } from '@/features/bedtime/bedtime';
import type { BedtimePrefs } from '@/api/types';
import type { Segment } from '@/lib/items';

const on = (o: Partial<BedtimePrefs> = {}): BedtimePrefs => ({ ...DEFAULT_BEDTIME, enabled: true, ...o });
const dynamic = (o: Partial<BedtimePrefs> = {}) => on({ mode: 'dynamic', ...o });
/** A timed segment on a date starting at `hhmm`. */
const timed = (date: string, hhmm: string, o: Partial<Segment> = {}): Segment => {
  const startMin = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  return { item: { kind: 'event', id: 'e' + date + hhmm } as Segment['item'], date, allDay: false, startTime: hhmm, endTime: '23:00', startMin, endMin: startMin + 60, first: true, last: true, ...o };
};
const source = (...segs: Segment[]): SegmentSource => ({ get: (d) => segs.filter((s) => s.date === d) });
const none = source();
// 2026-10-14 is a Wednesday
const DAY = { from: '2026-10-14', to: '2026-10-15' };

describe('bedtimeWindows', () => {
  it('gives nothing while bedtime mode is off', () => {
    expect(bedtimeWindows(DAY, { ...DEFAULT_BEDTIME }, none)).toEqual([]);
  });

  it('fixed times: the night before and the night after a day, across midnight', () => {
    const w = bedtimeWindows(DAY, on(), none);
    expect(w.map((x) => [x.from, x.to, x.mode])).toEqual([
      ['2026-10-13 23:00', '2026-10-14 07:00', 'fixed'],
      ['2026-10-14 23:00', '2026-10-15 07:00', 'fixed'],
    ]);
  });

  it('a week touches the night before its first day and the night after its last', () => {
    const w = bedtimeWindows({ from: '2026-10-12', to: '2026-10-19' }, on(), none);
    expect(w).toHaveLength(8);
    expect(w[0].from).toBe('2026-10-11 23:00');
    expect(w[7].from).toBe('2026-10-18 23:00');
  });

  it('works with a bedtime after midnight (a weekend pair 00:00 to 09:00 lies inside the wake-up day)', () => {
    const w = bedtimeWindows({ from: '2026-10-17', to: '2026-10-19' }, on({ weekendDifferent: true }), none);
    // Saturday 17th: wake-up day of the Friday night; Sunday 18th: wake-up day of the Saturday night
    expect(w.map((x) => [x.from, x.to])).toEqual([['2026-10-17 00:00', '2026-10-17 09:00'], ['2026-10-18 00:00', '2026-10-18 09:00'], ['2026-10-18 23:00', '2026-10-19 07:00']]);
  });

  it('the weekend pair applies to the nights before Saturday and Sunday only', () => {
    const w = bedtimeWindows({ from: '2026-10-16', to: '2026-10-20' }, on({ weekendDifferent: true, weekendBedtime: '23:59', weekendWake: '10:00' }), none);
    expect(w.map((x) => x.to)).toEqual(['2026-10-16 07:00', '2026-10-17 10:00', '2026-10-18 10:00', '2026-10-19 07:00', '2026-10-20 07:00']);
  });

  it('is empty when bedtime and wake-up are the same time', () => {
    expect(bedtimeWindows(DAY, on({ bedtime: '07:00', wake: '07:00' }), none)).toEqual([]);
  });

  it('dynamic: first appointment 07:30, 1 h lead, 8 h sleep gives 22:30 to 06:30', () => {
    const w = bedtimeWindows(DAY, dynamic(), source(timed('2026-10-15', '07:30')));
    expect(w[1]).toMatchObject({ from: '2026-10-14 22:30', to: '2026-10-15 06:30', mode: 'dynamic' });
    // the other night has no appointment: fixed
    expect(w[0]).toMatchObject({ from: '2026-10-13 23:00', to: '2026-10-14 07:00', mode: 'fixed' });
  });

  it('dynamic is never later than the fixed times (the whole fixed pair applies)', () => {
    const w = bedtimeWindows(DAY, dynamic(), source(timed('2026-10-15', '10:00')));
    expect(w[1]).toMatchObject({ from: '2026-10-14 23:00', to: '2026-10-15 07:00', mode: 'fixed' });
    // exactly equal is not earlier either
    const eq = bedtimeWindows(DAY, dynamic(), source(timed('2026-10-15', '08:00')));
    expect(eq[1]).toMatchObject({ from: '2026-10-14 23:00', mode: 'fixed' });
  });

  it('dynamic falls back to fixed without a timed appointment', () => {
    const allDay = timed('2026-10-15', '00:00', { allDay: true, startTime: null, endTime: null });
    const w = bedtimeWindows(DAY, dynamic(), source(allDay));
    expect(w[1]).toMatchObject({ from: '2026-10-14 23:00', to: '2026-10-15 07:00', mode: 'fixed' });
  });

  it('dynamic follows the earliest of several appointments and honours the lead and sleep settings', () => {
    const w = bedtimeWindows(DAY, dynamic({ sleepMinutes: 420, leadMinutes: 30 }), source(timed('2026-10-15', '09:00'), timed('2026-10-15', '06:45')));
    // wake 06:15, bed 23:15 on the 14th: later than... 23:15 is after 23:00, so the fixed pair stays
    expect(w[1]).toMatchObject({ from: '2026-10-14 23:00', mode: 'fixed' });
    const early = bedtimeWindows(DAY, dynamic({ sleepMinutes: 420, leadMinutes: 30 }), source(timed('2026-10-15', '06:00')));
    expect(early[1]).toMatchObject({ from: '2026-10-14 22:30', to: '2026-10-15 05:30', mode: 'dynamic' });
  });

  it('dynamic uses the weekend fixed pair as the limit on a weekend wake-up day', () => {
    const w = bedtimeWindows({ from: '2026-10-16', to: '2026-10-18' }, dynamic({ weekendDifferent: true }), source(timed('2026-10-17', '12:00')));
    expect(w[1]).toMatchObject({ from: '2026-10-17 00:00', to: '2026-10-17 09:00', mode: 'fixed' });
  });
});

describe('firstTimedStart', () => {
  it('counts timed items that start on the day, not all-day, untimed, or continuation segments', () => {
    const cont = timed('2026-10-15', '00:00', { first: false });
    const untimed = timed('2026-10-15', '00:00', { startTime: null, endTime: null });
    expect(firstTimedStart(source(cont, untimed), '2026-10-15')).toBeNull();
    expect(firstTimedStart(source(cont, timed('2026-10-15', '09:15')), '2026-10-15')).toBe(9 * 60 + 15);
  });

  it('counts a timed task list', () => {
    const list = timed('2026-10-15', '07:00', { item: { kind: 'tasklist', id: 'l' } as Segment['item'] });
    expect(firstTimedStart(source(list), '2026-10-15')).toBe(420);
  });
});

describe('clipToDay and tonight', () => {
  const [before, after] = bedtimeWindows(DAY, on(), none);

  it('splits a night over midnight into two pieces and marks where it starts and ends', () => {
    expect(clipToDay(after, '2026-10-14')).toEqual({ startMin: 1380, endMin: 1440, startsHere: true, endsHere: false });
    expect(clipToDay(after, '2026-10-15')).toEqual({ startMin: 0, endMin: 420, startsHere: false, endsHere: true });
    expect(clipToDay(before, '2026-10-14')).toEqual({ startMin: 0, endMin: 420, startsHere: false, endsHere: true });
    expect(clipToDay(after, '2026-10-16')).toBeNull();
    expect(clipToDay(after, '2026-10-13')).toBeNull();
  });

  it('tonight is the first night that has not ended', () => {
    const win = bedtimeWindows({ from: '2026-10-14', to: '2026-10-16' }, on(), none);
    expect(tonight(win, win[1].start - 30)?.from).toBe('2026-10-14 23:00');
    expect(tonight(win, win[1].end)?.from).toBe('2026-10-15 23:00');
    expect(tonight([], 0)).toBeNull();
  });
});

describe('trackBands', () => {
  const win = bedtimeWindows({ from: '2026-10-14', to: '2026-10-16' }, on(), none);
  const at = (hhmm: string) => absMinutes('2026-10-14', Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));

  it('shows bedtime inside a 3 h track as a stretch from 23:00 to the end, with the moon', () => {
    const [b] = trackBands(win, at('21:00'), 180);
    expect(b.left).toBeCloseTo(120 / 180);
    expect(b.left + b.width).toBeCloseTo(1);
    expect(b).toMatchObject({ moon: true, sun: false });
  });

  it('while it is night the band starts at now, and shows the sun when wake-up is on the track', () => {
    const [b] = trackBands(win, at('05:00') + 1440, 180);
    expect(b.left).toBe(0);
    expect(b.width).toBeCloseTo(120 / 180);
    expect(b).toMatchObject({ moon: false, sun: true });
  });

  it('is empty when no night is on the track', () => {
    expect(trackBands(win, at('10:00'), 180)).toEqual([]);
  });
});
