/** The Fall and Winter spot tables and their anchoring (theme-scenes.feature, round 3 mockups). */
import { describe, expect, it } from 'vitest';
import { anchor, BAR, KITE, layoutFor, PARTICLE_SIZE, PARTICLE_TURN, particleScale, PROPS, propWidth, STILL, type SceneLayout } from '@/features/motivation/fallWinter';

const LAYOUTS: SceneLayout[] = ['H1', 'H2', 'T', 'D'];

describe('Fall and Winter spots', () => {
  it('picks the layout by the bar width and, on a phone, its header layout (two rows by default)', () => {
    expect([375, 767, 768, 1099, 1100, 1920].map((w) => layoutFor(w))).toEqual(['H2', 'H2', 'T', 'T', 'D', 'D']);
    expect(layoutFor(375, 'one-row')).toBe('H1');
    expect(layoutFor(375, 'two-rows')).toBe('H2');
    expect(layoutFor(820, 'wide')).toBe('T');
  });

  it('keeps a box at its distance to the nearer edge of the bar', () => {
    expect(anchor(158, 41.6, 390)).toEqual({ left: '158px' });
    expect(anchor(273, 49.6, 390)).toEqual({ right: '67.4px' });
    expect(anchor(188, 34, 390, 'left')).toEqual({ left: '188px' });
  });

  it.each(['fall', 'winter', 'christmas'] as const)('%s: nine resting spots per layout, each fully inside the bar', (scene) => {
    for (const L of LAYOUTS) {
      const spots = STILL[scene][L];
      expect(spots, L).toHaveLength(9);
      spots.forEach(([x, y], i) => {
        // the drawn box: the particle turned and scaled about its centre
        const a = (PARTICLE_TURN[i] * Math.PI) / 180, s = PARTICLE_SIZE[i];
        const half = (s * particleScale(scene) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)))) / 2;
        const cx = x + s / 2, cy = y + s / 2;
        expect(cx - half, `${L} ${i} left`).toBeGreaterThanOrEqual(0);
        expect(cx + half, `${L} ${i} right`).toBeLessThanOrEqual(BAR[L].w);
        expect(cy - half, `${L} ${i} top`).toBeGreaterThanOrEqual(1.5);
        expect(cy + half, `${L} ${i} bottom`).toBeLessThanOrEqual(BAR[L].h - 0.5);
      });
    }
  });

  it('every prop and the kite stand inside the bar, the props at their full size', () => {
    for (const scene of ['fall', 'winter'] as const) {
      for (const L of LAYOUTS) {
        for (const p of PROPS[scene][L]) {
          expect(p.x + propWidth(p), `${scene} ${L} ${p.kind}`).toBeLessThanOrEqual(BAR[L].w);
          expect(p.h, `${scene} ${L} ${p.kind}`).toBeGreaterThanOrEqual(p.kind.endsWith('tree') ? 43 : 13);
        }
      }
    }
    for (const L of LAYOUTS) expect(KITE[L].x + 16).toBeLessThanOrEqual(BAR[L].w);
  });
});
