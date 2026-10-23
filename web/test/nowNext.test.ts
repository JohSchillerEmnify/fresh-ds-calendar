import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { nowNextModel } from '@/features/labs/nownext/nowNext';
import { itemSegments } from '@/lib/items';
import { ev, segsOf, t } from './calendar/helpers';

const D = '2026-10-14';
const m = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const list = (id: string, o: { time?: string | null; date?: string; items?: Array<[string, boolean]> } = {}) => {
  const items = (o.items ?? [['Milk', false]]).map(([title, done], i) => ({ id: `${id}-${i}`, title, done }));
  return {
    kind: 'tasklist', id, calendarId: 'tasks', title: id, date: o.date ?? D, time: o.time ?? null, items,
    doneCount: items.filter((i) => i.done).length, totalCount: items.length,
    estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '',
  } as unknown as CalendarItem;
};
const dentist = ev('dentist', t(D, '14:00'), t(D, '15:00'), { title: 'Dentist' });
const call = ev('call', t(D, '16:20'), t(D, '16:40'), { title: 'Call Mia' });
const gym = ev('gym', t(D, '17:00'), t(D, '18:00'), { title: 'Gym' });
const trip = ev('trip', D, '2026-10-15', { title: 'Trip', allDay: true });
/** Segments of today, carried-over lists included (as the views get them). */
const today = (items: CalendarItem[]) => items.flatMap((it) => itemSegments(it, D)).filter((s) => s.date === D);
const title = (s: { segment: { item: CalendarItem } } | null | undefined) => s?.segment.item.title;

describe('Now / Next deck model', () => {
  it('Now: the running event with the time left and the share still left', () => {
    const r = nowNextModel(segsOf([dentist, call], D), m('14:25'));
    expect(r.now).toMatchObject({ kind: 'running', leftMin: 35, leftPercent: 58 });
    expect(r.now.kind === 'running' && r.now.segment.item.title).toBe('Dentist');
  });
  it('Next: the first timed entry starting after now, with the minutes until it', () => {
    const r = nowNextModel(segsOf([gym, call, dentist], D), m('14:25'));
    expect(title(r.next)).toBe('Call Mia');
    expect(r.next).toMatchObject({ startMin: m('16:20'), inMin: 115 });
  });
  it('Later: the timed entries after Next, by start; task lists with a time included', () => {
    const r = nowNextModel(today([gym, call, dentist, list('Laundry', { time: '18:30' })]), m('10:00'));
    expect(title(r.next)).toBe('Dentist');
    expect(r.later.map(title)).toEqual(['Call Mia', 'Gym', 'Laundry']);
  });
  it('Now without a running event: the first open task list and its first unticked item', () => {
    const r = nowNextModel(today([dentist, list('Groceries', { items: [['Milk', true], ['Eggs', false]] })]), m('10:00'));
    expect(r.now).toMatchObject({ kind: 'tasks', task: 'Eggs' });
    expect(r.now.kind === 'tasks' && r.now.segment.item.title).toBe('Groceries');
  });
  it('skips a finished list and a list whose time is still to come', () => {
    const r = nowNextModel(today([list('Done', { items: [['Milk', true]] }), list('Evening', { time: '18:00' })]), m('10:00'));
    expect(r.now).toEqual({ kind: 'free', untilMin: m('18:00') });
    expect(title(r.next)).toBe('Evening');
  });
  it('a list whose time has come counts, and an older carried-over list comes first', () => {
    const r = nowNextModel(today([list('Morning', { time: '09:00' }), list('Old', { date: '2026-10-12' })]), m('10:00'));
    expect(r.now.kind === 'tasks' && r.now.segment.item.title).toBe('Old');
    const r2 = nowNextModel(today([list('Morning', { time: '09:00' })]), m('10:00'));
    expect(r2.now.kind === 'tasks' && r2.now.segment.item.title).toBe('Morning');
  });
  it('a running event wins over an open task list', () => {
    expect(nowNextModel(today([dentist, list('Groceries')]), m('14:10')).now.kind).toBe('running');
  });
  it('free until the next start, or for the rest of the day; all-day entries are left out', () => {
    expect(nowNextModel(segsOf([dentist, trip], D), m('10:00')).now).toEqual({ kind: 'free', untilMin: m('14:00') });
    const late = nowNextModel(segsOf([dentist, trip], D), m('20:00'));
    expect(late).toEqual({ now: { kind: 'free', untilMin: null }, next: null, later: [] });
  });
  it('an event across midnight counts its real time left, share and end', () => {
    const night = ev('night', t(D, '22:00'), t('2026-10-15', '02:00'), { title: 'Night shift' });
    const before = nowNextModel(segsOf([night], D), m('23:30')).now;
    expect(before).toMatchObject({ kind: 'running', leftMin: 150, leftPercent: 63, endTime: '02:00' });
    const after = nowNextModel(segsOf([night], '2026-10-15'), m('01:00')).now;
    expect(after).toMatchObject({ kind: 'running', leftMin: 60, leftPercent: 25, endTime: '02:00' });
  });
  it('of two running events the one ending first is Now', () => {
    const long = ev('long', t(D, '14:00'), t(D, '16:00'), { title: 'Workshop' });
    const r = nowNextModel(segsOf([long, dentist], D), m('14:30'));
    expect(r.now.kind === 'running' && r.now.segment.item.title).toBe('Dentist');
  });
  it('a carried-over list with a time still to come is Next, not Now', () => {
    const r = nowNextModel(today([list('Old', { date: '2026-10-12', time: '18:00' })]), m('10:00'));
    expect(r.now).toEqual({ kind: 'free', untilMin: m('18:00') });
    expect(title(r.next)).toBe('Old');
  });
});
