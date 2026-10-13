import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { approachEntries, approachLayout, approachTicks, type ApproachSizes } from '@/features/labs/approach/approach';
import { itemSegments } from '@/lib/items';
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

  it('takes the timed entries of today within the window by start, task lists with a time included', () => {
    expect(titles(8 * 60)).toEqual(['Dentist', 'Groceries', 'Gym']);
    expect(approachEntries(segs, 8 * 60, 180).atEnd).toBe(false);
  });
  it('takes everything within the window, not only the next three', () => {
    expect(titles(8 * 60, 360)).toEqual(['Dentist', 'Groceries', 'Gym', 'Lunch']);
  });
  it('leaves out what starts after the window', () => {
    expect(titles(8 * 60, 120)).toEqual(['Dentist', 'Groceries']);
    expect(titles(8 * 60, 60)).toEqual(['Dentist']);
  });
  it('keeps a running entry and drops it when it ends', () => {
    expect(titles(9 * 60 + 15, 240)).toEqual(['Dentist', 'Groceries', 'Gym', 'Lunch']);
    expect(titles(10 * 60, 240)).toEqual(['Groceries', 'Gym', 'Lunch']);
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
  /** Titles need 8 px per character; the waiting chip is 120 px. */
  const sizes = (o: Partial<ApproachSizes> = {}): ApproachSizes => ({
    titlePx: (s) => s.item.title.length * 8, endChipPx: 120, minBlockPx: 4, gapPx: 4, minTitlePx: 24, ...o,
  });
  const at = (nowMin: number, track = 360, windowMin = 180, entries = segs) =>
    approachLayout(approachEntries(entries, nowMin, windowMin).entries, nowMin, windowMin, track, sizes());

  it('starts a running entry at now with only the time it has left, so it slides out to the left', () => {
    const l = at(9 * 60 + 15, 360, 180, segsOf([dentist], D));
    expect(l.chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 90, true]]); // 45 min left at 2 px/min
    const later = at(9 * 60 + 45, 360, 180, segsOf([dentist], D));
    expect(later.chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 30, true]]);
    expect(at(10 * 60, 360, 180, segsOf([dentist], D)).chips).toEqual([]);
  });
  it('keeps a running task list on the track with the time it has left (default block, else its estimate)', () => {
    const tax = list('tax', '02:00', 'Tax paperwork');
    const now = 2 * 60 + 17;
    expect(at(now, 360, 180, segsOf([tax], D)).chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 26, true]]); // 13 min left
    const est = { ...tax, estimateMinutes: 90 } as CalendarItem;
    expect(at(now, 360, 180, segsOf([est], D)).chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 146, true]]); // 1 h 13 min left
  });
  it('a carried-over task list with a time sits on the track at that time today', () => {
    const tax = { ...list('tax', '02:00', 'Tax paperwork'), date: '2026-10-11', totalCount: 3, doneCount: 1 } as CalendarItem;
    const now = 2 * 60 + 17;
    const segs = itemSegments(tax, D); // rendered on today, untimed, with carriedFrom
    expect(approachEntries(segs, now, 180).entries.map((s) => [s.item.title, s.startMin, s.endMin])).toEqual([['Tax paperwork', 120, 150]]);
    expect(at(now, 360, 180, segs).chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 26, true]]);
    const est = itemSegments({ ...tax, estimateMinutes: 90 } as CalendarItem, D);
    expect(at(now, 360, 180, est).chips.map((c) => [c.x, c.width, c.running])).toEqual([[0, 146, true]]);
    // an untimed carried-over list stays off the track
    expect(approachEntries(itemSegments({ ...tax, time: null } as CalendarItem, D), now, 180).entries).toEqual([]);
  });
  it('places each block at its start time on an absolute window, now at 0', () => {
    const l = at(8 * 60, 720, 360);
    expect(l.chips.map((c) => c.minutes)).toEqual([60, 120, 180]);
    expect(l.chips.map((c) => c.x)).toEqual([120, 240, 360]);
  });
  it('makes each block as long as its duration on the track scale', () => {
    const call = ev('call', t(D, '08:30'), t(D, '08:45'), { title: 'Call' });
    const l = at(8 * 60, 720, 720, segsOf([dentist, call], D));
    const w = Object.fromEntries(l.chips.map((c) => [c.segment.item.title, c.width]));
    expect(w.Dentist).toBe(60);
    expect(w.Call).toBe(15);
    expect(w.Dentist / w.Call).toBe(4);
  });
  it('a task list block is as long as its estimate (default block when none)', () => {
    const l = at(8 * 60, 720, 360); // 2 px per minute
    expect(l.chips[1].width).toBe(2 * (l.chips[1].segment.endMin - l.chips[1].segment.startMin));
  });
  it('a block is at least the minimum width', () => {
    const tiny = ev('tiny', t(D, '08:30'), t(D, '08:31'), { title: 'T' });
    expect(at(8 * 60, 180, 720, segsOf([tiny], D)).chips[0].width).toBe(4);
  });
  it('clips a block at the track end', () => {
    const c = at(8 * 60, 360, 180).chips[2]; // Gym 11:00-12:00 starts at the end of a 3 h window
    expect(c.x + c.width).toBe(360);
    expect(c.width).toBe(4);
  });
  it('keeps the title inside when it fits, else puts it right after the block', () => {
    const l = at(8 * 60, 720, 180);
    expect(l.chips[0].width).toBe(240); // Dentist: 1 h of 3 h on 720 px
    expect(l.chips[0].titleOutside).toBe(false);
    const call = ev('call', t(D, '08:30'), t(D, '08:45'), { title: 'Call' });
    const c = at(8 * 60, 360, 720, segsOf([call], D)).chips[0];
    expect(c.width).toBe(7.5);
    expect(c.titleOutside).toBe(true);
    expect(c.titleWidth).toBe(32);
  });
  it('shortens an outside title to the room left on the track, keeps it inside below the minimum', () => {
    const late = ev('late', t(D, '10:40'), t(D, '10:45'), { title: 'Late meeting' });
    const c = at(8 * 60, 360, 180, segsOf([late], D)).chips[0];
    expect(c.titleOutside).toBe(true);
    expect(c.titleWidth).toBe(360 - (c.x + c.width + 4));
    const last = ev('last', t(D, '10:55'), t(D, '11:00'), { title: 'Last one' });
    expect(at(8 * 60, 360, 180, segsOf([last], D)).chips[0].titleOutside).toBe(false);
  });
  it('moves the next block towards now as time passes', () => {
    expect(at(8 * 60 + 45).chips[0].x).toBeLessThan(at(8 * 60).chips[0].x);
  });
  it('puts a chip overlapping the block or outside title before it into a second row', () => {
    const call = ev('call', t(D, '08:30'), t(D, '08:45'), { title: 'Call' });
    // Call: block 13.3-20, title to 56; Dentist starts at 40 → second row
    const l = at(8 * 60, 480, 720, segsOf([call, dentist], D));
    expect(l.chips.map((c) => c.row)).toEqual([0, 1]);
    expect(l.rows).toBe(2);
  });
  it('keeps chips that do not overlap in one row', () => {
    const l = at(8 * 60, 1440, 360); // 4 px per minute: every title fits inside its block
    expect(l.chips.map((c) => c.titleOutside)).toEqual([false, false, false]);
    expect(l.rows).toBe(1);
  });
  it('never takes more than two rows: shortens the earlier outside title and fades an overlapping chip', () => {
    const close = segsOf([
      ev('a', t(D, '08:10'), t(D, '08:15'), { title: 'Alpha' }), ev('b', t(D, '08:15'), t(D, '08:20'), { title: 'Bravo' }),
      ev('c', t(D, '08:20'), t(D, '08:25'), { title: 'Charlie' }),
    ], D);
    const l = at(8 * 60, 360, 180, close);
    expect(l.rows).toBe(2);
    expect(l.chips.map((c) => c.row)).toEqual([0, 1, 0]);
    // Alpha's title gives way to Charlie: block 20-30, Charlie at 40 → 6 px of title left
    expect(l.chips[0].titleWidth).toBe(6);
    expect(l.chips[2].faded).toBe(false);
    const tight = segsOf([
      ev('a', t(D, '08:10'), t(D, '08:40'), { title: 'A' }), ev('b', t(D, '08:12'), t(D, '08:40'), { title: 'B' }),
      ev('c', t(D, '08:14'), t(D, '08:40'), { title: 'C' }),
    ], D);
    const k = at(8 * 60, 360, 180, tight);
    expect(k.chips.map((c) => c.row)).toEqual([0, 1, 0]);
    expect(k.chips[0].width).toBe(60); // a block keeps its duration
    expect(k.chips[2].faded).toBe(true);
  });
  it('with many entries stays in two rows and inside the track', () => {
    const many = segsOf(Array.from({ length: 12 }, (_, i) => {
      const m = 8 * 60 + 5 + i * 10;
      const hm = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
      return ev(`e${i}`, t(D, hm(m)), t(D, hm(m + 20)), { title: `Meeting number ${i}` });
    }), D);
    const l = at(8 * 60, 320, 180, many);
    expect(l.chips).toHaveLength(12);
    expect(l.rows).toBe(2);
    for (const c of l.chips) {
      expect(c.row).toBeLessThan(2);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width + (c.titleOutside && c.titleWidth > 0 ? 4 + c.titleWidth : 0)).toBeLessThanOrEqual(320);
    }
    // per row, an outside title never runs into the next chip (it is shortened, or the next chip fades)
    for (const row of [0, 1]) {
      const r = l.chips.filter((c) => c.row === row);
      r.slice(1).forEach((c, i) => {
        const p = r[i];
        expect(p.x + p.width + (p.titleOutside && p.titleWidth > 0 ? 4 + p.titleWidth : 0) <= c.x || c.faded).toBe(true);
      });
    }
  });
  it('an entry beyond the window sits at the right end, at most a quarter of the track wide, title inside', () => {
    const r = approachEntries(segs, 5 * 60, 180);
    const l = approachLayout(r.entries, 5 * 60, 180, 360, sizes(), r.atEnd);
    expect(l.chips[0].width).toBe(90);
    expect(l.chips[0].x).toBe(270);
    expect(l.chips[0].minutes).toBe(240);
    expect(l.chips[0].titleOutside).toBe(false);
  });
  it('without a measured width everything sits at now', () => {
    expect(at(8 * 60, 0).chips.map((c) => c.x)).toEqual([0, 0, 0]);
  });
});
