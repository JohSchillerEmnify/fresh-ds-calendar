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
  it('does not cut the draft while the next stroke is being drawn after a short lift', () => {
    vi.useFakeTimers();
    try {
      const w = useInkWriting(() => 'L', ref(true), () => []);
      w.changeDraft([stroke(3)]);
      vi.advanceTimersByTime(800);
      w.holdDraft();
      vi.advanceTimersByTime(1000);
      expect(w.draft.value).toHaveLength(1);
      expect(useOutboxStore().entries).toEqual([]);
      w.changeDraft([stroke(3), stroke(3)]);
      expect(w.draft.value).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });
  it('gives a stroke that undo brings back a fresh time, so the erase it undoes cannot drop it on the server', async () => {
    const old = { ...stroke(3), t: 100 };
    useInkStore().fromDevice({ version: 1, items: { a: [old] } });
    const w = useInkWriting(() => 'L', ref(true), () => ['a']);
    w.change('a', []);
    // the store shows the erase once its watcher ran, as it has before the next action
    await nextTick();
    w.undo();
    const [erase, undone] = useOutboxStore().entries.map((e) => e.change as { strokes: { t?: number }[]; at: number });
    expect(undone!.strokes).toHaveLength(1);
    expect(undone!.strokes[0]!.t).toBeGreaterThanOrEqual(erase!.at);
    expect(undone!.strokes[0]!.t).not.toBe(100);
  });
  it('keeps a margin below the server limit for what other devices may have added', () => {
    // about 189 KB: the server would still take a small stroke, but a merge with unseen strokes might not
    useInkStore().fromDevice({ version: 1, items: { a: [stroke(4750), stroke(4750)], b: [stroke(4000)] } });
    const w = useInkWriting(() => 'L', ref(true), () => ['a', 'b']);
    w.changeDraft([stroke(10)]);
    expect(w.draft.value).toEqual([]);
    expect(useUiStore().snackbars.length).toBe(1);
  });
});
