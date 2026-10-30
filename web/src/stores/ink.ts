/** Handwritten lists on the device: the person's ink (server copy plus unsent writes), writing mode, colour and pen, per device. */
import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import type { InkDoc, InkStroke } from '@/api/types';
import { withPendingInk } from '@/lib/ink';
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
  const server = shallowRef<InkDoc['lists']>({});
  const lists = shallowRef<InkDoc['lists']>({});
  const mode = ref<'ink' | 'text'>(read(MODE_KEY) === 'text' ? 'text' : 'ink');
  /** `null` = the theme's text colour (decision Q4). */
  const colour = ref<string | null>(/^#[0-9a-f]{6}$/i.test(read(COLOUR_KEY) ?? '') ? read(COLOUR_KEY) : null);
  const eraser = ref(false);
  const penSeen = ref(read(PEN_KEY) === '1');

  watch(() => outbox.entries, (es) => { lists.value = withPendingInk(server.value, es); }, { immediate: true });

  /** Takes the server's ink (every sync); unsent writes stay on top. */
  function fromDevice(d: InkDoc | undefined): void {
    server.value = d?.lists ?? {};
    lists.value = withPendingInk(server.value, outbox.entries);
  }
  /** The strokes of one ink item. */
  function strokes(listId: string, itemId: string): InkStroke[] {
    return lists.value[listId]?.[itemId] ?? [];
  }
  function setMode(m: 'ink' | 'text'): void { mode.value = m; write(MODE_KEY, m); }
  function setColour(c: string | null): void { colour.value = c; write(COLOUR_KEY, c); }
  /** A pen touched the screen: this device has one (decision R4), remembered. */
  function notePen(): void {
    if (penSeen.value) return;
    penSeen.value = true;
    write(PEN_KEY, '1');
  }

  return { mode, colour, eraser, penSeen, lists, strokes, fromDevice, setMode, setColour, notePen };
});
