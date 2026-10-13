import { describe, expect, it } from 'vitest';
import { catComes } from '@/features/motivation/supportCat';
import { DRAG_CAT_CHANCE, DRAG_CAT_HOP_MS, DRAG_CAT_WAIT_MS, dragCatPose, dragCatSide } from '@/features/motivation/dragCat';

const at = (o: Partial<Parameters<typeof dragCatPose>[0]>) => ({ dx: 0, dy: 0, vy: 0, width: 120, stillMs: 0, level: 'full' as const, ...o });

describe('drag helper cat roll', () => {
  it('comes on about every 5th drag with "Sometimes"', () => {
    expect(DRAG_CAT_CHANCE).toBe(0.2);
    const roll = (random: number) => catComes({ level: 'full', setting: 'sometimes', forced: false, random, chance: DRAG_CAT_CHANCE });
    expect(roll(0.19)).toBe(true);
    expect(roll(0.2)).toBe(false);
  });

  it('comes every time with "Every time" or the test hook, never when Off or at level Off', () => {
    const base = { level: 'full' as const, forced: false, random: 0.99, chance: DRAG_CAT_CHANCE };
    expect(catComes({ ...base, setting: 'always' })).toBe(true);
    expect(catComes({ ...base, setting: 'sometimes', forced: true })).toBe(true);
    expect(catComes({ ...base, setting: 'off', forced: true, random: 0 })).toBe(false);
    expect(catComes({ ...base, level: 'off', setting: 'always' })).toBe(false);
  });

  it('hops away within 1.5 s', () => {
    expect(DRAG_CAT_HOP_MS.full).toBeLessThanOrEqual(1500);
    expect(DRAG_CAT_HOP_MS.reduced).toBeLessThanOrEqual(1500);
  });
});

describe('drag helper cat pose', () => {
  it('pushes from above while the card moves later (down)', () => {
    expect(dragCatPose(at({ dy: 96, vy: 300 }), 'pull-up')).toBe('push-down');
    expect(dragCatPose(at({ dy: -40, vy: 300 }), 'pull-up')).toBe('push-down');
  });

  it('pulls from below while the card moves earlier (up), even while still below its start', () => {
    expect(dragCatPose(at({ dy: -48, vy: -300 }), 'push-down')).toBe('pull-up');
    expect(dragCatPose(at({ dy: 40, vy: -300 }), 'push-down')).toBe('pull-up');
  });

  it('pushes from the side when the card moves to another day', () => {
    expect(dragCatPose(at({ dx: 120, dy: 30, vy: 200 }), 'push-down')).toBe('push-side');
    expect(dragCatPose(at({ dx: -120 }), 'push-down')).toBe('push-side');
    // less than half a card sideways is still the same day
    expect(dragCatPose(at({ dx: 40, dy: 30, vy: 200 }), 'push-side')).toBe('push-down');
  });

  it('waits with a paw on the card once the pointer rests longer than 0.5 s', () => {
    expect(DRAG_CAT_WAIT_MS).toBe(500);
    expect(dragCatPose(at({ dy: 96, stillMs: 500 }), 'push-down')).toBe('push-down');
    expect(dragCatPose(at({ dy: 96, stillMs: 501 }), 'push-down')).toBe('wait');
    expect(dragCatPose(at({ dx: 120, stillMs: 900 }), 'push-side')).toBe('wait');
  });

  it('keeps its pose while moving slowly instead of flickering; after waiting the displacement decides', () => {
    expect(dragCatPose(at({ dy: 90, vy: 20 }), 'pull-up')).toBe('pull-up');
    expect(dragCatPose(at({ dy: -90, vy: -20 }), 'push-down')).toBe('push-down');
    expect(dragCatPose(at({ dy: 90, vy: 0 }), 'wait')).toBe('push-down');
    expect(dragCatPose(at({ dy: -90, vy: 0 }), 'wait')).toBe('pull-up');
    expect(dragCatPose(at({ dy: -90, vy: 0 }), 'push-side')).toBe('pull-up');
  });

  it('at Reduced only sits beside the card (and still waits)', () => {
    expect(dragCatPose(at({ dy: 96, vy: 300, level: 'reduced' }), 'push-down')).toBe('push-side');
    expect(dragCatPose(at({ dy: -96, vy: -300, level: 'reduced' }), 'push-side')).toBe('push-side');
    expect(dragCatPose(at({ stillMs: 800, level: 'reduced' }), 'push-side')).toBe('wait');
  });

  it('stands behind the movement when pushing sideways, else on the right', () => {
    expect(dragCatSide(120, 'push-side')).toBe('left');
    expect(dragCatSide(-120, 'push-side')).toBe('right');
    expect(dragCatSide(120, 'push-down')).toBe('right');
  });

  it('left-handed: the default side is the left, pushing sideways still stands behind the movement', () => {
    expect(dragCatSide(0, 'push-down', true)).toBe('left');
    expect(dragCatSide(0, 'push-side', true)).toBe('left');
    expect(dragCatSide(120, 'push-side', true)).toBe('left');
    expect(dragCatSide(-120, 'push-side', true)).toBe('right');
  });
});
