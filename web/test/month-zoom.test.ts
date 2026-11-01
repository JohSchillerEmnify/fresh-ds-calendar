import { afterEach, describe, expect, it, vi } from 'vitest';
import { WHEEL_SETTLE_MS } from '@/composables/useHourHeight';
import {
  MAX_MONTH_ZOOM, MIN_MONTH_ZOOM, MONTH_ZOOM_KEY, bindMonthZoom, clampMonthZoom, monthZoom, monthZooming, readStoredMonthZoom, setMonthZoom,
  zoomedGridHeight,
} from '@/composables/useMonthZoom';

afterEach(() => { vi.useRealTimers(); setMonthZoom(1); localStorage.clear(); });

describe('month zoom', () => {
  it('stays between the whole month and its largest zoom', () => {
    expect(clampMonthZoom(0.5)).toBe(MIN_MONTH_ZOOM);
    expect(clampMonthZoom(99)).toBe(MAX_MONTH_ZOOM);
    expect(clampMonthZoom(Number.NaN)).toBe(MIN_MONTH_ZOOM);
    expect(clampMonthZoom(2)).toBe(2);
  });

  it('the weeks share the box at the smallest zoom; zoomed, five- and six-week months have about the same rows', () => {
    expect(zoomedGridHeight(600, 5, 1)).toBe(600);
    expect(zoomedGridHeight(600, 6, 1)).toBe(600);
    expect(zoomedGridHeight(600, 5, 2) / 5).toBe(240);
    const six = zoomedGridHeight(600, 6, 2) / 6;
    expect(six / 240).toBeGreaterThan(0.9);
    expect(six).toBeLessThan(240);
  });

  it('is remembered on this device; garbage or nothing stored is the whole month', () => {
    setMonthZoom(2.5);
    expect(localStorage.getItem(MONTH_ZOOM_KEY)).toBe('2.5');
    expect(readStoredMonthZoom()).toBe(2.5);
    localStorage.setItem(MONTH_ZOOM_KEY, 'nope');
    expect(readStoredMonthZoom()).toBe(MIN_MONTH_ZOOM);
    localStorage.removeItem(MONTH_ZOOM_KEY);
    expect(readStoredMonthZoom()).toBe(MIN_MONTH_ZOOM);
  });

  it('Ctrl+wheel previews live, keeps the page from zooming and commits once it settles', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const seen: Array<[number, number]> = [];
    const stop = bindMonthZoom(el, (from, to) => seen.push([from, to]));
    const e = new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, cancelable: true });
    el.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(monthZooming.value).toBe(true);
    expect(monthZoom.value).toBeGreaterThan(1);
    expect(seen[0][0]).toBe(1);
    expect(localStorage.getItem(MONTH_ZOOM_KEY)).toBeNull();
    vi.advanceTimersByTime(WHEEL_SETTLE_MS + 1);
    expect(monthZooming.value).toBe(false);
    expect(Number(localStorage.getItem(MONTH_ZOOM_KEY))).toBe(monthZoom.value);
    stop();
  });

  it('a plain wheel scrolls and leaves the zoom alone', () => {
    const el = document.createElement('div');
    const stop = bindMonthZoom(el);
    const e = new WheelEvent('wheel', { deltaY: -300, cancelable: true });
    el.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(monthZoom.value).toBe(1);
    stop();
  });
});
