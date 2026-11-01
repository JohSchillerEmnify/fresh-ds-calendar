import { describe, expect, it } from 'vitest';
import { keptItems, type OutboxEntry } from '../src/lib/outbox';
import { compactPoints, eraseAt, isRuled, penRole, readableInk, strokePath, toLineUnits, withPendingInk } from '../src/lib/ink';
import simplify from 'simplify-js';
import { INK_LIST_MAX_BYTES, inkListBytes } from '@calendar/shared/limits';
import type { InkPoint } from '@calendar/shared/api';

describe('penRole', () => {
  it('lets only a pen draw: the mouse never does, a finger never does', () => {
    expect(penRole({ pointerType: 'pen', buttons: 1 })).toBe('draw');
    expect(penRole({ pointerType: 'mouse', buttons: 1 })).toBe('ignore');
    expect(penRole({ pointerType: 'touch', buttons: 1 })).toBe('ignore');
  });
  it('erases with the eraser end (buttons 32) or the barrel button (2) of a pen', () => {
    expect(penRole({ pointerType: 'pen', buttons: 32 })).toBe('erase');
    expect(penRole({ pointerType: 'pen', buttons: 3 })).toBe('erase');
  });
});

describe('toLineUnits', () => {
  it('stores x and y in line heights from the line corner and clamps pressure', () => {
    expect(toLineUnits({ clientX: 150, clientY: 130, pressure: 1.4 }, { left: 100, top: 100 }, 25)).toEqual([2, 1.2, 1]);
    expect(toLineUnits({ clientX: 100, clientY: 100, pressure: 0 }, { left: 100, top: 100 }, 25)[2]).toBeGreaterThan(0);
  });
});

describe('strokePath', () => {
  it('turns points into closed SVG path data that is thicker where pressed harder', () => {
    const light = strokePath([[0, 0.5, 0.1], [1, 0.5, 0.1], [2, 0.5, 0.1]]);
    const heavy = strokePath([[0, 0.5, 1], [1, 0.5, 1], [2, 0.5, 1]]);
    expect(light).toMatch(/^M.*Z$/);
    const span = (d: string) => { const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1])); return Math.max(...ys) - Math.min(...ys); };
    expect(span(heavy)).toBeGreaterThan(span(light));
  });
  it('a normal stroke is thin and pressing hard makes it clearly thicker', () => {
    const span = (d: string) => { const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1])); return Math.max(...ys) - Math.min(...ys); };
    // path data is in line heights
    const at = (p: number) => span(strokePath([[0, 0.5, p], [1, 0.5, p], [2, 0.5, p]]));
    expect(at(1)).toBeLessThanOrEqual(0.075);
    expect(at(0.5)).toBeLessThanOrEqual(0.05);
    expect(at(1)).toBeGreaterThanOrEqual(at(0.1) * 2.5);
  });
  it('draws a single point as a dot', () => {
    expect(strokePath([[1, 0.5, 0.5]])).toMatch(/^M.*Z$/);
  });
});

describe('eraseAt', () => {
  const a = { p: [[0, 0.5, 0.5], [1, 0.5, 0.5]] as [number, number, number][] };
  const b = { p: [[3, 0.5, 0.5], [4, 0.5, 0.5]] as [number, number, number][] };
  it('removes the strokes the eraser touches, also between two points', () => {
    expect(eraseAt([a, b], 0.5, 0.5, 0.2)).toEqual([b]);
    expect(eraseAt([a, b], 2, 0.5, 0.2)).toEqual([a, b]);
  });
});

describe('readableInk', () => {
  const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
  it('lightens black on a dark background and keeps readable colours', () => {
    expect(lum(readableInk('#000000', true))).toBeGreaterThan(0.2);
    expect(readableInk('#ffffff', true)).toBe('#ffffff');
    expect(readableInk('#000000', false)).toBe('#000000');
  });
  it('darkens white on a light background', () => {
    expect(lum(readableInk('#ffffff', false))).toBeLessThan(0.4);
  });
});

describe('withPendingInk', () => {
  const s = (n: number) => ({ p: [[n, 0, 1]] as [number, number, number][] });
  const entry = (change: OutboxEntry['change']): OutboxEntry => ({ key: 'k', person: 'p', seq: 1, change, title: '' });
  it('puts unsent ink adds, rewrites and deletes over the server ink, in order, and leaves the input alone', () => {
    const base = { a: [s(1)], z: [s(9)] };
    const out = withPendingInk(base, [
      entry({ op: 'item.add', id: 'L', itemId: 'b', title: '', strokes: [s(2)] }),
      entry({ op: 'item.ink', id: 'L', itemId: 'a', strokes: [s(3), s(4)], base: [], at: 0 }),
      entry({ op: 'item.add', id: 'L', itemId: 'c', title: 'text' }),
      entry({ op: 'item.delete', id: 'L', itemId: 'z' }),
    ]);
    expect(out).toEqual({ a: [s(3), s(4)], b: [s(2)] });
    expect(base).toEqual({ a: [s(1)], z: [s(9)] });
  });
  it('counts the items of a new list the way the server keeps them: an empty line is no item', () => {
    const items = [{ title: '', strokes: [s(1)] }, { title: ' ' }, { title: '', strokes: [s(2)] }];
    expect(keptItems(items)).toHaveLength(2);
    const out = withPendingInk({}, [entry({ op: 'list.create', id: 'dev', input: { title: '', date: null, items } })]);
    expect(Object.keys(out)).toEqual(['dev-0', 'dev-1']);
  });
});

