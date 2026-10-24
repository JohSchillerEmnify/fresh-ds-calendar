import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { clockFocus, clockMiddle, clockSegments, clockText, focusWedge, tappedTime, turnedStart } from '@/features/labs/clock/clock';
import {
  alongArcLabel, alongHits, CENTER, clip, fadingRows, gapTrimmed, labelSizing, minuteAt, placeLabelsNear, pointAt, radiusAt, ringLayout, sectorPath, VIEW, wrapDelta,
} from '@/features/labs/clock/geometry';
import { ev, segsOf, t } from './helpers';

const D = '2026-10-14';
const list = (id: string, time: string | null, o: Record<string, unknown> = {}) => ({
  kind: 'tasklist', id, calendarId: 'primary', title: id, date: D, time, items: [], doneCount: 0, totalCount: 0,
  estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '', ...o,
}) as unknown as CalendarItem;

describe('clock selection', () => {
  const segs = segsOf([
    ev('dentist', t(D, '09:00'), t(D, '10:00'), { title: 'Dentist' }),
    ev('trip', D, '2026-10-15', { title: 'Trip', allDay: true }),
    list('Laundry', '09:30', { estimateMinutes: 90 }),
    list('Call', '18:00'),
    list('Groceries', null),
  ], D);
  const { timed, untimed, allDay } = clockSegments(segs);

  it('makes timed events and timed task lists arcs, all-day events chips, untimed task lists the middle', () => {
    expect(timed.map((s) => s.item.title).sort()).toEqual(['Call', 'Dentist', 'Laundry']);
    expect(untimed.map((s) => s.item.title)).toEqual(['Groceries']);
    expect(allDay.map((s) => s.item.title)).toEqual(['Trip']);
  });
  it('gives a task list its estimate, else 30 minutes, and puts overlaps on inner lanes', () => {
    const by = (title: string) => timed.find((s) => s.item.title === title)!;
    expect([by('Laundry').startTime, by('Laundry').endTime, by('Laundry').lane]).toEqual(['09:30', '11:00', 1]);
    expect([by('Call').startTime, by('Call').endTime, by('Call').lane]).toEqual(['18:00', '18:30', 0]);
  });
  it('keeps entries that only touch on one ring (square ends and a gap keep them apart)', () => {
    const { timed: tl } = clockSegments(segsOf([
      list('Einkaufsliste', '17:00', { estimateMinutes: 15 }),
      ev('evening', t(D, '17:15'), t(D, '21:30'), { title: 'Evening' }),
      ev('plain', t(D, '08:00'), t(D, '09:00'), { title: 'Plain' }),
      ev('plain2', t(D, '09:00'), t(D, '10:00'), { title: 'Plain2' }),
    ], D));
    const lane = (title: string) => tl.find((s) => s.item.title === title)!.lane;
    expect(lane('Einkaufsliste')).toBe(lane('Evening'));
    expect(lane('Plain')).toBe(lane('Plain2'));
  });
  it('draws every entry at least 15 minutes long, longer with a minimum event length, and lays out rings by that', () => {
    const day = segsOf([
      ev('pill', t(D, '11:00'), t(D, '11:05'), { title: 'Pill' }),
      ev('vit', t(D, '11:05'), t(D, '11:15'), { title: 'Vitamins' }),
      ev('a', t(D, '13:00'), t(D, '13:15'), { title: 'A' }),
      ev('b', t(D, '13:15'), t(D, '13:30'), { title: 'B' }),
      ev('late', t(D, '23:55'), '2026-10-15T00:00:00+02:00', { title: 'Late' }),
    ], D);
    const by = (tl: ReturnType<typeof clockSegments>['timed'], title: string) => tl.find((s) => s.item.title === title)!;
    const plain = clockSegments(day).timed;
    expect([by(plain, 'Pill').drawStart, by(plain, 'Pill').drawEnd]).toEqual([660, 675]);
    expect([by(plain, 'Pill').startTime, by(plain, 'Pill').endTime]).toEqual(['11:00', '11:05']); // real times stay
    expect(by(plain, 'Pill').lane).not.toBe(by(plain, 'Vitamins').lane);
    expect(by(plain, 'A').lane).toBe(by(plain, 'B').lane);
    expect([by(plain, 'Late').drawStart, by(plain, 'Late').drawEnd]).toEqual([1425, 1440]); // kept on the day
    const min30 = clockSegments(day, 30).timed;
    expect([by(min30, 'A').drawStart, by(min30, 'A').drawEnd]).toEqual([780, 810]);
    expect(by(min30, 'A').lane).not.toBe(by(min30, 'B').lane);
  });
  it('keeps the next entry off a ring until the name before it has room, when names need room', () => {
    const day = segsOf([
      ev('lunch', t(D, '12:00'), t(D, '12:30'), { title: 'Lunch' }),
      ev('dentist', t(D, '12:30'), t(D, '13:00'), { title: 'Dentist' }),
      ev('later', t(D, '14:00'), t(D, '15:00'), { title: 'Later' }),
    ], D);
    const tl = clockSegments(day, 0, () => 60).timed;
    const lane = (title: string) => tl.find((s) => s.item.title === title)!.lane;
    expect(lane('Dentist')).not.toBe(lane('Lunch'));
    expect(lane('Later')).toBe(lane('Lunch'));
  });
  it('names task lists with their done count, untitled ones neutrally as "Task list"', () => {
    expect(clockText(list('Laundry', '18:00', { doneCount: 1, totalCount: 2 }))).toBe('Laundry 1/2');
    expect(clockText(list('', null, { title: ' ', totalCount: 3 }))).toBe('Task list 0/3');
    expect(clockText(segs[0].item)).toBe('Dentist');
  });
});

