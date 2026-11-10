import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { config, freshPinia, mockFetch } from './helpers';

describe('a period in which one calendar could not be read', () => {
  beforeEach(() => { freshPinia(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  function setup() {
    let failed: string[] = ['work'];
    const m = mockFetch({
      'GET /api/config': () => config(),
      'GET /api/items': () => ({ items: [], from: 'a', to: 'b', syncedAt: 'x', ...(failed.length ? { failed } : {}) }),
      'GET /api/summary': () => ({ days: {}, ...(failed.length ? { failed } : {}) }),
    });
    return { count: (p: string) => m.calls.filter((c) => c.path === p).length, heal: () => { failed = []; } };
  }

  it('is not kept as complete: the next background load reads it again', async () => {
    const { count, heal } = setup();
    await useClockStore().load();
    const items = useItemsStore();
    items.prefetch('2028-01-10', '2028-01-17');
    await vi.advanceTimersByTimeAsync(100);
    items.prefetch('2028-01-10', '2028-01-17');
    await vi.advanceTimersByTimeAsync(100);
    expect(count('/api/items')).toBe(2);
    heal();
    items.prefetch('2028-01-10', '2028-01-17');
    await vi.advanceTimersByTimeAsync(100);
    items.prefetch('2028-01-10', '2028-01-17');
    await vi.advanceTimersByTimeAsync(100);
    expect(count('/api/items')).toBe(3);
  });

  it('keeps its day counts only until the next ask', async () => {
    const { count, heal } = setup();
    await useClockStore().load();
    const items = useItemsStore();
    await items.loadSummary('2028-01-01', '2029-01-01');
    await items.loadSummary('2028-01-01', '2029-01-01');
    expect(count('/api/summary')).toBe(2);
    heal();
    await items.loadSummary('2028-01-01', '2029-01-01');
    await items.loadSummary('2028-01-01', '2029-01-01');
    expect(count('/api/summary')).toBe(3);
  });
});
