import { describe, expect, it } from 'vitest';
import { itemSegments, matchesFilters, packColumns, segmentsByDate } from '@/lib/items';
import type { CalendarItem } from '@/api/types';
import { eventFixture } from './helpers';

const ev = (id: string, s: string, e: string, o = {}) => eventFixture(id, s, e, o) as unknown as CalendarItem;
const tl = (o: Record<string, unknown>) => ({ kind: 'tasklist', id: 't', title: 'T', date: '2026-10-14', time: null, items: [], doneCount: 0, totalCount: 0,
  categoryId: null, tags: [], color: '#000000', etag: 'x', ...o }) as unknown as CalendarItem;

describe('segments', () => {
  it('all-day end is exclusive, multi-day timed splits at midnight', () => {
    const s = itemSegments(ev('a', '2026-10-16', '2026-10-19', { allDay: true }));
    expect(s.map((x) => x.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    const t = itemSegments(ev('b', '2026-10-14T22:00:00+02:00', '2026-10-15T02:00:00+02:00'));
    expect(t.map((x) => [x.date, x.startTime, x.endTime])).toEqual([['2026-10-14', '22:00', '24:00'], ['2026-10-15', '00:00', '02:00']]);
  });
  it('orders a day: all-day, untimed lists, then timed by start', () => {
    const m = segmentsByDate([
      ev('timed', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00'),
      tl({ id: 'untimed', title: 'U' }),
      ev('allday', '2026-10-14', '2026-10-15', { allDay: true }),
    ]);
    expect(m.get('2026-10-14')!.map((s) => s.item.id)).toEqual(['allday', 'untimed', 'timed']);
  });
});

describe('overlap packing', () => {
  const seg = (id: string, s: string, e: string) => itemSegments(ev(id, `2026-10-14T${s}:00+02:00`, `2026-10-14T${e}:00+02:00`))[0];
  it('splits a cluster into equal columns; touching items do not overlap', () => {
    const p = packColumns([seg('a', '09:00', '10:00'), seg('b', '09:30', '11:00'), seg('c', '11:00', '12:00')]);
    const by = Object.fromEntries(p.map((x) => [x.seg.item.id, x]));
    expect([by.a.cols, by.b.cols, by.c.cols]).toEqual([2, 2, 1]);
    expect(by.a.col).not.toBe(by.b.col);
  });
});

describe('filters', () => {
  const list = tl({ categoryId: 'shopping', tags: ['Weekend'] });
  it('OR within a group, AND between groups, events never filtered', () => {
    expect(matchesFilters(list, { categories: ['shopping', 'work'], tags: [] })).toBe(true);
    expect(matchesFilters(list, { categories: ['work'], tags: [] })).toBe(false);
    expect(matchesFilters(list, { categories: ['shopping'], tags: ['weekend'] })).toBe(true);
    expect(matchesFilters(list, { categories: ['home'], tags: ['weekend'] })).toBe(false);
    expect(matchesFilters(tl({ categoryId: null }), { categories: ['none'], tags: [] })).toBe(true);
    expect(matchesFilters(ev('e', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00'), { categories: ['work'], tags: [] })).toBe(true);
  });
});
