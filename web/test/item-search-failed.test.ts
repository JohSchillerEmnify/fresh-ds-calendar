/** When the index cannot be built, the item search says so instead of showing nothing (feature item-search). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

vi.mock('@/lib/decisionLog', () => ({ logUndone: vi.fn() }));
const { ItemIndex } = await import('@/features/search/searchIndex');
const { useItemSearch } = await import('@/features/search/useItemSearch');

beforeEach(() => setActivePinia(createPinia()));

describe('item search index failure', () => {
  it('reports the failure and does not claim the index is ready', async () => {
    vi.spyOn(ItemIndex.prototype, 'updateAsync').mockRejectedValue(new Error('boom'));
    const s = useItemSearch(ref(null));
    await vi.waitFor(() => expect(s.failed.value).toBe(true));
    expect(s.ready.value).toBe(false);
  });

  it('is ready and not failed when the index builds', async () => {
    vi.spyOn(ItemIndex.prototype, 'updateAsync').mockResolvedValue(undefined);
    const s = useItemSearch(ref(null));
    await vi.waitFor(() => expect(s.ready.value).toBe(true));
    expect(s.failed.value).toBe(false);
  });
});
