/** Handwritten lists on the device: the person's ink (server copy plus unsent writes), writing mode, colour and pen, per device. */
import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import type { CalendarItem, InkDoc, InkStroke, TaskList } from '@/api/types';
import { keptItems, type Change, type OutboxEntry } from '@/lib/outbox';
import { withPendingInk } from '@/lib/ink';
import { ports } from '@/lib/outboxPorts';
import { useOutboxStore } from './outbox';

const MODE_KEY = 'cal.ink.mode';
const COLOUR_KEY = 'cal.ink.colour';
const PEN_KEY = 'cal.ink.pen';

/** A value from `localStorage`, `null` when blocked or empty. */
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
/** Remembers a value on this device; a blocked storage only loses it at the next start. */
function write(key: string, value: string | null): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* not remembered */ }
}

export const useInkStore = defineStore('ink', () => {
  const outbox = useOutboxStore();
  const server = shallowRef<InkDoc['items']>({});
  const lists = shallowRef<InkDoc['items']>({});
  const mode = ref<'ink' | 'text'>(read(MODE_KEY) === 'text' ? 'text' : 'ink');
  /** `null` = the theme's text colour (decision Q4). */
  const colour = ref<string | null>(/^#[0-9a-f]{6}$/i.test(read(COLOUR_KEY) ?? '') ? read(COLOUR_KEY) : null);
  const eraser = ref(false);
  const penSeen = ref(read(PEN_KEY) === '1');

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
    server.value = withPendingInk(server.value, [{ change: c } as OutboxEntry]);
  }
  /** The strokes of one ink item. */
  function strokes(itemId: string): InkStroke[] {
    return lists.value[itemId] ?? [];
  }
  function setMode(m: 'ink' | 'text'): void { mode.value = m; write(MODE_KEY, m); }
  function setColour(c: string | null): void { colour.value = c; write(COLOUR_KEY, c); }
  /** A pen touched the screen: this device has one (decision R4), remembered. */
  function notePen(): void {
    if (penSeen.value) return;
    penSeen.value = true;
    write(PEN_KEY, '1');
  }

  ports.adoptInk = adopt;

  return { mode, colour, eraser, penSeen, lists, strokes, fromDevice, setMode, setColour, notePen };
});
