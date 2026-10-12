import { describe, expect, it } from 'vitest';
import { planMove } from '@/features/calendar/dnd';
import { barRange, barSegment, computeBars, isBarEvent, laneCount } from '@/lib/spans';
import type { CalendarItem } from '@/api/types';
import { eventFixture } from './helpers';

const ev = (id: string, s: string, e: string, o = {}) => eventFixture(id, s, e, o) as unknown as CalendarItem;
const allDay = (id: string, s: string, e: string) => ev(id, s, e, { allDay: true });
const week = (from: string) => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(from + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10));
const W = week('2026-10-12'); // Mon..Sun

describe('barRange', () => {
  it('all-day end is exclusive; single day is not a bar', () => {
    expect(barRange(allDay('a', '2026-10-17', '2026-10-20'))).toEqual({ start: '2026-10-17', last: '2026-10-19' });
    expect(isBarEvent(allDay('a', '2026-10-17', '2026-10-18'))).toBe(false);
  });
  it('timed: short overnight stays split, 24h or more is a bar, end 00:00 does not occupy the end date', () => {
    expect(isBarEvent(ev('n', '2026-10-14T22:00:00+02:00', '2026-10-15T02:00:00+02:00'))).toBe(false);
    expect(barRange(ev('l', '2026-10-14T10:00:00+02:00', '2026-10-15T10:00:00+02:00'))).toEqual({ start: '2026-10-14', last: '2026-10-15' });
    expect(barRange(ev('z', '2026-10-14T10:00:00+02:00', '2026-10-16T00:00:00+02:00'))).toEqual({ start: '2026-10-14', last: '2026-10-15' });
    expect(isBarEvent(ev('d', '2026-10-14T00:00:00+02:00', '2026-10-15T00:00:00+02:00'))).toBe(false);
  });
  it('DST: 24 wall hours across the change is under 25h elapsed rule (23 or 25 real hours)', () => {
    // 2026-10-25 is 25h long in Europe/Berlin: 00:00+02:00 -> 00:00+01:00 next day is 25h
    expect(isBarEvent(ev('d', '2026-10-25T00:30:00+02:00', '2026-10-26T00:30:00+01:00'))).toBe(true);
    // 2026-03-29 is 23h long: same wall range is < 24h, stays a block
    expect(isBarEvent(ev('s', '2026-03-29T00:30:00+01:00', '2026-03-30T00:30:00+02:00'))).toBe(false);
  });
});

describe('computeBars', () => {
  it('single week', () => {
    const [b] = computeBars([allDay('t', '2026-10-14', '2026-10-17')], W);
    expect(b).toMatchObject({ startCol: 2, endCol: 4, lane: 0, continuedFromPrev: false, continuesToNext: false, startDate: '2026-10-14', endDate: '2026-10-16' });
  });
  it('across weeks: cut at Sunday, continued flags', () => {
    const t = allDay('t', '2026-10-17', '2026-10-22');
    const [a] = computeBars([t], W);
    expect(a).toMatchObject({ startCol: 5, endCol: 6, continuesToNext: true, continuedFromPrev: false });
    const [b] = computeBars([t], week('2026-10-19'));
    expect(b).toMatchObject({ startCol: 0, endCol: 2, continuesToNext: false, continuedFromPrev: true, startDate: '2026-10-19' });
  });
  it('across month boundary', () => {
    const [b] = computeBars([allDay('t', '2026-10-30', '2026-11-03')], week('2026-10-26'));
    expect(b).toMatchObject({ startCol: 4, endCol: 6, continuesToNext: true, endDate: '2026-11-01' });
    expect(computeBars([allDay('t', '2026-10-30', '2026-11-03')], week('2026-11-02'))[0]).toMatchObject({ startCol: 0, endCol: 0, continuedFromPrev: true });
  });
  it('exclusive end: event ending Monday does not touch Monday', () => {
    expect(computeBars([allDay('t', '2026-10-08', '2026-10-12')], W)).toEqual([]);
  });
  it('DST week: timed bar over the clock change', () => {
    const [b] = computeBars([ev('d', '2026-10-24T20:00:00+02:00', '2026-10-27T08:00:00+01:00')], week('2026-10-19'));
    expect(b).toMatchObject({ startCol: 5, endCol: 6, continuesToNext: true });
    expect(computeBars([ev('d', '2026-10-24T20:00:00+02:00', '2026-10-27T08:00:00+01:00')], week('2026-10-26'))[0]).toMatchObject({ startCol: 0, endCol: 1 });
  });
  it('many overlapping bars take separate lanes, reuse freed lanes, order is stable', () => {
    const items = [
      allDay('c', '2026-10-12', '2026-10-14'), allDay('a', '2026-10-12', '2026-10-17'), allDay('b', '2026-10-12', '2026-10-15'),
      allDay('d', '2026-10-14', '2026-10-16'), allDay('e', '2026-10-13', '2026-10-14'.replace('14', '16')),
    ];
    const bars = computeBars(items, W);
    expect(bars.map((b) => [b.item.id, b.lane])).toEqual([['a', 0], ['b', 1], ['c', 2], ['e', 3], ['d', 2]]);
    expect(laneCount(bars)).toBe(4);
    expect(computeBars([...items].reverse(), W).map((b) => b.item.id)).toEqual(bars.map((b) => b.item.id));
  });
  it('range clipped to the visible days (day view)', () => {
    const [b] = computeBars([allDay('t', '2026-10-10', '2026-10-20')], ['2026-10-14']);
    expect(b).toMatchObject({ startCol: 0, endCol: 0, continuedFromPrev: true, continuesToNext: true });
  });
  it('ignores single-day, task lists', () => {
    expect(computeBars([allDay('s', '2026-10-14', '2026-10-15')], W)).toEqual([]);
  });
});

describe('bar drag shift', () => {
  it('grabbing the 2nd day and dropping 3 days later shifts the whole all-day event by 3 days', () => {
    const t = allDay('t', '2026-10-14', '2026-10-17') as never;
    const p = planMove(barSegment(t, '2026-10-15'), { date: '2026-10-18', minutes: null }, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: '2026-10-17', end: '2026-10-20', allDay: true });
  });
  it('timed bar keeps time of day and duration', () => {
    const t = ev('l', '2026-10-14T10:00:00+02:00', '2026-10-16T12:00:00+02:00') as never;
    const p = planMove(barSegment(t, '2026-10-14'), { date: '2026-10-28', minutes: null }, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: '2026-10-28T10:00:00+01:00', end: '2026-10-30T12:00:00+01:00', allDay: false });
  });
  it('same cell: no change', () => {
    expect(planMove(barSegment(allDay('t', '2026-10-14', '2026-10-17') as never, '2026-10-15'), { date: '2026-10-15', minutes: null }, 'Europe/Berlin')).toBeNull();
  });
});