describe('clock geometry', () => {
  it('keeps labels between 11 and 16 screen pixels and fits more characters on a bigger dial', () => {
    const small = labelSizing(300), base = labelSizing(VIEW), big = labelSizing(900);
    expect(small.font * (300 / VIEW)).toBeCloseTo(11);
    expect(base.font).toBeCloseTo(12);
    expect(big.font * (900 / VIEW)).toBeCloseTo(16);
    expect(small.maxChars).toBeLessThan(big.maxChars);
    expect(labelSizing(0)).toEqual(base);
  });
  it('clips long text with an ellipsis', () => {
    expect(clip('Laundry', 10)).toBe('Laundry');
    expect(clip('A very long title', 6)).toBe('A ver…');
  });
  it('shows the rows that fit and fades the last ones when more are left', () => {
    expect(fadingRows(2, 4)).toEqual([1, 1]);
    expect(fadingRows(6, 4)).toEqual([1, 1, 2 / 3, 1 / 3]);
    expect(fadingRows(3, 1)).toEqual([1 / 2]);
    expect(fadingRows(3, 0)).toEqual([]);
  });
});

describe('clock gestures', () => {
  it('reads the minute under a point: midnight at the top, 06:00 right, 12:00 bottom, 18:00 left', () => {
    for (const m of [0, 360, 720, 1080, 555]) {
      const p = pointAt(m, 150);
      expect(minuteAt(p.x, p.y)).toBeCloseTo(m, 6);
    }
    expect(minuteAt(CENTER, CENTER - 10)).toBe(0);
  });
  it('turns the short way round past midnight', () => {
    expect(wrapDelta(1430, 10)).toBe(20);
    expect(wrapDelta(10, 1430)).toBe(-20);
    expect(wrapDelta(0, 720)).toBe(720);
  });
  it('snaps a turned arc to 15 minutes, keeps its length and keeps it on the day', () => {
    expect(turnedStart(540, 600, 37)).toBe(570); // 09:00 + 37 min -> 09:37 -> 09:30
    expect(turnedStart(540, 600, 38)).toBe(585);
    expect(turnedStart(540, 600, -600)).toBe(0);
    expect(turnedStart(1320, 1410, 200)).toBe(1350); // 90 min long: may start no later than 22:30
  });
  it('turns a tap into the nearest quarter hour', () => {
    expect(tappedTime(607)).toBe('10:00');
    expect(tappedTime(608)).toBe('10:15');
    expect(tappedTime(1435)).toBe('00:00');
  });
  it('draws the focus wedge to the end of the running entry, else to the next start, else none; timed task lists count', () => {
    const day = segsOf([
      ev('a', t(D, '09:00'), t(D, '10:00'), { title: 'A', color: '#111111' }),
      ev('b', t(D, '13:00'), t(D, '14:00'), { title: 'B', color: '#222222' }),
      list('L', '11:00', { color: '#333333' }),
    ], D);
    const own = (s: { item: CalendarItem }) => (s.item as { color: string }).color;
    expect(focusWedge(day, 570, own)).toEqual({ from: 570, to: 600, color: '#111111', running: true });
    expect(focusWedge(day, 630, own)).toEqual({ from: 630, to: 660, color: '#333333', running: false });
    expect(focusWedge(day, 670, own)).toEqual({ from: 670, to: 690, color: '#333333', running: true });
    expect(focusWedge(day, 700, own)).toEqual({ from: 700, to: 780, color: '#222222', running: false });
    expect(focusWedge(day, 900, own)).toBeNull();
    expect(focusWedge(day, 630, () => '#abcdef')!.color).toBe('#abcdef');
  });
  it('builds a closed sector path, none for an empty one', () => {
    expect(sectorPath(0, 360, 100)).toMatch(/^M 220 220 L 220\.00 120\.00 A 100 100 0 0 1 320\.00 220\.00 Z$/);
    expect(sectorPath(600, 600, 100)).toBe('');
  });
});

