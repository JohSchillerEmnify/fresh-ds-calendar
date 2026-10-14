import { describe, expect, it } from 'vitest';
import type { Segment } from '@/lib/items';
import {
  BUTTON_FACTOR, cellNear, cellSize, centerOnCell, clampPan, clampZoom, detailAt, listHeight, MAX_ZOOM, MIN_ZOOM, panAfterZoom, parseStoredZoom,
  pinchZoom, rowSpan, smooth, stepZoom, TIMELINE_REF, timeSpan,
} from '@/features/labs/zoom/zoom';

describe('zoom range', () => {
  it('clamps from the whole month to one day filling the width', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
    expect(MAX_ZOOM).toBe(7);
  });
  it('steps by the button factor and stops at both ends', () => {
    expect(stepZoom(2, 1)).toBeCloseTo(2 * BUTTON_FACTOR);
    expect(stepZoom(2, -1)).toBeCloseTo(2 / BUTTON_FACTOR);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
  it('a pinch scales the start zoom by the finger distance ratio', () => {
    expect(pinchZoom(2, 100, 150)).toBeCloseTo(3);
    expect(pinchZoom(2, 100, 5000)).toBe(MAX_ZOOM);
    expect(pinchZoom(2, 0, 10)).toBe(2);
  });
  it('parses the remembered zoom, ignoring garbage', () => {
    expect(parseStoredZoom('3.5')).toBe(3.5);
    expect(parseStoredZoom('40')).toBe(MAX_ZOOM);
    expect(parseStoredZoom('abc')).toBeNull();
    expect(parseStoredZoom(null)).toBeNull();
  });
});

describe('anchor point', () => {
  it('keeps the world point under the anchor in place', () => {
    const pan = { x: -120, y: -40 };
    const [z0, z1, ax, ay] = [2, 3, 150, 90];
    const p = panAfterZoom(pan, z0, z1, ax, ay);
    // the world point (in layout px at zoom 1) under the anchor before and after
    expect((ax - pan.x) / z0).toBeCloseTo((ax - p.x) / z1);
    expect((ay - pan.y) / z0).toBeCloseTo((ay - p.y) / z1);
  });
  it('zooming about the top-left corner keeps the pan', () => {
    expect(panAfterZoom({ x: 0, y: 0 }, 1, 4, 0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('clamps the pan so the world always covers the viewport', () => {
    expect(clampPan({ x: 50, y: 50 }, 400, 600, 3)).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: -5000, y: -5000 }, 400, 600, 3)).toEqual({ x: -800, y: -1200 });
    expect(clampPan({ x: -10, y: -10 }, 400, 600, 1)).toEqual({ x: 0, y: 0 });
  });
  it('centres a cell, within the limits', () => {
    expect(centerOnCell(3, 2, 5, 700, 500, 7)).toEqual({ x: -(700 * 7) / 2 + 350, y: -(500 * 7) / 5 * 2.5 + 250 });
    expect(centerOnCell(0, 0, 5, 700, 500, 7)).toEqual({ x: 0, y: -100 });
    expect(centerOnCell(0, 0, 5, 700, 500, 1)).toEqual({ x: 0, y: 0 });
  });
});

describe('cells and culling', () => {
  it('cell size is viewport x zoom over the grid', () => {
    expect(cellSize(700, 500, 2, 5)).toEqual({ w: 200, h: 200 });
    expect(cellSize(700, 500, 1, 0).h).toBe(0);
  });
  it('culls cells far outside the viewport only', () => {
    const pan = { x: 0, y: 0 };
    expect(cellNear(0, 0, 100, 100, pan, 300, 300, 50)).toBe(true);
    expect(cellNear(3, 0, 100, 100, pan, 300, 300, 50)).toBe(true);
    expect(cellNear(5, 0, 100, 100, pan, 300, 300, 50)).toBe(false);
    expect(cellNear(5, 0, 100, 100, { x: -300, y: 0 }, 300, 300, 50)).toBe(true);
  });
});

describe('detail thresholds', () => {
  it('fades continuously: every weight is monotonic in the cell size', () => {
    let last = detailAt(20, 20);
    for (let s = 21; s <= 700; s += 7) {
      const d = detailAt(s, s);
      expect(d.dots).toBeLessThanOrEqual(last.dots + 1e-9);
      for (const k of ['chips', 'times', 'lists', 'timeline'] as const) expect(d[k]).toBeGreaterThanOrEqual(last[k] - 1e-9);
      last = d;
    }
  });
  it('shows dots in tiny cells, chips, then times, lists, and the timeline in big ones', () => {
    expect(detailAt(40, 60).level).toBe('dots');
    expect(detailAt(40, 60).dots).toBe(1);
    expect(detailAt(100, 100).level).toBe('chips');
    expect(detailAt(155, 155).level).toBe('times');
    expect(detailAt(157, 157).times).toBe(1);
    // the task list items are fully in while the chips still carry the cell (the timeline is less than half in)
    expect(detailAt(158, 158).lists).toBe(1);
    expect(detailAt(158, 158).timeline).toBeLessThan(0.5);
    expect(detailAt(450, 600).level).toBe('timeline');
    const huge = detailAt(900, 900);
    expect([huge.chips, huge.times, huge.lists, huge.timeline]).toEqual([1, 1, 1, 1]);
    expect(huge.dots).toBe(0);
  });
  it('a task list grows from a chip to its full need', () => {
    expect(listHeight(18, 90, 0)).toBe(18);
    expect(listHeight(18, 90, 1)).toBe(90);
    expect(listHeight(18, 90, 0.5)).toBe(54);
    expect(listHeight(18, 10, 1)).toBe(18);
  });
  it('smooth is 0 below, 1 above and 0.5 in the middle', () => {
    expect([smooth(0, 10, 20), smooth(30, 10, 20), smooth(15, 10, 20)]).toEqual([0, 1, 0.5]);
  });
  it('shows the timeline fully at the owner\'s 3.5-columns-across-a-phone cell (115 x 245), not yet at half that', () => {
    expect(detailAt(115, 245).timeline).toBe(1);
    expect(detailAt(115, 245).level).toBe('timeline');
    expect(detailAt(60, 130).timeline).toBe(0);
    expect(TIMELINE_REF).toBeCloseTo(167.9, 0);
  });
  it('the timeline weight depends on the cell size only, so equal cells always switch alike', () => {
    expect(detailAt(130, 200)).toEqual(detailAt(130, 200));
    expect(detailAt(150, 180).timeline).toBeGreaterThan(0);
    expect(detailAt(150, 180).timeline).toBeLessThan(1);
  });
  it('the largest zoom of a phone month gives the timeline, the whole month the dots', () => {
    const [vw, vh, rows] = [390, 600, 5];
    const whole = cellSize(vw, vh, MIN_ZOOM, rows);
    const one = cellSize(vw, vh, MAX_ZOOM, rows);
    expect(detailAt(whole.w, whole.h).level).toBe('dots');
    expect(detailAt(one.w, one.h).level).toBe('timeline');
  });
});

/** A minimal timed (or untimed with `null`) segment. */
const seg = (from: string | null, to = from): Segment => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return { allDay: from === null, startTime: from, startMin: from ? m(from) : 0, endMin: to ? m(to) : 0 } as unknown as Segment;
};

describe('time span', () => {
  const day = [seg('17:00', '17:15'), seg('17:15', '21:30'), seg('19:00', '22:00')];
  it('the time grid spans the whole hours of the timed items only', () => {
    expect(timeSpan(day)).toEqual({ start: 17 * 60, end: 22 * 60 });
    expect(timeSpan([seg(null), seg('09:20', '09:30')])).toEqual({ start: 9 * 60, end: 10 * 60 });
    expect(timeSpan([seg(null)])).toBeNull();
  });
  it('an item shorter than 15 min counts as 15 min', () => {
    expect(timeSpan([seg('09:10', '09:10')])).toEqual({ start: 9 * 60, end: 10 * 60 });
  });
});

describe('week row span', () => {
  it('runs from the earliest start to the latest end over every day of the row', () => {
    expect(rowSpan([[seg('08:00', '09:00')], [seg('17:00', '18:30')], []])).toEqual({ start: 8 * 60, end: 19 * 60 });
  });
  it('is at least 4 hours long', () => {
    expect(rowSpan([[seg('09:20', '09:30')], []])).toEqual({ start: 9 * 60, end: 13 * 60 });
  });
  it('moves up against midnight instead of running past it', () => {
    expect(rowSpan([[seg('22:30', '23:30')]])).toEqual({ start: 20 * 60, end: 24 * 60 });
  });
  it('is null for a row without timed items', () => {
    expect(rowSpan([[seg(null)], []])).toBeNull();
  });
});
