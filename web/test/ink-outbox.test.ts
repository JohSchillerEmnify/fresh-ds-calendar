/** Ink writes in the outbox (ADR 0031): a newer rewrite replaces an unsent older one. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryKv, setDeviceDb } from '@/lib/deviceDb';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { useInkStore } from '@/stores/ink';
import { ports } from '@/lib/outboxPorts';
import { freshPinia, mockFetch } from './helpers';

const s = (n: number) => ({ p: [[n, 0, 1]] as [number, number, number][] });

beforeEach(() => { setDeviceDb(memoryKv()); freshPinia(); useItemsStore(); useDeviceStore(); });
afterEach(() => setDeviceDb(null));

describe('outbox ink', () => {
  it('folds rewrites of one item into its unsent add and into an unsent rewrite, and keeps other items apart', () => {
    mockFetch({ 'POST /api/tasklists/L/items': () => new Promise(() => undefined) });
    const out = useOutboxStore();
    // the first entry is on its way (never answered), later ones wait behind it
    out.addItem('L', 'text');
    const id = out.addInkItem('L', [s(1)]);
    out.setInk('L', id, [s(1), s(2)], [s(1)]);
    expect(out.entries.map((e) => e.change.op)).toEqual(['item.add', 'item.add']);
    expect((out.entries[1]!.change as { strokes: unknown[] }).strokes).toHaveLength(2);
    out.setInk('L', 'other', [s(5)], []);
    out.setInk('L', 'other', [s(5), s(6)], [s(5)]);
    expect(out.entries.map((e) => e.change.op)).toEqual(['item.add', 'item.add', 'item.ink']);
    expect((out.entries[2]!.change as { strokes: unknown[] }).strokes).toHaveLength(2);
  });

  it('never rewrites the entry that is being sent', () => {
    mockFetch({ 'POST /api/tasklists/L/items': () => new Promise(() => undefined) });
    const out = useOutboxStore();
    const id = out.addInkItem('L', [s(1)]);
    out.setInk('L', id, [s(1), s(2)], [s(1)]);
    expect(out.entries).toHaveLength(2);
    expect((out.entries[0]!.change as { strokes: unknown[] }).strokes).toHaveLength(1);
  });

  it('takes the merged strokes of the server\'s answer, erase marks left out', () => {
    useOutboxStore();
    const store = useInkStore();
    const mine = [s(1)];
    const merged = [{ p: [], t: 5 }, s(1), s(2)];
    ports.adoptInk!({ op: 'item.ink', id: 'L', itemId: 'a', strokes: mine, base: [], at: 9 }, { ink: { a: merged } } as never);
    expect(store.strokes('a')).toEqual([s(1), s(2)]);
  });
});
