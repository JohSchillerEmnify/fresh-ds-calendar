import { describe, expect, it } from 'vitest';
import { keptItems, type OutboxEntry } from '../src/lib/outbox';
import { eraseAt, isRuled, penRole, readableInk, strokePath, toLineUnits, withPendingInk } from '../src/lib/ink';

describe('penRole', () => {
  it('lets only a pen draw: the mouse never does, a finger only with the setting', () => {
    expect(penRole({ pointerType: 'pen', buttons: 1 }, false)).toBe('draw');
    expect(penRole({ pointerType: 'mouse', buttons: 1 }, false)).toBe('ignore');
    expect(penRole({ pointerType: 'mouse', buttons: 1 }, true)).toBe('ignore');
    expect(penRole({ pointerType: 'touch', buttons: 1 }, false)).toBe('ignore');
    expect(penRole({ pointerType: 'touch', buttons: 1 }, true)).toBe('draw');
  });
  it('erases with the eraser end (buttons 32) or the barrel button (2) of a pen', () => {
    expect(penRole({ pointerType: 'pen', buttons: 32 }, false)).toBe('erase');
    expect(penRole({ pointerType: 'pen', buttons: 3 }, false)).toBe('erase');
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