describe('isRuled', () => {
  const base = { enabled: true, penSeen: false, width: 1024, touch: true };
  it('is ruled on a touch tablet, where a pen was seen, and never with the feature off', () => {
    expect(isRuled(base)).toBe(true);
    expect(isRuled({ ...base, width: 390, touch: true })).toBe(false);
    expect(isRuled({ ...base, width: 390, penSeen: true })).toBe(true);
    expect(isRuled({ ...base, enabled: false })).toBe(false);
  });
  it('keeps a desktop without a pen as it is', () => {
    expect(isRuled({ ...base, touch: false })).toBe(false);
    expect(isRuled({ ...base, touch: false, penSeen: true })).toBe(true);
  });
});

describe('readableOn', () => {
  it('moves a colour until it holds 3:1 on the card colour', async () => {
    const { readableOn } = await import('@/lib/ink');
    const { contrastRatio } = await import('@/api/colors');
    for (const [ink, card, on] of [['#ffee00', '#f6c026', '#000000'], ['#000000', '#1a237e', '#ffffff'], ['#ffffff', '#fff3a0', '#000000']] as const) {
      expect(contrastRatio(readableOn(ink, [card], on), card)).toBeGreaterThanOrEqual(3);
    }
  });
  it('lifts black ink off a dark theme surface', async () => {
    const { readableOn } = await import('@/lib/ink');
    const { contrastRatio } = await import('@/api/colors');
    expect(contrastRatio(readableOn('#000000', ['#1c1b1f'], '#ffffff'), '#1c1b1f')).toBeGreaterThanOrEqual(3);
  });
});

describe('parseColour', () => {
  /** A canvas context that "normalises" any colour to a fixed pixel, as a browser does for oklch() and friends. */
  const fakeCtx = (px: number[]) => {
    const seen: string[] = [];
    const ctx = { set fillStyle(v: string) { seen.push(v); }, clearRect() {}, fillRect() {}, getImageData: () => ({ data: Uint8ClampedArray.from(px) }) };
    return { ctx: ctx as never, seen };
  };
  it('reads rgb(), rgba() and color(srgb) without a canvas', async () => {
    const { parseColour } = await import('@/lib/ink');
    const never = { get fillStyle() { throw new Error('canvas used'); } } as never;
    expect(parseColour('rgb(255, 128, 0)', never)).toEqual([255, 128, 0, 1]);
    expect(parseColour('rgba(10, 20, 30, 0.5)', never)).toEqual([10, 20, 30, 0.5]);
    expect(parseColour('rgb(10 20 30 / 0.25)', never)).toEqual([10, 20, 30, 0.25]);
    expect(parseColour('color(srgb 1 0.5 0 / 0.5)', never)).toEqual([255, 128, 0, 0.5]);
    expect(parseColour('transparent', never)).toEqual([0, 0, 0, 0]);
  });
  it('lets the canvas normalise any other colour (oklch, display-p3) instead of reading its numbers as RGB', async () => {
    const { parseColour } = await import('@/lib/ink');
    const { ctx, seen } = fakeCtx([12, 34, 56, 255]);
    expect(parseColour('oklch(0.7 0.1 200)', ctx)).toEqual([12, 34, 56, 1]);
    expect(seen).toContain('oklch(0.7 0.1 200)');
    expect(parseColour('color(display-p3 0.2 0.4 0.6)', fakeCtx([1, 2, 3, 0]).ctx)).toEqual([1, 2, 3, 0]);
  });
  it('gives null for nothing to parse and when no canvas exists', async () => {
    const { parseColour } = await import('@/lib/ink');
    expect(parseColour('', null)).toBeNull();
    expect(parseColour('oklch(0.7 0.1 200)', null)).toBeNull();
  });
});

describe('flattenColours', () => {
  it('lays semi-transparent layers over each other and over white, bottom first', async () => {
    const { flattenColours } = await import('@/lib/ink');
    expect(flattenColours([[0, 0, 0, 0.5]])).toBe('#808080');
    expect(flattenColours([[255, 0, 0, 1], [0, 0, 255, 0.5]])).toBe('#800080');
    expect(flattenColours([[0, 0, 0, 1], null, [0, 0, 0, 0]])).toBe('#000000');
  });
  it('is null when no layer has a colour', async () => {
    const { flattenColours } = await import('@/lib/ink');
    expect(flattenColours([null, null])).toBeNull();
  });
});

