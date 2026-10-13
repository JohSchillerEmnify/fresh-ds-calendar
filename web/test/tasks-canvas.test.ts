import { describe, expect, it } from 'vitest';
import {
  areaColor, areaOf, centeredArea, clampArea, clampNote, clampView, clampZoom, noteAnchor, noteDateLabel, parseView, pinchView, placeNotes,
  stackPosition, toWorld, zoomAt, MAX_ZOOM, MIN_ZOOM, NOTE_W, WORLD_H, WORLD_W, type View,
} from '@/features/tasklists/canvas';

const V: View = { x: 0, y: 0, zoom: 1 };

describe('clamping', () => {
  it('keeps a note on the board as whole numbers', () => {
    expect(clampNote({ x: -50, y: -1 })).toEqual({ x: 0, y: 0 });
    expect(clampNote({ x: 99999, y: 99999 })).toEqual({ x: WORLD_W - NOTE_W, y: WORLD_H - 24 });
    expect(clampNote({ x: 10.6, y: 20.4 })).toEqual({ x: 11, y: 20 });
  });
  it('keeps an area at least the minimum size and on the board', () => {
    expect(clampArea({ x: -5, y: 3990, w: 10, h: 5000 })).toEqual({ x: 0, y: 0, w: 160, h: 3000 });
    expect(clampArea({ x: 3900, y: 10, w: 320, h: 240 })).toEqual({ x: 3680, y: 10, w: 320, h: 240 });
  });
  it('limits the zoom to 0.3 .. 2', () => {
    expect([clampZoom(0.01), clampZoom(1), clampZoom(9)]).toEqual([MIN_ZOOM, 1, MAX_ZOOM]);
  });
});

