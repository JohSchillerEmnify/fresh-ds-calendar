import { describe, expect, it } from 'vitest';
import { anchorVisible, placeExpanded, type Box } from '@/features/tasklists/expand';

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
  it('is never narrower than the minimum over a narrow cell, and is pulled back inside at the right edge', () => {
    const p = placeExpanded(box(350, 100, 40, 20), view, 100);
    expect(p.width).toBe(240);
    expect(p.left).toBe(400 - 8 - 240);
  });
  it('never leaves the left margin', () => {
    expect(placeExpanded(box(-30, 100, 300, 40), view, 100).left).toBe(8);
  });
  it('shrinks to a narrow area', () => {
    const narrow: Box = { left: 0, top: 0, right: 200, bottom: 800 };
    const p = placeExpanded(box(0, 100, 60, 40), narrow, 100);
    expect(p.width).toBe(184);
    expect(p.left).toBe(8);
  });
});

describe('anchorVisible', () => {
  it('is true while any part is inside', () => expect(anchorVisible(box(0, 780, 100, 40), view)).toBe(true));
  it('is false once scrolled out', () => {
    expect(anchorVisible(box(0, -60, 100, 40), view)).toBe(false);
    expect(anchorVisible(box(0, 800, 100, 40), view)).toBe(false);
  });
});
