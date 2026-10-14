import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { clockSegments, clockText, focusWedge, tappedTime, turnedStart } from '@/features/labs/clock/clock';
import { CENTER, clip, fadingRows, labelSizing, minuteAt, pointAt, sectorPath, VIEW, wrapDelta } from '@/features/labs/clock/geometry';
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
  it('keeps a short task list off the lane of an event that starts where it ends (the round cap would cover it)', () => {
    const { timed: tl } = clockSegments(segsOf([
      list('Einkaufsliste', '17:00', { estimateMinutes: 15 }),
      ev('evening', t(D, '17:15'), t(D, '21:30'), { title: 'Evening' }),
      ev('plain', t(D, '08:00'), t(D, '09:00'), { title: 'Plain' }),
      ev('plain2', t(D, '09:00'), t(D, '10:00'), { title: 'Plain2' }),
    ], D));
    const lane = (title: string) => tl.find((s) => s.item.title === title)!.lane;
    expect(lane('Einkaufsliste')).not.toBe(lane('Evening'));
    expect(lane('Plain')).toBe(lane('Plain2')); // events touching each other keep sharing a lane
  });
  it('names task lists with their done count, untitled ones as "List"', () => {
    expect(clockText(list('Laundry', '18:00', { doneCount: 1, totalCount: 2 }))).toBe('Laundry 1/2');
    expect(clockText(list('', null, { title: ' ', totalCount: 3 }))).toBe('List 0/3');
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
  it('draws the focus wedge to the end of the running event, else to the next start, else none', () => {
    const day = segsOf([
      ev('a', t(D, '09:00'), t(D, '10:00'), { title: 'A', color: '#111111' }),
      ev('b', t(D, '13:00'), t(D, '14:00'), { title: 'B', color: '#222222' }),
      list('L', '11:00'),
    ], D);
    expect(focusWedge(day, 570)).toEqual({ from: 570, to: 600, color: '#111111', running: true });
    expect(focusWedge(day, 630)).toEqual({ from: 630, to: 780, color: '#222222', running: false });
    expect(focusWedge(day, 900)).toBeNull();
  });
  it('builds a closed sector path, none for an empty one', () => {
    expect(sectorPath(0, 360, 100)).toMatch(/^M 220 220 L 220\.00 120\.00 A 100 100 0 0 1 320\.00 220\.00 Z$/);
    expect(sectorPath(600, 600, 100)).toBe('');
  });
});

describe('clock labels', () => {
  it('places crowded labels without overlaps and leaves out what fits nowhere', async () => {
    const { placeLabels } = await import('@/features/labs/clock/geometry');
    const labels = ['Standup', 'Dentist', 'Lunch with Sam', 'Call', 'Gym', 'Deep work'].map((text, i) => ({ key: text, mid: 560 + i * 25, text }));
    const placed = placeLabels(labels, 12, 140, 40);
    const shown = placed.filter((p) => p.shown);
    expect(shown.length).toBeGreaterThanOrEqual(4);
    const box = (p: typeof placed[0]) => {
      const w = labels.find((l) => l.key === p.key)!.text.length * 12 * 0.56;
      const x0 = p.anchor === 'end' ? p.x - w : p.anchor === 'start' ? p.x : p.x - w / 2;
      return [x0, p.y - 7.2, x0 + w, p.y + 7.2];
    };
    for (const a of shown) for (const b of shown) {
      if (a === b) continue;
      const [ax0, ay0, ax1, ay1] = box(a), [bx0, by0, bx1, by1] = box(b);
      expect(ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1, `${a.key} vs ${b.key}`).toBe(false);
    }
  });
  it('keeps labels out of the middle', async () => {
    const { placeLabels } = await import('@/features/labs/clock/geometry');
    const keep = { x0: CENTER - 95, y0: CENTER - 12, x1: CENTER + 95, y1: CENTER + 70 };
    const [p] = placeLabels([{ key: 'a', mid: 720, text: 'Lunch' }], 12, 60, 20, [keep]);
    expect(p.shown).toBe(false);
  });
  it('finds room for the label of a short list on the left side of the dial beside the time in the middle', async () => {
    const { placeLabels } = await import('@/features/labs/clock/geometry');
    const keep = { x0: CENTER - 95, y0: CENTER - 12, x1: CENTER + 95, y1: CENTER + 70 };
    const placed = placeLabels([
      { key: 'evening', mid: 1162, text: 'Abend zu zweit' },
      { key: 'list', mid: 1027, text: 'Einkaufsliste 0/1' },
    ], 10, 125, 40, [keep]);
    expect(placed.find((p) => p.key === 'list')!.shown).toBe(true);
  });
});
