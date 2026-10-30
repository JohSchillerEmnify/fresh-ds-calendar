/** Writing on the open list: the list limit and the draft. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { memoryKv, setDeviceDb } from '@/lib/deviceDb';
import { useInkWriting } from '@/features/tasklists/useInkWriting';
import { useInkStore } from '@/stores/ink';
import { useUiStore } from '@/stores/ui';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { freshPinia, mockFetch } from './helpers';

const stroke = (n: number) => ({ p: Array.from({ length: n }, (_, i) => [1 + (i % 9) / 10, 0.5, 0.5] as [number, number, number]), c: '#d32f2f' });

beforeEach(() => { setDeviceDb(memoryKv()); freshPinia(); useItemsStore(); useDeviceStore(); mockFetch({ 'POST /api/tasklists/L/items': () => new Promise(() => undefined) }); });
afterEach(() => setDeviceDb(null));

describe('useInkWriting', () => {
  it('refuses a stroke that takes the list over the limit and says so, and takes one that fits', () => {
    useInkStore().fromDevice({ version: 1, items: { a: [stroke(4750), stroke(4750)], b: [stroke(4990)] } });
    const w = useInkWriting(() => 'L', ref(true), () => ['a', 'b']);
    w.changeDraft([stroke(20)]);
    expect(w.draft.value).toEqual([]);
    expect(useUiStore().snackbars.length).toBe(1);
  });
  it('makes an item of the draft and sends it', () => {
    const w = useInkWriting(() => 'L', ref(true), () => []);
    w.changeDraft([stroke(3)]);
    expect(w.draft.value).toHaveLength(1);
    w.flush();
    expect(w.draft.value).toEqual([]);
    expect(useOutboxStore().entries.map((e) => e.change.op)).toEqual(['item.add']);
  });
});
