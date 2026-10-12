import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { approachEntries, approachLayout, approachTicks } from '@/features/labs/approach/approach';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-14';
const list = (id: string, time: string | null, title = id) => ({
  kind: 'tasklist', id, calendarId: 'primary', title, date: D, time, items: [], doneCount: 0, totalCount: 0,
  estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '',
}) as unknown as CalendarItem;
const dentist = ev('dentist', t(D, '09:00'), t(D, '10:00'), { title: 'Dentist' });
const gym = ev('gym', t(D, '11:00'), t(D, '12:00'), { title: 'Gym' });
const lunch = ev('lunch', t(D, '12:30'), t(D, '13:00'), { title: 'Lunch' });
const allDay = ev('trip', '2026-10-14', '2026-10-15', { title: 'Trip', allDay: true });

describe('approach bar entries', () => {
  const segs = segsOf([lunch, gym, dentist, list('groceries', '10:00', 'Groceries'), list('untimed', null), allDay], D);
  const titles = (nowMin: number, windowMin = 180) => approachEntries(segs, nowMin, windowMin).entries.map((s) => s.item.title);

  it('takes up to three timed entries of today within the window by start, task lists with a time included', () => {
    expect(titles(8 * 60)).toEqual(['Dentist', 'Groceries', 'Gym']);
    expect(approachEntries(segs, 8 * 60, 180).atEnd).toBe(false);
  });
  it('leaves out what starts after the window', () => {
    expect(titles(8 * 60, 120)).toEqual(['Dentist', 'Groceries']);
    expect(titles(9 * 60 + 30, 180)).toEqual(['Groceries', 'Gym', 'Lunch']);
    expect(titles(9 * 60 + 30, 120)).toEqual(['Groceries', 'Gym']);
  });
  it('leaves out the current event and what has started', () => {
    expect(titles(9 * 60, 240)).toEqual(['Groceries', 'Gym', 'Lunch']);
  });
  it('with nothing in the window the next entry of today waits at the end', () => {
    const r = approachEntries(segs, 5 * 60, 180);
    expect(r.entries.map((s) => s.item.title)).toEqual(['Dentist']);
    expect(r.atEnd).toBe(true);
  });
  it('nothing ahead today: no entries', () => {
    expect(approachEntries(segs, 13 * 60, 180)).toEqual({ entries: [], atEnd: false });
  });
});

describe('approach bar ticks', () => {
  const steps = (nowMin: number, windowMin: number, track: number) => {
    const t = approachTicks(nowMin, windowMin, track, 40);
    return t.length > 1 ? t[1].min - t[0].min : null;
  };

  it('uses the smallest step whose labels do not collide', () => {
    expect(steps(8 * 60, 180, 480)).toBe(15); // 15 min = 40 px
    expect(steps(8 * 60, 180, 400)).toBe(30); // 15 min = 33 px collides
    expect(steps(8 * 60, 360, 400)).toBe(60);
    expect(steps(8 * 60, 720, 300)).toBe(120);
    expect(steps(8 * 60, 720, 160)).toBe(180);
  });
  it('labels whole multiples of the step after now as HH:MM, inside the track', () => {
    const t = approachTicks(8 * 60 + 10, 180, 360, 40);
    expect(t.map((x) => x.label)).toEqual(['08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(t[0].x).toBeCloseTo(40);
    expect(t.every((x) => x.x >= 20 && x.x <= 340)).toBe(true);
  });
  it('wraps the labels past midnight', () => {
    expect(approachTicks(23 * 60, 180, 360, 40).map((x) => x.label)).toContain('00:00');
  });
  it('without a measured width there are no ticks', () => {
    expect(approachTicks(8 * 60, 180, 0, 40)).toEqual([]);
  });
});

describe('approach bar layout', () => {
  const segs = segsOf([dentist, list('groceries', '10:00', 'Groceries'), gym], D);
  const at = (nowMin: number, track = 360, chip = 90, windowMin = 180) =>
    approachLayout(approachEntries(segs, nowMin, windowMin).entries, nowMin, windowMin, track, chip, 40);

  it('places each chip at its start time on an absolute window, now at 0', () => {
    const l = at(8 * 60, 480, 80, 360);
    expect(l.chips.map((c) => c.minutes)).toEqual([60, 120, 180]);
    expect(l.chips.map((c) => c.x)).toEqual([80, 160, 240]);
    expect(l.rows).toBe(1);
  });
  it('narrows a chip at the end of the window so it stays inside', () => {
    const c = at(8 * 60).chips[2];
    expect(c.x).toBe(320);
    expect(c.width).toBe(40);
  });
  it('moves the next chip towards now as time passes', () => {
    expect(at(8 * 60 + 45).chips[0].x).toBeLessThan(at(8 * 60).chips[0].x);
  });
  it('puts an overlapping chip into a second row', () => {
    const l = at(8 * 60, 360, 150);
    expect(l.chips.map((c) => c.row)).toEqual([0, 1, 0]);
    expect(l.rows).toBe(2);
  });
  it('never takes more than two rows: shortens the earlier chip and fades an overlapping one', () => {
    const close = segsOf([
      ev('a', t(D, '08:10'), t(D, '09:00'), { title: 'A' }), ev('b', t(D, '08:15'), t(D, '09:00'), { title: 'B' }),
      ev('c', t(D, '08:20'), t(D, '09:00'), { title: 'C' }),
    ], D);
    const l = approachLayout(approachEntries(close, 8 * 60, 180).entries, 8 * 60, 180, 360, 90, 40);
    expect(l.rows).toBe(2);
    expect(l.chips.map((c) => c.row)).toEqual([0, 1, 0]);
    expect(l.chips[0].width).toBe(40);
    expect(l.chips[2].faded).toBe(true);
  });
  it('an entry beyond the window sits at the right end, at most a quarter of the track wide', () => {
    const r = approachEntries(segs, 5 * 60, 180);
    const l = approachLayout(r.entries, 5 * 60, 180, 360, 120, 40, r.atEnd);
    expect(l.chips[0].width).toBe(90);
    expect(l.chips[0].x).toBe(270);
    expect(l.chips[0].minutes).toBe(240);
  });
  it('without a measured width everything sits at now', () => {
    expect(at(8 * 60, 0).chips.map((c) => c.x)).toEqual([0, 0, 0]);
  });
});