describe('the Unsorted stack', () => {
  it('offsets notes diagonally and shares the last offset after ten', () => {
    expect(stackPosition(0)).toEqual({ x: 24, y: 24 });
    expect(stackPosition(1)).toEqual({ x: 38, y: 38 });
    expect(stackPosition(10)).toEqual({ x: 164, y: 164 });
    expect(stackPosition(25)).toEqual({ x: 164, y: 164 });
  });
  it('places lists with a place where they are and stacks the others by title', () => {
    const out = placeNotes([
      { id: 'b', title: 'banana' }, { id: 'p', title: 'Placed', canvas: { x: 300, y: 400 } }, { id: 'a', title: 'Apple' }, { id: 'c', title: 'cherry', canvas: null },
    ]);
    expect(out.find((n) => n.id === 'p')).toEqual({ id: 'p', x: 300, y: 400, placed: true, stack: -1 });
    const stack = out.filter((n) => !n.placed);
    expect(stack.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(stack.map((n) => [n.x, n.y])).toEqual([[24, 24], [38, 38], [52, 52]]);
  });
  it('lets an optimistic place win over the stored one and over the stack', () => {
    const out = placeNotes([{ id: 'a', title: 'A', canvas: { x: 1, y: 2 } }, { id: 'b', title: 'B' }], { a: { x: 7, y: 8 }, b: { x: 9, y: 9 } });
    expect(out.map((n) => [n.id, n.x, n.y, n.placed])).toEqual([['a', 7, 8, true], ['b', 9, 9, true]]);
  });
  it('breaks a title tie by id so the order is stable', () => {
    const out = placeNotes([{ id: 'z', title: 'Same' }, { id: 'y', title: 'Same' }]);
    expect(out.map((n) => n.id)).toEqual(['y', 'z']);
  });
});

describe('areas', () => {
  const areas = [{ x: 0, y: 0, w: 1000, h: 1000, name: 'big' }, { x: 100, y: 100, w: 400, h: 300, name: 'small' }];
  it('uses the middle of the note\'s top edge as its anchor', () => {
    expect(noteAnchor({ x: 100, y: 200 })).toEqual({ x: 220, y: 224 });
  });
  it('finds the topmost area containing the anchor, or none', () => {
    expect(areaOf({ x: 100, y: 100 }, areas)?.name).toBe('small');
    expect(areaOf({ x: 700, y: 100 }, areas)?.name).toBe('big');
    expect(areaOf({ x: 2000, y: 2000 }, areas)).toBeNull();
  });
  it('does not count the right and bottom edges as inside', () => {
    expect(areaOf({ x: 380, y: 0 }, [{ x: 0, y: 0, w: 500, h: 100 }])).toBeNull(); // anchor x = 500
    expect(areaOf({ x: 379, y: 0 }, [{ x: 0, y: 0, w: 500, h: 100 }])).not.toBeNull();
  });
  it('centres a new area in the view', () => {
    expect(centeredArea(V, 800, 600)).toEqual({ x: 240, y: 180, w: 320, h: 240 });
    expect(centeredArea({ x: -1000, y: 0, zoom: 2 }, 800, 600)).toEqual({ x: 540, y: 30, w: 320, h: 240 });
  });
  it('takes the palette colours in turn', () => {
    expect(areaColor(0)).not.toBe(areaColor(1));
    expect(areaColor(8)).toBe(areaColor(0));
  });
});

describe('zoom and pan', () => {
  it('maps a viewport point to the board', () => {
    expect(toWorld({ x: -100, y: 50, zoom: 2 }, 100, 150)).toEqual({ x: 100, y: 50 });
  });
  it('zooms about a point so that point does not move', () => {
    const v = zoomAt({ x: -40, y: 20, zoom: 1 }, 2, 300, 200);
    expect(v.zoom).toBe(2);
    expect(toWorld(v, 300, 200)).toEqual(toWorld({ x: -40, y: 20, zoom: 1 }, 300, 200));
  });
  it('never zooms past the range', () => {
    expect(zoomAt(V, 50, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(V, 0.0001, 0, 0).zoom).toBe(MIN_ZOOM);
  });
  it('follows a pinch: zoom by the finger distance ratio, the starting midpoint stays under the midpoint', () => {
    const start: View = { x: 10, y: 10, zoom: 1 };
    const v = pinchView(start, { x: 200, y: 200 }, 100, { x: 220, y: 210 }, 150);
    expect(v.zoom).toBe(1.5);
    expect(toWorld(v, 220, 210)).toEqual(toWorld(start, 200, 200));
    expect(pinchView(start, { x: 0, y: 0 }, 0, { x: 0, y: 0 }, 10).zoom).toBe(1);
  });
  it('keeps 120 px of the board in view and does not clamp before the viewport is measured', () => {
    expect(clampView({ x: 5000, y: 5000, zoom: 1 }, 400, 600)).toEqual({ x: 280, y: 480, zoom: 1 });
    expect(clampView({ x: -99999, y: -99999, zoom: 1 }, 400, 600)).toEqual({ x: 120 - WORLD_W, y: 120 - WORLD_H, zoom: 1 });
    expect(clampView({ x: 5000, y: 5000, zoom: 9 }, 0, 0)).toEqual({ x: 5000, y: 5000, zoom: MAX_ZOOM });
    expect(clampView({ x: -120, y: -60, zoom: 1 }, 400, 600)).toEqual({ x: -120, y: -60, zoom: 1 });
  });
});

describe('the remembered view', () => {
  it('reads a stored view and clamps its zoom', () => {
    expect(parseView('{"x":-120,"y":-60,"zoom":1.5}')).toEqual({ x: -120, y: -60, zoom: 1.5 });
    expect(parseView('{"x":0,"y":0,"zoom":9}')?.zoom).toBe(MAX_ZOOM);
  });
  it.each([null, '', 'nope', '{}', '{"x":1,"y":2}', '{"x":"1","y":2,"zoom":1}', '{"x":null,"y":2,"zoom":1}', 'null', '[]'])('ignores %j', (raw) => {
    expect(parseView(raw)).toBeNull();
  });
});

describe('note date label', () => {
  it('shows weekday, day and month in English', () => {
    expect(noteDateLabel('2026-10-14')).toBe('Wed 14 Oct');
  });
});
