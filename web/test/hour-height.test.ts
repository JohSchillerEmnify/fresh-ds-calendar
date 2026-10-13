import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOUR_HEIGHT_KEY, MAX_HOUR_PX, MIN_HOUR_PX, clampHourHeight, hourHeight, pinchHourHeight, readStoredHourHeight, setHourHeight,
  WHEEL_SETTLE_MS, bindGridZoom, gridYUnder, previewShift, wheelZoomFactor,
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

describe('zoom preview anchoring', () => {
  it('the shift keeps grid y at the same screen offset, and gridYUnder inverts it', () => {
    const t = previewShift(100, 50, 300, 2);
    expect(t).toBe(100 + 50 - 600);
    expect(gridYUnder(100, 50, 2, t)).toBe(300);
  });
});

describe('bindGridZoom: preview during the gesture, commit once when it settles', () => {
  const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
  const fire = (el: HTMLElement, type: string, touches: unknown[]) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { touches });
    el.dispatchEvent(e);
  };

  it('a pinch previews on every touchmove and commits once on touchend', () => {
    const el = document.createElement('div');
    const h = { get: () => 48, preview: vi.fn(), commit: vi.fn() };
    bindGridZoom(el, h);
    fire(el, 'touchstart', [touch(0, 0), touch(0, 100)]);
    fire(el, 'touchmove', [touch(0, 0), touch(0, 150)]);
    fire(el, 'touchmove', [touch(0, 0), touch(0, 200)]);
    expect(h.preview).toHaveBeenCalledTimes(2);
    expect(h.preview).toHaveBeenLastCalledWith(96, 100);
    expect(h.commit).not.toHaveBeenCalled();
    fire(el, 'touchend', [touch(0, 0)]);
    expect(h.commit).toHaveBeenCalledOnce();
    expect(h.commit).toHaveBeenCalledWith(96);
  });

  it('a Ctrl+wheel burst accumulates in the preview and commits after the idle debounce', () => {
    vi.useFakeTimers();
    try {
      const el = document.createElement('div');
      const h = { get: () => 48, preview: vi.fn(), commit: vi.fn() };
      bindGridZoom(el, h);
      const wheel = () => el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientY: 10, cancelable: true }));
      wheel();
      vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1);
      wheel();
      expect(h.preview).toHaveBeenCalledTimes(2);
      expect(h.preview.mock.calls[1][0]).toBeCloseTo(48 * wheelZoomFactor(-100) ** 2, 1);
      expect(h.commit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(WHEEL_SETTLE_MS);
      expect(h.commit).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  it('a wheel without Ctrl is ignored', () => {
    const el = document.createElement('div');
    const h = { get: () => 48, preview: vi.fn(), commit: vi.fn() };
    bindGridZoom(el, h);
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(h.preview).not.toHaveBeenCalled();
  });
});
