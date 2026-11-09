/** Handwritten lists on the device: the person's ink (server copy plus unsent writes), writing mode, colour and pen, per device. */
import { visibleInk } from '@calendar/shared/ink';
import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import type { CalendarItem, InkDoc, InkStroke, TaskList } from '@/api/types';
import { keptItems, type Change, type OutboxEntry } from '@/lib/outbox';
import { withPendingInk } from '@/lib/ink';
import { ports } from '@/lib/outboxPorts';
import { useOutboxStore } from './outbox';

const MODE_KEY = 'cal.ink.mode';
const COLOUR_KEY = 'cal.ink.colour';
const PEN_KEY = 'cal.ink.pen';

/** Per-device remembered values: a blocked storage only loses them at the next start (no error output, defaults not written). */
const device = { listenToStorageChanges: false, writeDefaults: false, flush: 'sync' as const, onError: () => {} };

export const useInkStore = defineStore('ink', () => {
  const outbox = useOutboxStore();
  const server = shallowRef<InkDoc['items']>({});
  const lists = shallowRef<InkDoc['items']>({});
  const mode = useStorage<'ink' | 'text'>(MODE_KEY, 'ink', undefined, { ...device, serializer: { read: (v) => (v === 'text' ? 'text' : 'ink'), write: (v) => v } });
  /** `null` = the theme's text colour (decision Q4). */
  const colour = useStorage<string | null>(COLOUR_KEY, null, undefined, { ...device, serializer: { read: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null), write: (v) => v ?? '' } });
  const eraser = ref(false);
  const penSeen = useStorage(PEN_KEY, false, undefined, { ...device, serializer: { read: (v) => v === '1', write: (v) => (v ? '1' : '0') } });

  watch(() => outbox.entries, (es) => { lists.value = withPendingInk(server.value, es); }, { immediate: true });

  /** Takes the server's ink (every sync); unsent writes stay on top. */
  function fromDevice(d: InkDoc | undefined): void {
    server.value = d?.items ?? {};
    lists.value = withPendingInk(server.value, outbox.entries);
  }
  /** An ink write reached the server: its strokes join the server's copy before the outbox forgets the entry. */
  function adopt(c: Change, fresh?: CalendarItem): void {
    if (c.op === 'list.create') {
      if (fresh?.kind !== 'tasklist') return;
      const made = Object.fromEntries(keptItems(c.input.items).flatMap((i, n) => (i.strokes && fresh.items[n] ? [[fresh.items[n].id, i.strokes]] : [])));
      if (Object.keys(made).length) server.value = { ...server.value, ...made };
      return;
    }
    // a deleted list takes the ink of its items along
    if (c.op === 'list.delete') {
      const gone = new Set(ports.items?.get(c.id)?.kind === 'tasklist' ? (ports.items.get(c.id) as TaskList).items.map((i) => i.id) : []);
      server.value = Object.fromEntries(Object.entries(server.value).filter(([id]) => !gone.has(id)));
      return;
    }
    // the server's answer to an ink write holds the merged strokes of the item
    const merged = (fresh as { ink?: InkDoc['items'] } | undefined)?.ink;
    server.value = c.op === 'item.ink' && merged?.[c.itemId] ? { ...server.value, ...merged } : withPendingInk(server.value, [{ change: c } as OutboxEntry]);
    lists.value = withPendingInk(server.value, outbox.entries);
  }
  /** The strokes of one ink item. */
  function strokes(itemId: string): InkStroke[] {
    return visibleInk(lists.value[itemId] ?? []);
  }
  function setMode(m: 'ink' | 'text'): void { mode.value = m; }
  function setColour(c: string | null): void { colour.value = c; }
  /** A pen touched the screen: this device has one (decision R4), remembered. */
  function notePen(): void {
    if (penSeen.value) return;
    penSeen.value = true;
  }

  ports.adoptInk = adopt;

  return { mode, colour, eraser, penSeen, lists, strokes, fromDevice, setMode, setColour, notePen };
});
