import { describe, expect, it } from 'vitest';
import { inkKey, mergeInk, visibleInk } from '@calendar/shared/ink';

const stroke = (x: number, t?: number) => ({ p: [[x, 0, 1]] as [number, number, number][], ...(t === undefined ? {} : { t }) });
const keys = (...s: ReturnType<typeof stroke>[]) => s.map(inkKey);

describe('mergeInk', () => {
  const seed = stroke(1);

  it('keeps the strokes both devices added', () => {
    const theirs = [seed, stroke(2, 100)];
    expect(visibleInk(mergeInk(theirs, [seed, stroke(3, 200)], keys(seed), 200))).toEqual([seed, stroke(2, 100), stroke(3, 200)]);
  });

  it('keeps a stroke drawn after the line was erased', () => {
    const erased = mergeInk([seed], [], keys(seed), 100);
    expect(visibleInk(mergeInk(erased, [seed, stroke(2, 200)], keys(seed), 200))).toEqual([stroke(2, 200)]);
  });

  it('drops a stroke drawn before a later erase, even when it arrives after it', () => {
    const erased = mergeInk([seed], [], keys(seed), 300);
    expect(visibleInk(mergeInk(erased, [seed, stroke(2, 200)], keys(seed), 200))).toEqual([]);
  });

  it('removes only the strokes the device took away', () => {
    const [a, b] = [stroke(1, 10), stroke(2, 20)];
    expect(visibleInk(mergeInk([a, b, stroke(3, 30)], [b], keys(a, b), 400))).toEqual([b, stroke(3, 30)]);
  });
});
