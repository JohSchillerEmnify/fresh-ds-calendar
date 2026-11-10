import { describe, expect, it } from 'vitest';
import { blockBudget, wrapLines } from '@/lib/lineBudget';

const base = { title: 'Car service', width: 47, padV: 4, lineH: 13, timeH: 14, charW: 5.6, padH: 6 };
describe('event block line budget', () => {
  it('wraps words', () => {
    expect(wrapLines('Car service', 7)).toBe(2);
    expect(wrapLines('Car service', 20)).toBe(1);
    expect(wrapLines('Supercalifragilistic', 7)).toBe(3);
  });
  it('44 px / 47 px: "Car service" on two lines, time row only because it still fits', () => {
    expect(blockBudget({ ...base, height: 44 })).toEqual({ lines: 2, time: true });
    expect(blockBudget({ ...base, height: 36 })).toEqual({ lines: 2, time: false });
  });
  it('tall block: more title lines and a time row once the title fits whole', () => {
    const long = { ...base, width: 100, title: 'Quarterly planning workshop with everyone' };
    const short = blockBudget({ ...long, height: 30 }), tall = blockBudget({ ...long, height: 120 });
    expect(tall.lines).toBeGreaterThan(short.lines);
    expect(tall.time).toBe(true);
    expect(short.time).toBe(false);
  });
  it('ellipsizes only when the title cannot fit even wrapped', () => {
    const b = blockBudget({ ...base, title: 'Quarterly planning workshop with everyone', height: 30 });
    expect(b.lines).toBe(2);
  });
});