/** A word of 8 strokes the way a Windows pen reports it: about 150 raw points per stroke, full float precision, a little sensor jitter. */
function penWord(seed: number): InkPoint[][] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5);
  return Array.from({ length: 8 }, (_, k) => Array.from({ length: 150 }, (_, i) => [
    0.3 + k * 0.7 + (i / 150) * 0.6 + rnd() * 0.002,
    0.5 + 0.3 * Math.sin(i / 12 + k) + rnd() * 0.002,
    0.3 + 0.4 * Math.abs(Math.sin(i / 30)) + rnd() * 0.01,
  ] as InkPoint));
}
const distToPolyline = (pt: InkPoint, line: InkPoint[]): number => Math.min(...line.map((b, i) => (i === 0 ? Math.hypot(pt[0] - b[0], pt[1] - b[1]) : segDist(pt, line[i - 1]!, b))));
const segDist = (p: InkPoint, a: InkPoint, b: InkPoint): number => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.min(1, Math.max(0, dx || dy ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy) : 0));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

describe('strokePath of a thinned stroke', () => {
  it('draws the same outline as the dense stroke it was thinned from (no gaps in long straight pieces)', () => {
    const dense: InkPoint[] = Array.from({ length: 49 }, (_, i) => [i / 24, 0.5, 0.5]);
    const box = (d: string) => { const n = [...d.matchAll(/-?\d+\.\d+/g)].map((m) => Number(m[0])); const xs = n.filter((_, i) => i % 2 === 0); const ys = n.filter((_, i) => i % 2 === 1); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
    box(strokePath([dense[0]!, dense[48]!])).forEach((v, i) => expect(v).toBeCloseTo(box(strokePath(dense))[i]!, 1));
    // the unthinned piece would be a bare 2-point stroke: the outline has to reach as far as the dense one
    expect(strokePath([dense[0]!, dense[48]!]).split(' ').length).toBeGreaterThan(20);
  });
});

describe('compactPoints', () => {
  it('keeps a stroke within half a pixel of what was drawn with far fewer points', () => {
    for (const raw of penWord(1)) {
      const out = compactPoints(raw);
      expect(out.length).toBeLessThan(raw.length / 3);
      expect(out[0]![0]).toBeCloseTo(raw[0]![0], 2);
      expect(out.at(-1)![0]).toBeCloseTo(raw.at(-1)![0], 2);
      for (const p of raw) expect(distToPolyline(p, out)).toBeLessThanOrEqual(0.5 / 24 + 0.002);
    }
  });
  it('holds at least 50 words of handwriting in one list', () => {
    const items = Array.from({ length: 50 }, (_, n) => penWord(n + 1).map((raw) => ({ p: compactPoints(raw), t: 1_700_000_000_000 + n })));
    expect(inkListBytes(items)).toBeLessThanOrEqual(INK_LIST_MAX_BYTES - INK_LIST_MAX_BYTES / 10);
  });
  it('smooths the noise of a slow pen but keeps a corner of a fast move', () => {
    let seed = 9;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5);
    const slow: InkPoint[] = Array.from({ length: 300 }, (_, i) => [i * 0.012, 0.5 + (rnd() * 2.4) / 24, 0.5]);
    // thinning alone keeps the noise of a straight line as vertices
    const unsmoothed = simplify(slow.map(([x, y]) => ({ x, y })), 0.5 / 24, true).length;
    expect(compactPoints(slow).length).toBeLessThan(unsmoothed / 2);
    const corner = compactPoints([[0, 0, 0.5], [1, 0, 0.5], [2, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5]]);
    expect(corner).toEqual([[0, 0, 0.5], [2, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5]]);
  });
  it('keeps a single tap as one point', () => {
    expect(compactPoints([[1.23456, 0.5, 0.5]])).toEqual([[1.235, 0.5, 0.5]]);
  });
});

describe('the list that was reported full', () => {
  it('holds the four items of the report (176 KB at 52 bytes a point) well within the limit', () => {
    const word = (points: number) => [{ p: Array.from({ length: points }, (_, i) => [0.123456789012345 + i * 1e-4, 0.5234567890123456, 0.4123456789012345]), t: 1_700_000_000_000 }];
    const raw = [997, 797, 396, 1207].map(word);
    expect(inkListBytes(raw)).toBeGreaterThan(150_000);
    expect(inkListBytes(raw)).toBeLessThan(INK_LIST_MAX_BYTES - INK_LIST_MAX_BYTES / 10);
  });
});
