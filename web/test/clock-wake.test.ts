/** The clock store's `wakeAt`: requested instants share the one ticker timer and pause while the page is hidden. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClockStore } from '@/stores/clock';
import { freshPinia } from './helpers';

const T0 = Date.parse('2026-10-12T06:12:10Z'); // 10 s into a minute

describe('clock wakeAt', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
  let current: ReturnType<typeof useClockStore> | null = null;
  // stop the ticker so its visibility listener does not leak into the next test
  afterEach(() => { current?.stopTicker(); vi.useRealTimers(); });

  function started() {
    freshPinia();
    const clock = useClockStore();
    clock.startTicker();
    current = clock;
    return clock;
  }

  it('refreshes nowTick at a wake earlier than the next minute, with no extra timer', async () => {
    const clock = started();
    clock.wakeAt(T0 + 20_000);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(clock.nowTick).toBe(T0);
    await vi.advanceTimersByTimeAsync(1);
    expect(clock.nowTick).toBe(T0 + 20_000);
  });

  it('serves several wakes in order and still ticks on the minute', async () => {
    const clock = started();
    clock.wakeAt(T0 + 30_000);
    clock.wakeAt(T0 + 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(clock.nowTick).toBe(T0 + 10_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(clock.nowTick).toBe(T0 + 30_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(clock.nowTick).toBe(T0 + 50_000);
  });

  it('ignores a past instant and pauses while hidden', async () => {
    const clock = started();
    clock.wakeAt(T0 - 1);
    expect(vi.getTimerCount()).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    clock.wakeAt(T0 + 5_000);
    expect(vi.getTimerCount()).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(1);
  });
});
