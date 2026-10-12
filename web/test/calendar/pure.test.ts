import { describe, expect, it } from 'vitest';
import { blockGeometry, packColumns, itemSegments } from '@/lib/items';
import { diffInput, formFromEvent, newForm, toInput, validate, withStart } from '@/features/calendar/eventForm';
import { dueWarnings, formatDuration, nowCardModel, nowMarkerTop } from '@/features/calendar/timeline';
import { localToIso, offsetMinutes } from '@/features/calendar/zone';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-12';
const dentist = ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist' });
const call = ev('call', t(D, '13:00'), t(D, '13:30'), { title: 'Call' });

describe('event form validation', () => {
  const ok = () => ({ ...newForm('2026-10-14', '10:00', 'primary', null), title: 'Dentist' });
  it('accepts a valid form', () => expect(validate(ok())).toBeNull());
  it('requires a non-blank title', () => {
    expect(validate({ ...ok(), title: '' })?.message).toBe('Title is required');
    expect(validate({ ...ok(), title: '   ' })?.message).toBe('Title is required');
  });
  it('limits the title to 200 characters', () => {
    expect(validate({ ...ok(), title: 'x'.repeat(201) })?.message).toBe('Title must be at most 200 characters');
    expect(validate({ ...ok(), title: 'x'.repeat(200) })).toBeNull();
  });
  it.each([
    ['10:00', '2026-10-14', '09:00'], ['10:00', '2026-10-14', '10:00'], ['10:00', '2026-10-13', '11:00'],
  ])('rejects end <= start (%s -> %s %s)', (st, ed, et) => {
    expect(validate({ ...ok(), startTime: st, endDate: ed, endTime: et })?.message).toBe('End must be after start');
  });
  it('all-day: end date (inclusive) may equal start, not precede it', () => {
    const f = { ...ok(), allDay: true, startDate: '2026-10-16', endDate: '2026-10-16' };
    expect(validate(f)).toBeNull();
    expect(validate({ ...f, endDate: '2026-10-15' })?.message).toBe('End must be after start');
  });
  it('rejects invalid dates/times and over-long events', () => {
    expect(validate({ ...ok(), startDate: '2026-02-30' })?.field).toBe('startDate');
    expect(validate({ ...ok(), startTime: '25:00' })?.field).toBe('startTime');
    expect(validate({ ...ok(), endDate: '2028-10-14' })?.message).toMatch(/366/);
  });
  it('changing the start keeps the duration (also across midnight)', () => {
    const f = { ...ok(), startTime: '09:00', endTime: '10:30' };
    const g = withStart(f, f.startDate, '11:00');
    expect([g.endDate, g.endTime]).toEqual(['2026-10-14', '12:30']);
    const h = withStart({ ...f, startTime: '22:00', endTime: '23:30' }, '2026-10-14', '23:00');
    expect([h.endDate, h.endTime]).toEqual(['2026-10-15', '00:30']);
  });
});

