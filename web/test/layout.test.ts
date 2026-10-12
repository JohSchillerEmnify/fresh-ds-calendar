import { describe, expect, it } from 'vitest';
import { clampLeft } from '@/lib/clamp';

describe('clampLeft', () => {
  it('keeps an in-range anchor', () => expect(clampLeft(40, 260, 800)).toBe(40));
  it('pulls a right-edge anchor back inside the viewport', () => expect(clampLeft(340, 260, 375)).toBe(103));
  it('never goes below the margin', () => expect(clampLeft(-50, 260, 375)).toBe(12));
  it('narrow viewport wins over the right bound', () => expect(clampLeft(100, 400, 375)).toBe(12));
});
