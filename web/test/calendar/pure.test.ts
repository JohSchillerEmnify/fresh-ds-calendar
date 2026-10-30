import { describe, expect, it } from 'vitest';
import { blockGeometry, packColumns, itemSegments } from '@/lib/items';
import { diffInput, formFromEvent, newForm, toInput, validate, withStart } from '@/features/calendar/eventForm';
import { formatDuration, nowCardModel, nowMarkerTop } from '@/features/calendar/timeline';
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
  it('a block is never drawn past its real end, even alone with free space below it (owner, 2026-10-21)', () => {
    const a = ev('a', t(D, '20:00'), t(D, '20:15')), c = ev('c', t(D, '20:15'), t(D, '21:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, c], D), (s) => (s.item.id === 'a' ? 60 : 0)).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.c].map((x) => [x.col, x.cols, x.level])).toEqual([[0, 1, 0], [0, 1, 0]]);
    expect(p.a.height).toBe(15);
    const alone = packColumns(segsOf([a], D), (s) => (s.item.id === 'a' ? 60 : 0));
    expect(alone[0].height).toBe(15);
    // a zero-length event still occupies one minute
    expect(packColumns(segsOf([ev('z', t(D, '07:00'), t(D, '07:00'))], D), 31)[0].height).toBe(1);
  });
  it('back-to-back half-hour events are all drawn the same height, the last one included (owner, 2026-10-21)', () => {
    const run = [['11:00', '11:30'], ['11:30', '12:00'], ['12:00', '12:30']].map(([s, e], i) => ev('r' + i, t(D, s), t(D, e)));
    expect(packColumns(segsOf(run, D), 37.5).map((x) => x.height)).toEqual([30, 30, 30]);
  });
  it('a block drawn at its minimum height is not cascaded over by a truly overlapping block starting inside that height', () => {
    const a = ev('a', t(D, '17:00'), t(D, '17:20')), c = ev('c', t(D, '17:15'), t(D, '21:30')), d = ev('d', t(D, '19:00'), t(D, '22:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, c, d], D), 31).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.c].map((x) => [x.level, x.cols])).toEqual([[0, 2], [0, 2]]);
    expect(p.a.col).not.toBe(p.c.col);
    expect(p.d.level).toBe(1);
  });
  it('a later block cascades only when it leaves a whole title row of the earlier one visible (owner, 2026-10-20)', () => {
    // a 60-min list and an event 15 min in: at 44 px/h one 18 px title row is ~24.5 min, so they share columns
    const a = ev('a', t(D, '18:00'), t(D, '19:00')), b = ev('b', t(D, '18:15'), t(D, '19:15'));
    const at = (hh: number) => Object.fromEntries(packColumns(segsOf([a, b], D), (25 / hh) * 60, true, (18 / hh) * 60).map((x) => [x.seg.item.id, x]));
    const low = at(44);
    expect([low.a, low.b].map((x) => [x.level, x.cols])).toEqual([[0, 2], [0, 2]]);
    // at 72 px/h the title row is exactly 15 min: the cascade stays (later block on top, one level deeper)
    const high = at(72);
    expect([high.a.level, high.b.level]).toEqual([0, 1]);
  });
  it('a minimum event length lays a shorter block out as that long: drawn so, and overlapping what starts within it', () => {
    const a = ev('a', t(D, '11:00'), t(D, '11:15')), b = ev('b', t(D, '11:15'), t(D, '11:30'));
    const p = Object.fromEntries(packColumns(segsOf([a, b], D), 31, true, 0, 30).map((x) => [x.seg.item.id, x]));
    expect([p.a.height, p.b.height]).toEqual([30, 30]);
    expect([p.a.cols, p.b.cols]).toEqual([2, 2]);
    expect(p.a.col).not.toBe(p.b.col);
    // a block already longer than the minimum keeps its real length; off (0) is the strict rule
    expect(packColumns(segsOf([ev('c', t(D, '13:00'), t(D, '13:20'))], D), 31, true, 0, 15)[0].height).toBe(20);
    expect(packColumns(segsOf([a, b], D), 31, true, 0, 0).map((x) => [x.cols, x.height])).toEqual([[1, 15], [1, 15]]);
  });
  it('back-to-back short events stay in one full-width column at their real length', () => {
    const a = ev('a', t(D, '09:00'), t(D, '09:30')), b = ev('b', t(D, '09:30'), t(D, '10:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, b], D), 31).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.b].map((x) => [x.col, x.cols, x.span, x.level])).toEqual([[0, 1, 1, 0], [0, 1, 1, 0]]);
    expect(p.a.height).toBe(30);
    expect(p.b.height).toBe(30);
  });
  it('a 5-min event followed 10 min later by another is one column, not cascaded, and drawn 5 min tall', () => {
    const a = ev('a', t(D, '08:00'), t(D, '08:05')), n = ev('n', t(D, '08:10'), t(D, '09:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, n], D), 31).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.n].map((x) => [x.col, x.cols, x.level])).toEqual([[0, 1, 0], [0, 1, 0]]);
    expect(p.a.height).toBe(5);
  });
  it('truly overlapping events still get two columns, each at its real length', () => {
    const a = ev('a', t(D, '09:00'), t(D, '09:30')), b = ev('b', t(D, '09:20'), t(D, '10:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, b], D), 31).map((x) => [x.seg.item.id, x]));
    expect(p.a.cols).toBe(2);
    expect(p.a.col).not.toBe(p.b.col);
    expect(p.a.height).toBe(30);
  });
  it('a short event with a truly overlapping later one shares columns with it (start gap under the minimum)', () => {
    const a = ev('a', t(D, '09:00'), t(D, '09:05')), b = ev('b', t(D, '09:03'), t(D, '10:00'));
    const p = Object.fromEntries(packColumns(segsOf([a, b], D), 31).map((x) => [x.seg.item.id, x]));
    expect([p.a, p.b].map((x) => [x.cols, x.level])).toEqual([[2, 0], [2, 0]]);
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
  it('a short block does not claim its minimum height when packing (real times decide)', () => {
    const pill = ev('p', t(D, '08:00'), t(D, '08:05')), next = ev('n', t(D, '08:10'), t(D, '09:00'));
    const placed = packColumns(segsOf([pill, next], D), 30);
    expect(placed.every((p) => p.cols === 1)).toBe(true);
  });
  it('overnight events are split per day, DST wall clock is kept', () => {
    const night = ev('night', t('2026-10-14', '22:00'), t('2026-10-15', '02:00'));
    const segs = itemSegments(night);
    expect(segs.map((s) => [s.date, s.startTime, s.endTime])).toEqual([['2026-10-14', '22:00', '24:00'], ['2026-10-15', '00:00', '02:00']]);
    const after = ev('physio', '2026-10-26T09:00:00+01:00', '2026-10-26T10:00:00+01:00');
    expect(itemSegments(after)[0]).toMatchObject({ startMin: 540, endMin: 600 });
  });
});

describe('side by side up to a limit (owner, 2026-10-25)', () => {
  // the day/week grid at 48 px/h: one 18 px title row is 22.5 min, the cascade gap is max(15, that)
  const pack = (items: ReturnType<typeof ev>[], limit: number) =>
    Object.fromEntries(packColumns(segsOf(items, D), (25 / 48) * 60, true, (18 / 48) * 60, 0, limit).map((x) => [x.seg.item.id, x]));
  const at = (id: string, s: string, e: string) => ev(id, t(D, s), t(D, e));
  const board = [at('a', '09:00', '10:00'), at('b', '09:00', '10:30'), at('c', '09:00', '10:30'), at('d', '09:30', '11:00')];
  it('up to 4: four overlapping entries take one of four equal columns each', () => {
    const p = pack(board, 4);
    expect(Object.values(p).every((x) => x.cols === 4 && x.span === 1 && x.level === 0)).toBe(true);
    expect(new Set(Object.values(p).map((x) => x.col)).size).toBe(4);
  });
  it('up to 3: the fourth is laid over the last column, one level up, longer same-start entries first', () => {
    const p = pack(board, 3);
    expect([p.b.col, p.c.col, p.a.col]).toEqual([0, 1, 2]);
    expect([p.a, p.b, p.c].every((x) => x.cols === 3 && x.level === 0)).toBe(true);
    expect([p.d.col, p.d.cols, p.d.level, p.d.span]).toEqual([2, 3, 1, 1]);
  });
  it('up to 2: further entries cascade over the last column, which stays busy until they end', () => {
    const p = pack([at('dentist', '09:00', '10:00'), at('standup', '09:00', '10:30'), at('call', '09:30', '11:00'), at('review', '10:00', '11:30')], 2);
    expect([p.standup.col, p.dentist.col]).toEqual([0, 1]);
    expect([p.call.col, p.call.level]).toEqual([1, 1]);
    expect([p.review.col, p.review.level]).toEqual([1, 2]);
    expect(Object.values(p).every((x) => x.cols === 2)).toBe(true);
  });
  it('a later entry takes the leftmost column an earlier one has left', () => {
    const p = pack([at('dentist', '09:00', '10:00'), at('standup', '09:15', '10:30'), at('gym', '10:00', '11:00')], 2);
    expect([p.dentist.col, p.standup.col, p.gym.col, p.gym.level]).toEqual([0, 1, 0, 0]);
  });
  it('an entry that would cover a title gets one more column, beyond the limit', () => {
    const p = pack([at('a', '09:00', '10:00'), at('b', '09:00', '10:00'), at('c', '09:05', '10:00')], 2);
    expect(Object.values(p).map((x) => [x.cols, x.level])).toEqual([[3, 0], [3, 0], [3, 0]]);
    expect(new Set(Object.values(p).map((x) => x.col)).size).toBe(3);
  });
  it('the extra column for a title is one at most; further close starts are laid over the last column', () => {
    const p = pack([at('a', '09:00', '10:00'), at('b', '09:05', '10:30'), at('c', '09:05', '10:00'), at('d', '09:10', '10:00')], 2);
    expect([p.a, p.b, p.c].map((x) => [x.col, x.cols, x.level])).toEqual([[0, 3, 0], [1, 3, 0], [2, 3, 0]]);
    expect([p.d.col, p.d.cols, p.d.level]).toEqual([2, 3, 1]);
  });
  it('entries with the same start and end keep the order they come in (the day\'s usual order)', () => {
    const x = at('x', '09:00', '10:00'), y = at('y', '09:00', '10:00');
    const cols = (items: ReturnType<typeof ev>[]) => packColumns(segsOf(items, D), 0, true, 0, 0, 2).map((p) => [p.seg.item.id, p.col]);
    expect(cols([x, y])).toEqual([['x', 0], ['y', 1]]);
    expect(cols([y, x])).toEqual([['y', 0], ['x', 1]]);
  });
  it('cascade depth is capped at 3', () => {
    const many = ['09:00', '09:00', '09:30', '10:00', '10:30', '11:00'].map((s, i) => at('m' + i, s, '12:00'));
    const p = pack(many, 2);
    expect(Object.values(p).map((x) => x.level)).toEqual([0, 0, 1, 2, 3, 3]);
  });
  it('a block widens into free columns to its right; back-to-back entries stay full width', () => {
    const p = pack([at('long', '09:00', '12:00'), at('short', '09:00', '09:30'), at('x', '09:00', '09:45'), at('late', '10:00', '11:00')], 3);
    expect([p.long.cols, p.late.col, p.late.span]).toEqual([3, 1, 2]);
    const q = pack([at('a', '09:00', '10:00'), at('b', '10:00', '11:00')], 2);
    expect([q.a.cols, q.b.cols, q.b.col]).toEqual([1, 1, 0]);
  });
  it('without a limit the layout is unchanged (Labs views)', () => {
    const a = ev('a', t(D, '09:00'), t(D, '10:30')), b = ev('b', t(D, '09:30'), t(D, '10:30'));
    expect(packColumns(segsOf([a, b], D)).map((x) => x.level)).toEqual([0, 1]);
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
});
