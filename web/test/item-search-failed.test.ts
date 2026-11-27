/** When the index cannot be built, the item search says so instead of showing nothing (feature item-search). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

vi.mock('@/lib/decisionLog', () => ({ logUndone: vi.fn() }));
const { ItemIndex } = await import('@/features/search/searchIndex');
const { useItemSearch, warmItemSearchIndex } = await import('@/features/search/useItemSearch');

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

  it('a background build already running when the search opens never runs alongside the search\'s own', async () => {
    let live = 0, most = 0;
    vi.spyOn(ItemIndex.prototype, 'updateAsync').mockImplementation(async () => {
      most = Math.max(most, ++live);
      await new Promise((r) => setTimeout(r, 20));
      live--;
    });
    warmItemSearchIndex();
    const s = useItemSearch(ref(null));
    expect(s.ready.value).toBe(false);
    await vi.waitFor(() => expect(s.ready.value).toBe(true));
    expect(most).toBe(1);
  });
});
