import { describe, expect, it } from 'vitest';
import { absMinutes, bedtimeWindows, DEFAULT_BEDTIME, type SegmentSource } from '@/features/bedtime/bedtime';
import { runwayModel, type RunwayModel } from '@/features/labs/runway/runway';
import { itemSegments, type Segment } from '@/lib/items';
import type { BedtimePrefs, CalendarItem } from '@/api/types';

const on = (o: Partial<BedtimePrefs> = {}): BedtimePrefs => ({ ...DEFAULT_BEDTIME, enabled: true, bedtime: '22:30', wake: '07:00', ...o });
const TODAY = '2026-10-14';
const RANGE = { from: TODAY, to: '2026-10-16' };
/** A timed event from `start` to `end` (`YYYY-MM-DDTHH:MM`). */
const event = (id: string, start: string, end: string): CalendarItem => ({ kind: 'event', id, title: id, start: `${start}:00+02:00`, end: `${end}:00+02:00`, allDay: false } as CalendarItem);
const allDay = (id: string, date: string): CalendarItem => ({ kind: 'event', id, title: id, start: date, end: '2026-10-15', allDay: true } as CalendarItem);
const list = (id: string, date: string, time: string | null, estimateMinutes: number | null = null, o: Partial<CalendarItem> = {}): CalendarItem =>
  ({ kind: 'tasklist', id, title: id, date, time, estimateMinutes, doneCount: 0, totalCount: 1, ...o } as CalendarItem);
/** The segments of the items by date, as the items store's `byDate` gives them. */
const source = (...items: CalendarItem[]): SegmentSource => {
  const segs: Segment[] = items.flatMap((it) => itemSegments(it, TODAY));
  return { get: (d) => segs.filter((s) => s.date === d) };
};
const model = (time: string, prefs: BedtimePrefs, items: SegmentSource, minLength = 0, today = TODAY): RunwayModel => {
  const nowAbs = absMinutes(today, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)));
  return runwayModel(bedtimeWindows(RANGE, prefs, items), nowAbs, items, minLength);
};
const titles = (m: RunwayModel) => (m.kind === 'runway' ? m.entries.map((e) => e.seg.item.id) : []);

describe('runwayModel', () => {
  it('is off while bedtime mode is off', () => {
    expect(model('14:00', { ...DEFAULT_BEDTIME }, source()).kind).toBe('off');
  });

  it('runs from now to tonight\'s bedtime; free is what the entries leave', () => {
    const m = model('14:00', on(), source(event('Call', '2026-10-14T15:00', '2026-10-14T16:00'), list('Dinner', TODAY, '19:00', 60)));
    expect(m).toMatchObject({ kind: 'runway', total: 510, free: 390, bedtime: '22:30' });
    expect(titles(m)).toEqual(['Call', 'Dinner']);
    if (m.kind !== 'runway') return;
    expect(m.entries.map((e) => [e.top, e.height])).toEqual([[60, 60], [300, 60]]);
  });

  it('a running entry starts at now; one past bedtime ends at bedtime; earlier ones are left out', () => {
    const m = model('14:00', on(), source(
      event('Gone', '2026-10-14T12:00', '2026-10-14T13:00'),
      event('Running', '2026-10-14T13:30', '2026-10-14T14:30'),
      event('Late', '2026-10-14T22:00', '2026-10-14T23:30'),
    ));
    expect(titles(m)).toEqual(['Running', 'Late']);
    if (m.kind !== 'runway') return;
    expect(m.entries.map((e) => [e.top, e.height])).toEqual([[0, 30], [480, 30]]);
    expect(m.free).toBe(450);
  });

  it('lays a short entry out as long as the minimum, and counts that as taken', () => {
    const m = model('14:00', on(), source(event('Pills', '2026-10-14T20:00', '2026-10-14T20:05')), 30);
    if (m.kind !== 'runway') throw new Error(m.kind);
    expect(m.entries[0].height).toBe(30);
    expect(m.free).toBe(480);
  });

  it('puts overlapping entries side by side and counts the overlap once', () => {
    const m = model('14:00', on(), source(event('A', '2026-10-14T15:00', '2026-10-14T17:00'), event('B', '2026-10-14T16:00', '2026-10-14T18:00')));
    if (m.kind !== 'runway') throw new Error(m.kind);
    expect(m.entries.map((e) => [e.col, e.cols])).toEqual([[0, 2], [1, 2]]);
    expect(m.free).toBe(510 - 180);
  });

  it('draws timed task lists, also an open one carried over with its time, but no all-day events or untimed lists', () => {
    const m = model('14:00', on(), source(
      list('Carried', '2026-10-12', '16:00', 30),
      list('Untimed', TODAY, null),
      allDay('Holiday', TODAY),
    ));
    expect(titles(m)).toEqual(['Carried']);
  });

  it('with bedtime after midnight it takes tomorrow\'s entries up to bedtime; a multi-day event is one block', () => {
    const m = model('22:00', on({ bedtime: '01:00' }), source(
      event('Party', '2026-10-14T23:00', '2026-10-15T00:30'),
      event('Snack', '2026-10-15T00:40', '2026-10-15T00:50'),
    ));
    expect(m).toMatchObject({ kind: 'runway', total: 180, bedtime: '01:00' });
    if (m.kind !== 'runway') return;
    expect(m.entries.map((e) => [e.seg.item.id, e.top, e.height])).toEqual([['Party', 60, 90], ['Snack', 160, 10]]);
  });

  it('applies the minimum once to a multi-day event, not to its piece after midnight', () => {
    const m = model('22:00', on({ bedtime: '01:00' }), source(event('Late', '2026-10-14T23:00', '2026-10-15T00:05')), 30);
    if (m.kind !== 'runway') throw new Error(m.kind);
    expect(m.entries.map((e) => [e.top, e.height, e.seg.last])).toEqual([[60, 65, true]]);
  });

  it('during the night it says when bedtime was, also exactly at bedtime', () => {
    expect(model('23:30', on({ bedtime: '23:00' }), source())).toEqual({ kind: 'passed', bedtime: '23:00' });
    expect(model('23:00', on({ bedtime: '23:00' }), source())).toEqual({ kind: 'passed', bedtime: '23:00' });
    // after midnight, before wake-up: still last night's bedtime
    expect(model('02:00', on({ bedtime: '23:00' }), source(), 0, '2026-10-15')).toEqual({ kind: 'passed', bedtime: '23:00' });
  });

  it('after wake-up it runs to the next bedtime', () => {
    expect(model('08:00', on(), source())).toMatchObject({ kind: 'runway', total: 870, free: 870 });
  });
});