describe('clock rings', () => {
  it('puts rings 20 apart with a 4-unit gap, squeezes them when many are needed, but never below the narrowest band', () => {
    const spec = { outer: 158, inner: 96, step: 20, gap: 4, minWidth: 8 };
    const few = ringLayout(3, spec);
    expect([few.r(0), few.r(1), few.r(2), few.width, few.shown]).toEqual([158, 138, 118, 16, 3]);
    const many = ringLayout(6, spec);
    expect(many.r(5)).toBeCloseTo(96);
    expect(many.r(0) - many.r(1) - many.width).toBeCloseTo(4);
    const tooMany = ringLayout(12, spec);
    expect(tooMany.shown).toBe(6);
    expect(tooMany.width).toBeGreaterThanOrEqual(8);
  });
  it('trims both ends of an arc by half the gap, so back-to-back arcs on a ring stay apart, but keeps a sliver', () => {
    const a = gapTrimmed(540, 600, 158, 4), b = gapTrimmed(600, 660, 158, 4);
    expect(a.to).toBeLessThan(b.from);
    expect(a.from).toBeGreaterThan(540);
    expect(((b.from - a.to) / 1440) * 2 * Math.PI * 158).toBeCloseTo(4);
    const tiny = gapTrimmed(600, 601, 158, 4);
    expect(tiny.to - tiny.from).toBeGreaterThan(0);
  });
});

