/** The search beyond the device (feature item-search): when it asks Google, and when it does not. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const beyond = vi.fn();
vi.mock('@/stores/itemSearch', () => ({ useItemSearchStore: () => ({ beyond }) }));
vi.mock('@/lib/decisionLog', () => ({ logUndone: vi.fn() }));

const { useBeyondSearch, RETRY_AFTER_MS, MAX_QUERY } = await import('@/features/search/useBeyondSearch');

const reach = ref({ from: '2025-11-26', to: '2027-11-27' });
const today = ref('2026-11-26');
function setup(q = 'tax', enabled = true) {
  return useBeyondSearch(ref(q), reach, today, ref(enabled));
}
const settle = async () => { await vi.advanceTimersByTimeAsync(500); };

beforeEach(() => { vi.useFakeTimers(); beyond.mockReset(); beyond.mockResolvedValue({ items: [] }); });
afterEach(() => vi.useRealTimers());

describe('search beyond the device', () => {
  it('asks once at the end of the device results and says it searched all dates', async () => {
    const b = setup();
    b.reachedEnd();
    await settle();
    expect(beyond).toHaveBeenCalledTimes(1);
    expect(b.state.value).toBe('done');
  });

  it('after a failed ask waits before asking again, however often the end is reached', async () => {
    beyond.mockRejectedValue(new Error('boom'));
    const b = setup();
    b.reachedEnd();
    await settle();
    expect(b.state.value).toBe('limited');
    for (let i = 0; i < 20; i++) b.reachedEnd();
    await settle();
    expect(beyond).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS);
    b.reachedEnd();
    await settle();
    expect(beyond).toHaveBeenCalledTimes(2);
  });

  it('does not ask for a query the server would refuse', async () => {
    const b = setup('x'.repeat(MAX_QUERY + 1));
    b.reachedEnd();
    await settle();
    expect(beyond).not.toHaveBeenCalled();
    expect(b.state.value).toBe('idle');
  });

  it('does not ask while the device copy does not exist, so no date range is left out wrongly', async () => {
    const b = setup('tax', false);
    b.reachedEnd();
    await settle();
    expect(beyond).not.toHaveBeenCalled();
  });
});
