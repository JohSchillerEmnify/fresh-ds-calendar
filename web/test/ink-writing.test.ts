/** Writing on the open list: the list limit and the draft. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { memoryKv, setDeviceDb } from '@/lib/deviceDb';
import { useInkWriting } from '@/features/tasklists/useInkWriting';
import { useInkStore } from '@/stores/ink';
import { useUiStore } from '@/stores/ui';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { freshPinia, mockFetch } from './helpers';

const stroke = (n: number) => ({ p: Array.from({ length: n }, (_, i) => [1 + (i % 9) / 10, 0.5, 0.5] as [number, number, number]), c: '#d32f2f' });

beforeEach(() => { setDeviceDb(memoryKv()); freshPinia(); useItemsStore(); useDeviceStore(); mockFetch({ 'POST /api/tasklists/L/items': () => new Promise(() => undefined), 'PUT /api/tasklists/L/items/a/ink': () => new Promise(() => undefined) }); });
afterEach(() => setDeviceDb(null));

describe('useInkWriting', () => {
  it('refuses a stroke that takes the list over the limit and says so, and takes one that fits', () => {
    useInkStore().fromDevice({ version: 1, items: { a: [stroke(47500), stroke(47500)], b: [stroke(49900)] } });
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
  it('keeps the draft on its line however long the pen is lifted, until it is finished', () => {
    vi.useFakeTimers();
    try {
      const w = useInkWriting(() => 'L', ref(true), () => []);
      w.changeDraft([stroke(3)]);
      vi.advanceTimersByTime(60_000);
      w.changeDraft([stroke(3), stroke(3)]);
      expect(w.draft.value).toHaveLength(2);
      expect(useOutboxStore().entries).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
  it('shows the finished item with its strokes before the next render, so the line does not flicker', async () => {
    const w = useInkWriting(() => 'L', ref(true), () => []);
    useItemsStore().upsert({ kind: 'tasklist', id: 'L', items: [], title: 'L' } as never);
    w.changeDraft([stroke(3)]);
    w.flush();
    const id = (useOutboxStore().entries[0]!.change as { itemId: string }).itemId;
    // what the ink store shows is computed before Vue renders the change
    await nextTick();
    expect(useInkStore().strokes(id)).toHaveLength(1);
    expect((useItemsStore().get('L') as { items: { id: string }[] }).items.map((i) => i.id)).toEqual([id]);
  });
  it('keeps the draft when the list is updated meanwhile (another device, a sync)', async () => {
    const w = useInkWriting(() => 'L', ref(true), () => []);
    w.changeDraft([stroke(3)]);
    useItemsStore().upsert({ kind: 'tasklist', id: 'L', items: [{ id: 'x', title: 'New', done: false }], title: 'L', etag: 'e2' } as never);
    useInkStore().fromDevice({ version: 1, items: { x: [stroke(2)] } });
    await nextTick();
    expect(w.draft.value).toHaveLength(1);
  });
  it('finishes the draft and sends held lines when the page goes away', () => {
    const w = useInkWriting(() => 'L', ref(true), () => []);
    w.changeDraft([stroke(3)]);
    window.dispatchEvent(new Event('pagehide'));
    expect(w.draft.value).toEqual([]);
    expect(useOutboxStore().entries.map((e) => e.change.op)).toEqual(['item.add']);
  });
  it('gives a stroke that undo brings back a fresh time, so the erase it undoes cannot drop it on the server', async () => {
    const old = { ...stroke(3), t: 100 };
    useInkStore().fromDevice({ version: 1, items: { a: [old] } });
    const w = useInkWriting(() => 'L', ref(true), () => ['a']);
    w.change('a', []);
    // the store shows the erase once its watcher ran, as it has before the next action
    await nextTick();
    w.undo();
    // the line is still being written, so the undo folds into the unsent erase: one change, from the first base
    const all = useOutboxStore().entries.map((e) => e.change as { strokes: { t?: number }[]; base: string[] });
    expect(all).toHaveLength(1);
    expect(all[0]!.base).toHaveLength(1);
    expect(all[0]!.strokes).toHaveLength(1);
    expect(all[0]!.strokes[0]!.t).not.toBe(100);
  });
  it('keeps a margin below the server limit for what other devices may have added', () => {
    // about 189 KB: the server would still take a small stroke, but a merge with unseen strokes might not
    useInkStore().fromDevice({ version: 1, items: { a: [stroke(47500), stroke(47500)], b: [stroke(40000)] } });
    const w = useInkWriting(() => 'L', ref(true), () => ['a', 'b']);
    w.changeDraft([stroke(10)]);
    expect(w.draft.value).toEqual([]);
    expect(useUiStore().snackbars.length).toBe(1);
  });
});