describe('clock labels near their arcs', () => {
  const ring = (key: string, from: number, to: number, r = 158, w = 16) => ({ key, from, to, r, w });
  const keep = { x0: CENTER - 95, y0: CENTER - 12, x1: CENTER + 95, y1: CENTER + 70 };
  it('puts a lone arc\'s name right inside it, on its own angle', () => {
    const arcs = [ring('night', 1380, 1439)];
    const [p] = placeLabelsNear([{ ...arcs[0], text: 'Night train' }], arcs, { font: 12, plate: 176, keepOut: [keep] });
    expect(p.shown).toBe(true);
    // just inside the ring: closer to it than to the middle
    expect(radiusAt(p.x, p.y)).toBeGreaterThan(110);
    expect(Math.abs(wrapDelta(minuteAt(p.x, p.y), 1410))).toBeLessThan(90);
  });
  it('never lets a name overlap another name, an arc or the middle; what has no room overflows', () => {
    const arcs = [
      ring('a', 540, 600), ring('b', 570, 660, 138), ring('c', 585, 615, 118), ring('lunch', 720, 780), ring('physio', 780, 825),
      ring('parcel', 840, 855), ring('sync', 850, 865, 138), ring('gym', 1020, 1110), ring('dinner', 1170, 1320), ring('night', 1380, 1439),
    ];
    const texts: Record<string, string> = { a: 'Dentist', b: 'Design review…', c: 'Call', lunch: 'Lunch', physio: 'Physio', parcel: 'Pick up parcel', sync: 'Quick sync', gym: 'Gym', dinner: 'Dinner with A…', night: 'Night train' };
    const placed = placeLabelsNear(arcs.map((a) => ({ ...a, text: texts[a.key] })), arcs, { font: 12, plate: 176, keepOut: [keep] });
    const shown = placed.filter((p) => p.shown);
    expect(shown.length).toBeGreaterThanOrEqual(7);
    for (const a of shown) {
      expect(a.box.x0 < keep.x1 && keep.x0 < a.box.x1 && a.box.y0 < keep.y1 && keep.y0 < a.box.y1, `${a.key} in the middle`).toBe(false);
      for (const b of shown) {
        if (a === b) continue;
        const [x, y] = [a.box, b.box];
        expect(x.x0 < y.x1 && y.x0 < x.x1 && x.y0 < y.y1 && y.y0 < x.y1, `${a.key} vs ${b.key}`).toBe(false);
      }
      // no point of a name's box (its whole area, every unit) lies on an arc band
      for (let x = a.box.x0; x <= a.box.x1; x += 1) for (let y = a.box.y0; y <= a.box.y1; y += 1) {
        const r = radiusAt(x, y), m = minuteAt(x, y);
        for (const arc of arcs) expect(Math.abs(r - arc.r) < arc.w / 2 && m > arc.from && m < arc.to, `${a.key} on ${arc.key} at ${x},${y}`).toBe(false);
      }
    }
  });
  it('starts every leader line on its own arc, also across midnight', () => {
    const arcs = [ring('late', 1425, 1440), ring('crowd', 1380, 1425, 138)];
    const [p] = placeLabelsNear([{ ...arcs[0], text: 'Night bus home' }], arcs, { font: 12, plate: 176, keepOut: [keep] });
    expect(p.shown).toBe(true);
    expect(radiusAt(p.fx, p.fy)).toBeCloseTo(158 - 8);
    const m = minuteAt(p.fx, p.fy);
    expect(m >= 1424.9 || m <= 0.1, `leader at minute ${m}`).toBe(true);
  });
  it('starts the leader on an arc longer than half a day at its nearest end', () => {
    const arcs = [ring('long', 120, 1080)];
    const [p] = placeLabelsNear([{ ...arcs[0], text: 'Conference' }], arcs, { font: 12, plate: 176, keepOut: [keep] });
    expect(p.shown).toBe(true);
    const m = minuteAt(p.fx, p.fy);
    expect(m >= 119.9 && m <= 1080.1, `leader at minute ${m}`).toBe(true);
  });
  it('cuts a long name that fits nowhere whole, and overflows one with no room at all', () => {
    const arcs = [ring('x', 700, 740)];
    const long = 'A name far too long to fit anywhere on this tiny plate';
    const [cut] = placeLabelsNear([{ ...arcs[0], text: long }], arcs, { font: 12, plate: 176, keepOut: [keep] });
    expect(cut.shown).toBe(true);
    expect(cut.text.endsWith('…')).toBe(true);
    expect(cut.text.length).toBeLessThan(long.length);
    const everything = { x0: 0, y0: 0, x1: 440, y1: 440 };
    const [none] = placeLabelsNear([{ ...arcs[0], text: 'Lunch' }], arcs, { font: 12, plate: 176, keepOut: [everything] });
    expect(none.shown).toBe(false);
  });
});

