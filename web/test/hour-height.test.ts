import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOUR_HEIGHT_KEY, MAX_HOUR_PX, MIN_HOUR_PX, clampHourHeight, hourHeight, pinchHourHeight, readStoredHourHeight, setHourHeight,
  wheelZoomFactor,
} from '@/composables/useHourHeight';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('time grid zoom math', () => {
  it('clamps to 24..160 px per hour', () => {
    expect(clampHourHeight(5)).toBe(MIN_HOUR_PX);
    expect(clampHourHeight(1000)).toBe(MAX_HOUR_PX);
    expect(clampHourHeight(60)).toBe(60);
  });

  it('a pinch scales the start height by the distance ratio, clamped', () => {
    expect(pinchHourHeight(48, 100, 200)).toBe(96);
    expect(pinchHourHeight(48, 100, 50)).toBe(MIN_HOUR_PX);
    expect(pinchHourHeight(100, 100, 400)).toBe(MAX_HOUR_PX);
    expect(pinchHourHeight(48, 0, 200)).toBe(48);
  });

  it('wheel up zooms in, wheel down zooms out, no delta changes nothing', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });
});

describe('remembered hour height', () => {
  it('reads a stored value (clamped) and ignores garbage', () => {
    expect(readStoredHourHeight()).toBeNull();
    localStorage.setItem(HOUR_HEIGHT_KEY, '90');
    expect(readStoredHourHeight()).toBe(90);
    localStorage.setItem(HOUR_HEIGHT_KEY, '9999');
    expect(readStoredHourHeight()).toBe(MAX_HOUR_PX);
    localStorage.setItem(HOUR_HEIGHT_KEY, 'wide');
    expect(readStoredHourHeight()).toBeNull();
  });

  it('falls back when storage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoredHourHeight()).toBeNull();
  });

  it('setHourHeight updates the shared value and persists it; a throwing write still zooms', () => {
    expect(setHourHeight(72)).toBe(72);
    expect(hourHeight.value).toBe(72);
    expect(localStorage.getItem(HOUR_HEIGHT_KEY)).toBe('72');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(setHourHeight(100)).toBe(100);
    expect(hourHeight.value).toBe(100);
  });
});
