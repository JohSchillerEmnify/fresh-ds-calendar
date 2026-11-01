/** Writing on the open list (feature handwritten-lists): the new line becomes an item on the done button or when the list or page goes away; all writes go to the outbox, with undo. */
import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import type { InkStroke } from '@/api/types';
import { inkKey } from '@calendar/shared/ink';
import { INK_LIST_MAX_BYTES, inkListBytes } from '@calendar/shared/limits';
import { listen } from '@/lib/timers';
import { t } from '@/i18n';
import { useOutboxStore } from '@/stores/outbox';
import { useUiStore } from '@/stores/ui';
import { useInkStore } from '@/stores/ink';
import { usePenDoubleTap } from './usePenDoubleTap';

/** Room left for what other devices wrote meanwhile (the server measures the merged item). */
const INK_MARGIN_BYTES = INK_LIST_MAX_BYTES / 10;

/** One thing to take back: a stroke added to `itemId` (`null` = the draft), or the strokes an erase removed. */
type Step = { itemId: string | null; before?: InkStroke[] };

export function useInkWriting(listId: () => string, active: Ref<boolean>, inkIds: () => string[]) {
  const ink = useInkStore();
  const outbox = useOutboxStore();
  const ui = useUiStore();
  const draft = ref<InkStroke[]>([]);
  const history = ref<Step[]>([]);
  const created = new Set<string>();

  /** Whether the list can take the strokes of one item (`null`: the draft) in place of what it has; says so when it cannot. Same measure as the server's. */
  function room(itemId: string | null, strokes: InkStroke[]): boolean {
    const others = inkIds().filter((id) => id !== itemId).map((id) => ink.strokes(id)).filter((s) => s.length);
    const draftItem = itemId === null ? [] : draft.value.length ? [draft.value] : [];
    // below the server's limit by a margin: strokes another device added meanwhile count there too
    if (inkListBytes([...others, ...draftItem, strokes]) <= INK_LIST_MAX_BYTES - INK_MARGIN_BYTES) return true;
    ui.notify(t('ink.full'));
    return false;
  }

  /** Writing is done (the done button, the list closes, the page goes away): the draft becomes an item and the list's ink is sent. */
  function flush(): void {
    if (draft.value.length) {
      const id = outbox.addInkItem(listId(), draft.value);
      created.add(id);
      history.value = history.value.map((s) => (s.itemId === null ? { ...s, itemId: id } : s));
      draft.value = [];
    }
    outbox.sendInk(listId());
  }
  function changeDraft(strokes: InkStroke[]): void {
    if (strokes.length > draft.value.length && !room(null, strokes)) return;
    if (strokes.length > draft.value.length) history.value.push({ itemId: null });
    else history.value.push({ itemId: null, before: draft.value });
    draft.value = strokes;
  }
  /** The new strokes of an existing ink item (a stroke added, or an erase). */
  function change(itemId: string, strokes: InkStroke[]): void {
    const before = ink.strokes(itemId);
    if (strokes.length > before.length && !room(itemId, strokes)) return;
    history.value.push(strokes.length > before.length ? { itemId } : { itemId, before });
    outbox.setInk(listId(), itemId, strokes, before);
  }
  function undo(): void {
    const step = history.value.pop();
    if (!step) return;
    if (step.itemId === null) {
      draft.value = step.before ?? draft.value.slice(0, -1);
      return;
    }
    const now = ink.strokes(step.itemId);
    const known = new Set(now.map(inkKey));
    // a stroke that comes back is drawn again as far as the server is concerned: a fresh time keeps an earlier erase from dropping it
    const next = (step.before ?? now.slice(0, -1)).map((s) => (known.has(inkKey(s)) ? s : { ...s, t: Date.now() }));
    if (!next.length && created.has(step.itemId)) outbox.deleteItem(listId(), step.itemId, '');
    else outbox.setInk(listId(), step.itemId, next, now);
  }

  usePenDoubleTap(undo, () => active.value);
  // a page that goes away (closed, or put in the background where it may be ended) keeps every stroke
  const stops = [listen(window, 'pagehide', flush), listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); })];
  onBeforeUnmount(() => { stops.forEach((s) => s()); flush(); });
  return { draft, changeDraft, change, undo, flush, canUndo: computed(() => active.value && history.value.length > 0) };
}
