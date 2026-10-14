import { describe, expect, it } from 'vitest';
import type { Segment } from '@/lib/items';
import { createZoomController } from '@/features/labs/zoom/zoomGestures';
import { clampPanTo, MONTH_MODEL, panAfterZoom2 } from '@/features/labs/zoom/zoom';
import {
  BAR_PX, baseRowHeight, clampHZoom, hourStep, hWheelAxes, layoutRow, layoutRows, MAX_ZX, MAX_ZY, MIN_LANE_PX, MIN_ZX, MIN_ZY, parseStoredHZoom, pxPerHour, stepAxis,
} from '@/features/labs/htime/htime';

const ev = (id: string, startMin: number, endMin: number): Segment => ({
  item: { id, kind: 'event', title: id } as Segment['item'], date: '2026-10-14', allDay: false,
  startTime: 'x', endTime: 'y', startMin, endMin, first: true, last: true,
});
const allDay = (id: string): Segment => ({ ...ev(id, 0, 1440), allDay: true, startTime: null, endTime: null });
const keys = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };

describe('two-axis zoom', () => {
  it('clamps each axis on its own range', () => {
    expect(clampHZoom({ x: 0.1, y: 99 })).toEqual({ x: MIN_ZX, y: MAX_ZY });
    expect(clampHZoom({ x: 99, y: 0.1 })).toEqual({ x: MAX_ZX, y: MIN_ZY });
    expect(clampHZoom({ x: Number.NaN, y: 2 })).toEqual({ x: MIN_ZX, y: 2 });
  });
  it('a button step changes one axis only', () => {
    expect(stepAxis({ x: 2, y: 2 }, 'x', 1)).toEqual({ x: 2.5, y: 2 });
    expect(stepAxis({ x: 2, y: 2 }, 'y', -1).x).toBe(2);
    expect(stepAxis({ x: MAX_ZX, y: 1 }, 'x', 1).x).toBe(MAX_ZX);
  });
  it('the wheel zooms time with Ctrl or Cmd, the day height with Shift+Ctrl or Alt, else it pans', () => {
    expect(hWheelAxes({ ...keys, ctrlKey: true })).toBe('x');
    expect(hWheelAxes({ ...keys, metaKey: true })).toBe('x');
    expect(hWheelAxes({ ...keys, ctrlKey: true, shiftKey: true })).toBe('y');
    expect(hWheelAxes({ ...keys, altKey: true })).toBe('y');
    expect(hWheelAxes(keys)).toBeNull();
    expect(MONTH_MODEL.wheel({ ...keys, ctrlKey: true })).toBe('xy');
  });
  it('keeps the point under the gesture in place per axis', () => {
    const p = panAfterZoom2({ x: -100, y: -40 }, { x: 2, y: 1 }, { x: 4, y: 1 }, 50, 30);
    expect(p).toEqual({ x: 50 - (50 + 100) * 2, y: -40 });
  });
  it('clamps the pan to a world, and a small world sits at the top left', () => {
    expect(clampPanTo({ x: 50, y: -999 }, 300, 200, { w: 900, h: 500 })).toEqual({ x: 0, y: -300 });
    expect(clampPanTo({ x: -5, y: -5 }, 300, 200, { w: 100, h: 100 })).toEqual({ x: 0, y: 0 });
  });
  it('parses the remembered zoom, ignoring garbage', () => {
    expect(parseStoredHZoom('{"x":4,"y":2}')).toEqual({ x: 4, y: 2 });
    expect(parseStoredHZoom('{"x":400,"y":2}')).toEqual({ x: MAX_ZX, y: 2 });
    expect(parseStoredHZoom('nope')).toBeNull();
    expect(parseStoredHZoom('{"x":"a"}')).toBeNull();
    expect(parseStoredHZoom(null)).toBeNull();
  });
});