describe('clock names along the rings (rings variant)', () => {
  it('tells when a name along a ring runs into the middle text', () => {
    const middle = [{ x0: CENTER - 80, y0: CENTER + 40, x1: CENTER + 80, y1: CENTER + 70 }];
    expect(alongHits(660, 780, 60, 12, middle)).toBe(true); // lower half, a ring that far in: right through the line
    expect(alongHits(660, 780, 156, 12, middle)).toBe(false); // outer ring passes below it
    expect(alongHits(0, 120, 60, 12, middle)).toBe(false); // upper half
  });
  it('runs clockwise on the upper half and turns on the lower half, so the text is never upside down', () => {
    const top = alongArcLabel(1320, 1439, 150, 11, 'Night'), bottom = alongArcLabel(660, 780, 150, 11, 'Lunch');
    expect(top.flipped).toBe(false);
    expect([top.anchor, top.offset > 0]).toEqual(['start', true]);
    expect(bottom.flipped).toBe(true);
    // the turned path runs from the end of the free run back to the arc's start, where the text ends
    expect(bottom.d.startsWith(`M ${pointAt(780, bottom.rBase).x.toFixed(2)}`)).toBe(true);
    expect(bottom.anchor).toBe('end');
  });
  it('lets the name run on along the free ring and cuts it where the next arc starts, giving up below three characters', () => {
    const long = alongArcLabel(540, 600, 150, 11, 'Design review with the whole team');
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.text.length).toBeLessThan(12);
    expect(alongArcLabel(540, 720, 150, 11, 'Design review with the whole team').text.length).toBeGreaterThan(long.text.length);
    expect(alongArcLabel(540, 545, 150, 11, 'Call').text).toBe('');
    expect(alongArcLabel(540, 720, 150, 11, 'Call').text).toBe('Call');
  });
});

