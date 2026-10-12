import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __motionUsers, __setSystemReducedForTest, installMotion, setAnimationSetting, useAnimationLevel, motionLevel, setCalmMode } from '@/motion/level';
import { MAX_EFFECTS, MAX_PARTICLES, clearEffects, liveEffectCount, markEffect, spawnBling, spawnConfetti, spawnDroplets, spawnSparkle } from '@/motion/effects';
import { canVibrate, haptic } from '@/motion/haptics';
import { installWaapi, mockAnims, finishAll, removeWaapi, flush } from './helpers';
import { effectScope } from 'vue';

const q = (s = '[data-testid="reward-effect"]') => document.querySelectorAll(s);

beforeEach(() => {
  vi.useFakeTimers();
  installWaapi();
  setAnimationSetting('full');
  setCalmMode(false);
  __setSystemReducedForTest(false);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => {
  clearEffects();
  removeWaapi();
  vi.useRealTimers();
});

describe('effects', () => {
  it('tags every spec kind and removes particles when animations finish', async () => {
    const calls: [string, () => unknown][] = [
      ['tick', () => spawnSparkle({ x: 10, y: 10 })],
      ['list-complete', () => spawnConfetti({ x: 100, y: 100 })],
      ['drop', () => spawnBling({ x: 1, y: 1 })],
      ['water', () => spawnDroplets({ x: 1, y: 1 })],
    ];
    for (const [kind, fn] of calls) {
      fn();
      expect(q(`[data-kind="${kind}"]`).length, kind).toBe(1);
      finishAll();
      await flush();
      expect(q().length, kind).toBe(0);
      expect(document.querySelector('.reward-layer')).toBeNull();
    }
  });
  it('removes after the hard timeout even if animations never end', () => {
    spawnConfetti({ x: 100, y: 100 });
    expect(q().length).toBe(1);
    vi.advanceTimersByTime(1201);
    expect(q().length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('works with kind overrides and markers', () => {
    spawnSparkle({ x: 1, y: 1 }, { kind: 'bloom' });
    markEffect('streak', { x: 1, y: 1 });
    markEffect('eye-open', { x: 1, y: 1 });
    expect([...q()].map((e) => (e as HTMLElement).dataset.kind)).toEqual(['bloom', 'streak', 'eye-open']);
  });
  it('layer and effects never take pointer events', () => {
    spawnSparkle({ x: 1, y: 1 });
    const layer = document.querySelector('.reward-layer') as HTMLElement;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toBe('reward-layer'); // css: pointer-events none (effects.css)
  });
  it('caps concurrent effects (oldest dropped) and particles', () => {
    for (let i = 0; i < 6; i++) spawnConfetti({ x: 100, y: 100 }, { count: 30 });
    expect(liveEffectCount()).toBeLessThanOrEqual(MAX_EFFECTS);
    expect(document.querySelectorAll('.rp').length).toBeLessThanOrEqual(MAX_PARTICLES + 8);
  });
  it('keeps confetti inside a 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    spawnConfetti({ x: 5, y: 100 });
    const m = /translate\((-?\d+)px/.exec((q()[0] as HTMLElement).style.transform)!;
    expect(+m[1]).toBeGreaterThan(60);
  });
  it.each([['reduced'], ['off']] as const)('renders no effects at %s', (lvl) => {
    setAnimationSetting(lvl);
    expect(spawnSparkle({ x: 1, y: 1 })).toBeNull();
    expect(spawnConfetti({ x: 1, y: 1 })).toBeNull();
    expect(spawnBling({ x: 1, y: 1 })).toBeNull();
    expect(spawnDroplets({ x: 1, y: 1 })).toBeNull();
    expect(markEffect('grow', { x: 1, y: 1 })).toBeNull();
    expect(q().length).toBe(0);
    expect(mockAnims.length).toBe(0);
  });
  it('system prefers-reduced-motion and calm mode cap the level', () => {
    __setSystemReducedForTest(true);
    expect(motionLevel.value).toBe('reduced');
    expect(spawnSparkle({ x: 1, y: 1 })).toBeNull();
    __setSystemReducedForTest(false);
    setCalmMode(true);
    expect(motionLevel.value).toBe('reduced');
  });
  it('level listener is released with the scope', () => {
    const before = __motionUsers();
    const s = effectScope();
    s.run(() => useAnimationLevel());
    expect(__motionUsers()).toBe(before + 1);
    s.stop();
    expect(__motionUsers()).toBe(before);
    installMotion()();
    expect(__motionUsers()).toBe(before);
  });
  it('no animate() support still cleans up by timer', () => {
    removeWaapi();
    spawnSparkle({ x: 1, y: 1 });
    vi.advanceTimersByTime(1300);
    expect(q().length).toBe(0);
  });
});

describe('haptics', () => {
  it('guards navigator.vibrate', () => {
    expect(canVibrate()).toBe(false);
    expect(haptic()).toBe(false);
    const v = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: v, configurable: true });
    expect(haptic(10)).toBe(true);
    expect(v).toHaveBeenCalledWith(10);
    Object.defineProperty(navigator, 'vibrate', { value: () => { throw new Error('x'); }, configurable: true });
    expect(haptic()).toBe(false);
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
});