describe('form <-> API', () => {
  it('all-day end is exclusive in the API and inclusive in the form', () => {
    const f = { ...newForm('2026-10-17', null, 'primary', null), title: 'Trip', allDay: true, endDate: '2026-10-20' };
    const input = toInput(f, 'Europe/Berlin');
    expect(input).toMatchObject({ allDay: true, start: '2026-10-17', end: '2026-10-21' });
    const back = formFromEvent({ ...ev('x', '2026-10-17', '2026-10-21'), allDay: true, title: 'Trip' });
    expect(back.endDate).toBe('2026-10-20');
  });
  it('timed values carry the DST-correct offset', () => {
    expect(localToIso('2026-10-14', '09:00', 'Europe/Berlin')).toBe('2026-10-14T09:00:00+02:00');
    expect(localToIso('2026-10-26', '09:00', 'Europe/Berlin')).toBe('2026-10-26T09:00:00+01:00');
    expect(offsetMinutes(Date.parse('2026-12-01T12:00:00Z'), 'Europe/Berlin')).toBe(60);
  });
  it('the diff only contains changed fields, colour reset sends null', () => {
    const e = ev('a', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist', colorId: '10' });
    const f = { ...formFromEvent(e), colorId: '' };
    expect(diffInput(toInput(f, 'Europe/Berlin'), e)).toEqual({ colorId: null });
  });
});

describe('packing and proportions', () => {
  const hh = 48;
  it('block height is proportional to duration, min 25px box (24 visible + 1 gap), top is the start', () => {
    const a = blockGeometry(10 * 60 + 40, 11 * 60 + 30, hh), b = blockGeometry(14 * 60, 15 * 60 + 40, hh);
    expect(b.height / a.height).toBeCloseTo(2, 5);
    expect(a.top).toBeCloseTo((640 / 60) * hh);
    const pill = blockGeometry(8 * 60, 8 * 60 + 5, hh);
    expect(pill.height).toBe(25);
    expect(pill.top).toBe(8 * hh);
  });
  it('events starting close together share columns, back-to-back ones do not', () => {
    const a = ev('a', t(D, '09:00'), t(D, '10:00')), b = ev('b', t(D, '09:10'), t(D, '10:30')), c = ev('c', t(D, '10:00'), t(D, '11:00'));
    const placed = packColumns(segsOf([a, b], D));
    expect(placed.map((p) => [p.col, p.cols, p.level])).toEqual([[0, 2, 0], [1, 2, 0]]);
    const back = packColumns(segsOf([a, c], D));
    expect(back.map((p) => [p.col, p.cols, p.span])).toEqual([[0, 1, 1], [0, 1, 1]]);
  });
  it('a block drawn taller than its duration counts with its drawn height (A-E5)', () => {
    // "a" lasts 15 min but is drawn an hour tall (like a task list with open items on a phone), "c" starts after it.
    const a = ev('a', t(D, '20:00'), t(D, '20:15')), c = ev('c', t(D, '20:15'), t(D, '21:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, c], D), (s) => (s.item.id === 'a' ? 60 : 0)).map((x) => [x.seg.item.id, x]));
    expect(p.c.level > p.a.level || p.c.col !== p.a.col).toBe(true);
  });
  it('a block widens into free columns to its right', () => {
    const a = ev('a', t(D, '09:00'), t(D, '12:00')), b = ev('b', t(D, '09:00'), t(D, '09:10')), c = ev('c', t(D, '09:10'), t(D, '12:00'));
    const placed = packColumns(segsOf([a, b, c], D));
    const byId = Object.fromEntries(placed.map((p) => [p.seg.item.id, p]));
    expect(byId.a.cols).toBe(2);
    expect(byId.b.span).toBe(1);
    expect(byId.c.col).toBe(1);
    // three mutually overlapping
    const x = ev('x', t(D, '09:00'), t(D, '10:30')), y = ev('y', t(D, '09:05'), t(D, '10:30')), z = ev('z', t(D, '09:10'), t(D, '11:00'));
    expect(packColumns(segsOf([x, y, z], D)).every((p) => p.cols === 3)).toBe(true);
  });
  it('overlaps starting 15+ min apart cascade instead of splitting columns', () => {
    const a = ev('a', t(D, '09:00'), t(D, '10:30')), b = ev('b', t(D, '09:30'), t(D, '10:30')), c = ev('c', t(D, '09:45'), t(D, '11:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, b, c], D)).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.b, p.c].map((x) => [x.level, x.cols, x.span])).toEqual([[0, 1, 1], [1, 1, 1], [2, 1, 1]]);
  });
  it('a level frees up when its blocks end; depth is capped and falls back to columns', () => {
    const a = ev('a', t(D, '09:00'), t(D, '12:00')), b = ev('b', t(D, '09:30'), t(D, '10:00')), c = ev('c', t(D, '10:00'), t(D, '11:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, b, c], D)).map((x) => [x.seg.item.id, x.level]));
    expect(p).toEqual({ a: 0, b: 1, c: 1 });
    const many = ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40'].map((s, i) => ev('m' + i, t(D, s), t(D, '12:00')));
    const placed = packColumns(segsOf(many, D));
    expect(Math.max(...placed.map((x) => x.level))).toBe(3);
    expect(placed.filter((x) => x.level === 3).every((x) => x.cols > 1)).toBe(true);
  });
  it('a short block occupies its minimum height when packing', () => {
    const pill = ev('p', t(D, '08:00'), t(D, '08:05')), next = ev('n', t(D, '08:10'), t(D, '09:00'));
    const placed = packColumns(segsOf([pill, next], D), 30);
    expect(placed.every((p) => p.cols === 2)).toBe(true);
  });
  it('overnight events are split per day, DST wall clock is kept', () => {
    const night = ev('night', t('2026-10-14', '22:00'), t('2026-10-15', '02:00'));
    const segs = itemSegments(night);
    expect(segs.map((s) => [s.date, s.startTime, s.endTime])).toEqual([['2026-10-14', '22:00', '24:00'], ['2026-10-15', '00:00', '02:00']]);
    const after = ev('physio', '2026-10-26T09:00:00+01:00', '2026-10-26T10:00:00+01:00');
    expect(itemSegments(after)[0]).toMatchObject({ startMin: 540, endMin: 600 });
  });
});

describe('now marker and Now card math', () => {
  it('now marker top is minutes * hour height', () => {
    expect(nowMarkerTop(9 * 60 + 20, 48)).toBeCloseTo((560 / 60) * 48);
  });
  it('formats durations', () => {
    expect([35, 120, 80, 125, 0, 59.9].map(formatDuration)).toEqual(['35 min', '2 h', '1 h 20 min', '2 h 5 min', '0 min', '59 min']);
  });
  const segs = segsOf([dentist, call], D);
  it('next event before the first one', () => {
    const m = nowCardModel(segs, 9 * 60 + 20);
    expect(m.current).toBeNull();
    expect(m.nextLine).toBe('Next: Dentist in 1 h 20 min');
  });
  it('current event with time left, progress and next', () => {
    const m = nowCardModel(segs, 9 * 60 + 20 + 95);
    expect(m.current?.line).toBe('Dentist · 35 min left');
    expect(m.current?.elapsedPercent).toBe(30);
    expect(m.nextLine).toBe('Next: Call in 2 h 5 min');
    const m2 = nowCardModel(segs, 9 * 60 + 20 + 115);
    expect(m2.current?.line).toBe('Dentist · 15 min left');
    expect(m2.current?.elapsedPercent).toBe(70);
  });
  it('nothing else today; the event ending first wins when several run', () => {
    expect(nowCardModel(segs, 13 * 60 + 40).nextLine).toBe('Nothing else today');
    const long = ev('long', t(D, '10:00'), t(D, '12:00'), { title: 'Long' });
    expect(nowCardModel(segsOf([long, dentist], D), 11 * 60).current?.title).toBe('Dentist');
  });
  it('transition warnings are due within the window only', () => {
    expect(dueWarnings(segs, 10 * 60 + 25, 10)).toEqual([]);
    expect(dueWarnings(segs, 10 * 60 + 30, 10)).toMatchObject([{ title: 'Dentist', inMin: 10 }]);
    expect(dueWarnings(segs, 10 * 60 + 40, 10)).toEqual([]);
    expect(dueWarnings(segs, 10 * 60 + 30, 0)).toEqual([]);
  });
});