describe('clock middle (what runs or comes next, on two lines)', () => {
  const T = '2026-10-15';
  const TZ = 'Europe/Berlin';
  /** The instant of a wall-clock time on D (summer time, +02:00), in ms. */
  const at = (hm: string, date = D) => Date.parse(t(date, hm));
  const today = segsOf([
    ev('dentist', t(D, '09:00'), t(D, '10:00'), { title: 'Dentist' }),
    ev('call', t(D, '09:30'), t(D, '09:45'), { title: 'Call' }),
    ev('holiday', D, T, { title: 'Holiday', allDay: true }),
    list('Laundry', '18:00', { estimateMinutes: 90 }),
    list('Groceries', null),
  ], D);
  const tomorrow = segsOf([
    ev('allday', T, '2026-10-16', { title: 'Trip', allDay: true }),
    ev('late', t(T, '11:00'), t(T, '12:00'), { title: 'Late' }),
    ev('standup', t(T, '09:00'), t(T, '09:15'), { title: 'Standup' }),
  ], T);
  const pick = (now: number, tm = tomorrow, td = today) => { const f = clockFocus(td, tm, now); return f && [f.kind, f.seg.item.title]; };
  const say = (hm: string, td = today, tm = tomorrow) => {
    const [h, m] = hm.split(':').map(Number);
    return clockMiddle(clockFocus(td, tm, h * 60 + m), at(hm), TZ);
  };

  it('picks the running entry ending first, else the next timed entry today, else tomorrow\'s first, else none', () => {
    expect(pick(415)).toEqual(['next', 'Dentist']);
    expect(pick(560)).toEqual(['running', 'Dentist']);
    expect(pick(575)).toEqual(['running', 'Call']);
    expect(pick(600)).toEqual(['next', 'Laundry']);
    expect(pick(1110)).toEqual(['running', 'Laundry']);
    expect(pick(1200)).toEqual(['tomorrow', 'Standup']);
    expect(pick(1200, [])).toBeNull();
    expect(pick(1200, segsOf([ev('allday', T, '2026-10-16', { title: 'Trip', allDay: true })], T))).toBeNull();
  });
  it('words the next entry as start and time until, the running one as end and time left', () => {
    expect(say('06:55')).toEqual({ title: 'Dentist', when: '09:00 · in 2 h 5 min' });
    expect(say('08:00')).toEqual({ title: 'Dentist', when: '09:00 · in 1 h' });
    // seconds into the minute do not count, like the minute the hand shows
    expect(clockMiddle(clockFocus(today, tomorrow, 480), at('08:00') + 1500, TZ)).toEqual({ title: 'Dentist', when: '09:00 · in 1 h' });
    expect(say('08:37')).toEqual({ title: 'Dentist', when: '09:00 · in 23 min' });
    expect(say('09:20')).toEqual({ title: 'Dentist', when: 'until 10:00 · 40 min left' });
    expect(say('18:30')).toEqual({ title: 'Laundry', when: 'until 19:30 · 1 h left' });
  });
  it('names tomorrow\'s first entry by its time only, and says nothing else today with nothing at all', () => {
    expect(say('20:00')).toEqual({ title: 'Standup', when: 'Tomorrow 09:00' });
    expect(clockMiddle(null, at('20:00'), TZ)).toEqual({ line: 'Nothing else today' });
  });
  it('counts an entry that began before midnight as running', () => {
    const night = segsOf([ev('night', t('2026-10-13', '22:00'), t(D, '02:00'), { title: 'Night shift', color: '#444444' })], D);
    expect(clockMiddle(clockFocus(night, [], 60), at('01:00'), TZ)).toEqual({ title: 'Night shift', when: 'until 02:00 · 1 h left' });
    expect(focusWedge(night, 60, () => '#444444')).toEqual({ from: 60, to: 120, color: '#444444', running: true });
  });
  it('does not name the rest of an entry that began today as tomorrow\'s first', () => {
    const late = segsOf([ev('late', t(D, '23:00'), t(T, '01:00'), { title: 'Late' })], T);
    expect(clockFocus([], [...late, ...tomorrow], 1200)?.seg.item.title).toBe('Standup');
  });
  it('ends an entry that runs past midnight at 00:00 and names an untitled task list', () => {
    const late = segsOf([ev('night', t(D, '23:00'), t(T, '01:00'), { title: 'Night' }), list('', '20:00')], D);
    expect(say('23:10', late, [])).toEqual({ title: 'Night', when: 'until 00:00 · 50 min left' });
    expect(say('19:50', late, [])).toEqual({ title: 'Task list', when: '20:00 · in 10 min' });
  });
  it('counts real time across the change back from summer time (25 Oct 2026, 03:00 -> 02:00)', () => {
    const X = '2026-10-25';
    const day = segsOf([ev('run', `${X}T09:00:00+01:00`, `${X}T10:00:00+01:00`, { title: 'Run' })], X);
    // 01:00 summer time is 9 real hours before 09:00 winter time (the wall clock says 8)
    expect(clockMiddle(clockFocus(day, [], 60), Date.parse(`${X}T01:00:00+02:00`), TZ)).toEqual({ title: 'Run', when: '09:00 · in 9 h' });
    const night = segsOf([ev('n', `2026-10-24T23:00:00+02:00`, `${X}T04:00:00+01:00`, { title: 'Night' })], X);
    expect(clockMiddle(clockFocus(night, [], 60), Date.parse(`${X}T01:00:00+02:00`), TZ)).toEqual({ title: 'Night', when: 'until 04:00 · 4 h left' });
  });
});
