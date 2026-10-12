import { describe, expect, it } from 'vitest';
import { Spring1D, __setLinearSupport, createVelocityTracker, settleTime, springAt, springEasing, springSamples, springs } from '@/motion/spring';

describe('spring math', () => {
  it('starts at d0 and ends at rest', () => {
    for (const z of [0.3, 1, 1.6]) {
      const p = { stiffness: 400, damping: z };
      expect(springAt(p, -1, 0, 0).d).toBeCloseTo(-1, 6);
      expect(Math.abs(springAt(p, -1, 0, 6).d)).toBeLessThan(1e-4);
    }
  });
  it('under-damped overshoots, critically/over-damped do not', () => {
    const over = (z: number) => Math.max(...springSamples({ stiffness: 400, damping: z }, 60).values);
    expect(over(0.4)).toBeGreaterThan(1.1);
    expect(over(1)).toBeLessThanOrEqual(1.0001);
    expect(over(1.5)).toBeLessThanOrEqual(1.0001);
  });
  it('matches the derivative numerically', () => {
    const p = springs.pop, h = 1e-5, t = 0.07;
    const num = (springAt(p, -1, 2, t + h).d - springAt(p, -1, 2, t - h).d) / (2 * h);
    expect(springAt(p, -1, 2, t).v).toBeCloseTo(num, 2);
  });
  it('is continuous across the zeta=1 boundary', () => {
    const a = springAt({ stiffness: 400, damping: 0.99999 }, -1, 0, 0.1).d;
    const b = springAt({ stiffness: 400, damping: 1 }, -1, 0, 0.1).d;
    expect(a).toBeCloseTo(b, 3);
  });
  it('settle time is bounded and stiffer is faster', () => {
    expect(settleTime({ stiffness: 1400, damping: 1 })).toBeLessThan(settleTime({ stiffness: 100, damping: 1 }));
    expect(settleTime({ stiffness: 1, damping: 0.01 })).toBeLessThanOrEqual(4);
  });
  it('easing samples run 0 -> 1 and are cached', () => {
    __setLinearSupport(true);
    const e = springEasing(springs.pop);
    expect(e.easing.startsWith('linear(0')).toBe(true);
    expect(e.easing.endsWith(', 1)')).toBe(true);
    expect(springEasing(springs.pop)).toBe(e);
    __setLinearSupport(false);
    expect(springEasing(springs.pop).easing).toContain('cubic-bezier');
    __setLinearSupport(null);
  });
  it('Spring1D converges and tracks velocity', () => {
    const s = new Spring1D(springs.follow);
    s.target = 100;
    s.step(0.016);
    expect(s.v).toBeGreaterThan(0);
    let n = 0;
    while (s.step(0.016) && n++ < 600);
    expect(s.x).toBe(100);
    expect(s.v).toBe(0);
  });
  it('velocity tracker', () => {
    const v = createVelocityTracker();
    v.add(0, 0, 0); v.add(50, 0, 100);
    expect(v.velocity().vx).toBeCloseTo(500);
  });
});
