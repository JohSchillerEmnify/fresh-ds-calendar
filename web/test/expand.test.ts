import { describe, expect, it } from 'vitest';
import { anchorVisible, clipAboveBar, fitWidth, growPlan, placeExpanded, type Box } from '@/features/tasklists/expand';

const view: Box = { left: 0, top: 0, right: 400, bottom: 800 };
const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });

describe('placeExpanded', () => {
  it('grows down from the top of the collapsed card when there is room', () => {
    const p = placeExpanded(box(20, 100, 300, 40), view, 200);
    expect(p).toMatchObject({ left: 20, top: 100, width: 300, dir: 'down' });
    expect(p.maxHeight).toBe(800 - 8 - 100);
  });
  it('grows up from the bottom of the collapsed card when there is no room below but enough above', () => {
    const p = placeExpanded(box(20, 700, 300, 40), view, 300);
    expect(p).toMatchObject({ top: 740 - 300, dir: 'up' });
  });
  it('clamps to the roomier side and scrolls inside when neither side holds the list (down)', () => {
    const p = placeExpanded(box(20, 100, 300, 40), view, 5000);
    expect(p).toMatchObject({ top: 100, dir: 'down', maxHeight: 692 });
  });
  it('clamps to the roomier side and scrolls inside when neither side holds the list (up)', () => {
    const p = placeExpanded(box(20, 600, 300, 40), view, 5000);
    expect(p).toMatchObject({ top: 640 - 632, dir: 'up', maxHeight: 632 });
  });
  it('always has the left and width of the collapsed card, even a narrow one at the edge', () => {
    expect(placeExpanded(box(350, 100, 40, 20), view, 100)).toMatchObject({ left: 350, width: 40 });
    expect(placeExpanded(box(-30, 100, 300, 40), view, 100)).toMatchObject({ left: -30, width: 300 });
    expect(placeExpanded(box(390, 100, 40, 20), view, 100)).toMatchObject({ left: 390, width: 40 });
  });
});

describe('clipAboveBar', () => {
  const bar = box(8, 724, 384, 64);
  it('counts the space a floating bar covers as taken, so a low list grows up', () => {
    const b = clipAboveBar(view, bar);
    expect(b.bottom).toBe(724);
    expect(placeExpanded(box(20, 600, 300, 40), view, 150).dir).toBe('down');
    expect(placeExpanded(box(20, 600, 300, 40), b, 150)).toMatchObject({ dir: 'up', top: 640 - 150 });
  });
  it('leaves the bounds alone without a bar, with a bar slid out of view, or beside the area', () => {
    expect(clipAboveBar(view, null)).toEqual(view);
    expect(clipAboveBar(view, box(8, 800, 384, 64))).toEqual(view);
    expect(clipAboveBar(view, box(500, 724, 64, 64))).toEqual(view);
  });
});

describe('anchorVisible', () => {
  it('is true while any part is inside', () => expect(anchorVisible(box(0, 780, 100, 40), view)).toBe(true));
  it('is false once scrolled out', () => {
    expect(anchorVisible(box(0, -60, 100, 40), view)).toBe(false);
    expect(anchorVisible(box(0, 800, 100, 40), view)).toBe(false);
  });
});

describe('growPlan', () => {
  it('does not grow a card that shows its whole title and every open item', () => {
    expect(growPlan({ title: false, names: false, rows: false })).toEqual({ grow: false, wide: false });
  });
  it('takes the full column when anything is cut', () => {
    for (const c of [{ title: true, names: false, rows: false }, { title: false, names: true, rows: false }, { title: false, names: false, rows: true }]) {
      expect(growPlan(c)).toEqual({ grow: true, wide: true });
    }
  });
});

describe('fitWidth', () => {
  const col = { left: 2, right: 300 };
  it('is as wide as the content needs and keeps the slot left edge', () => {
    expect(fitWidth({ left: 100, width: 60 }, 120, col)).toEqual({ left: 100, width: 120 });
  });
  it('is never narrower than its own slot', () => {
    expect(fitWidth({ left: 100, width: 60 }, 40, col)).toEqual({ left: 100, width: 60 });
  });
  it('shifts left just enough when widening would leave the column', () => {
    expect(fitWidth({ left: 200, width: 60 }, 160, col)).toEqual({ left: 140, width: 160 });
  });
  it('takes the whole column when the content is wider', () => {
    expect(fitWidth({ left: 200, width: 60 }, 999, col)).toEqual({ left: 2, width: 298 });
  });
});