describe('controller with two axes', () => {
  const mk = () => {
    const log: { z: { x: number; y: number }; x: number; y: number }[] = [];
    const ctl = createZoomController({ z: { x: 2, y: 1 }, x: 0, y: 0 }, {
      size: () => ({ w: 300, h: 200 }), origin: () => ({ x: 0, y: 0 }), live: () => undefined,
      commit: (z, x, y) => log.push({ z, x, y }),
    }, { clamp: clampHZoom, world: (z, vw, vh) => ({ w: vw * z.x, h: vh * z.y }), wheel: hWheelAxes });
    return { ctl, log };
  };
  it('zooms one axis and keeps the other', () => {
    const { ctl } = mk();
    ctl.zoomTo({ x: 2, y: 3 }, 0, 0);
    expect(ctl.state().z).toEqual({ x: 2, y: 3 });
    ctl.zoomTo({ x: 5, y: 3 }, 150, 100);
    expect(ctl.state().z).toEqual({ x: 5, y: 3 });
  });
  it('limits the pan to the world of the new zoom', () => {
    const { ctl } = mk();
    ctl.set({ x: 2, y: 1 }, -9999, -9999);
    expect(ctl.state()).toMatchObject({ x: -300, y: 0 });
  });
});

describe('horizontal layout', () => {
  const pph = 100;
  it('derives pixels per hour and row height from viewport and zoom', () => {
    expect(pxPerHour(480, 3)).toBe(60);
    expect(baseRowHeight(700, 1, 'week')).toBe(100);
    expect(baseRowHeight(700, 2, 'week')).toBe(200);
    expect(hourStep(60)).toBe(1);
    expect(hourStep(12)).toBe(6);
  });
  it('puts an event at x from its start time and as wide as it lasts', () => {
    const r = layoutRow('d', [ev('a', 600, 660), ev('b', 840, 900)], pph, 100);
    const [a, b] = r.cards;
    expect(a!.left).toBe(1000);
    expect(a!.width).toBe(100);
    expect(b!.left).toBe(1400);
    expect(a!.left + a!.width).toBeLessThan(b!.left);
    expect(r.lanes).toBe(1);
  });
  it('gives overlapping events separate lanes, even when they start far apart', () => {
    const r = layoutRow('d', [ev('a', 600, 720), ev('b', 660, 780)], pph, 100);
    const [a, b] = r.cards;
    expect(a!.top + a!.height).toBeLessThanOrEqual(b!.top);
    expect(r.lanes).toBe(2);
  });
  it('widens a very short event to the minimum card width', () => {
    expect(layoutRow('d', [ev('a', 600, 605)], 20, 100).cards[0]!.width).toBeGreaterThanOrEqual(28);
  });
  it('keeps a late event inside the day', () => {
    const c = layoutRow('d', [ev('a', 1435, 1440)], pph, 100).cards[0]!;
    expect(c.left + c.width).toBeLessThanOrEqual(2400);
  });
  it('lays all-day entries as full-width bars above the lanes', () => {
    const r = layoutRow('d', [allDay('x'), ev('a', 600, 660)], pph, 100);
    const [bar, a] = r.cards;
    expect(bar).toMatchObject({ kind: 'bar', left: 0, width: 2400 });
    expect(a!.top).toBeGreaterThanOrEqual(bar!.top + BAR_PX);
  });
  it('grows a row when its lanes need more than the base height', () => {
    const segs = [ev('a', 600, 720), ev('b', 610, 720), ev('c', 620, 720), ev('d', 630, 720)];
    expect(layoutRow('d', segs, pph, 40).height).toBeGreaterThanOrEqual(4 * MIN_LANE_PX);
    expect(layoutRow('d', [ev('a', 600, 660)], pph, 90).height).toBe(90);
  });
  it('stacks rows and sizes the world; zooming days makes rows taller, time wider', () => {
    const days = [{ date: 'a', segs: [ev('a', 600, 660)] }, { date: 'b', segs: [] }];
    const l1 = layoutRows(days, 240, 700, { x: 1, y: 1 }, 'week');
    expect(l1.rows[1]!.top).toBe(l1.rows[0]!.height);
    expect(l1.width).toBe(240);
    const l2 = layoutRows(days, 240, 700, { x: 4, y: 2 }, 'week');
    expect(l2.rows[0]!.height).toBeGreaterThan(l1.rows[0]!.height);
    expect(l2.rows[0]!.cards[0]!.width).toBeGreaterThan(l1.rows[0]!.cards[0]!.width);
  });
});
