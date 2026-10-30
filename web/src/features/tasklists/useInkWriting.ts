/** Writing on the open list (feature handwritten-lists): a draft line becomes an item after a pause; all writes go to the outbox, with undo. */
import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import type { InkStroke } from '@/api/types';
import { INK_LIST_MAX_BYTES, inkListBytes } from '@calendar/shared/limits';
import { appTimeout, type Disposer } from '@/lib/timers';
import { t } from '@/i18n';
import { useOutboxStore } from '@/stores/outbox';
import { useUiStore } from '@/stores/ui';
import { useInkStore } from '@/stores/ink';

/** Idle time after the last stroke on the empty line before it becomes an item. */
const DRAFT_MS = 1200;

/** One thing to take back: a stroke added to `itemId` (`null` = the draft), or the strokes an erase removed. */
type Step = { itemId: string | null; before?: InkStroke[] };

export function useInkWriting(listId: () => string, active: Ref<boolean>, inkIds: () => string[]) {
  const ink = useInkStore();
  const outbox = useOutboxStore();
  const ui = useUiStore();
  const draft = ref<InkStroke[]>([]);
  const history = ref<Step[]>([]);
  const created = new Set<string>();
  let stop: Disposer | null = null;

  /** Whether the list can take the strokes of one item (`null`: the draft) in place of what it has; says so when it cannot. Same measure as the server's. */
  function room(itemId: string | null, strokes: InkStroke[]): boolean {
    const others = inkIds().filter((id) => id !== itemId).map((id) => ink.strokes(id)).filter((s) => s.length);
    const draftItem = itemId === null ? [] : draft.value.length ? [draft.value] : [];
    if (inkListBytes([...others, ...draftItem, strokes]) <= INK_LIST_MAX_BYTES) return true;
    ui.notify(t('ink.full'));
    return false;
  }

  /** The draft becomes an item now (a pause, the list closes, another line is written). */
  function flush(): void {
    stop?.();
    stop = null;
    if (!draft.value.length) return;
    const id = outbox.addInkItem(listId(), draft.value);
    created.add(id);
    history.value = history.value.map((s) => (s.itemId === null ? { ...s, itemId: id } : s));
    draft.value = [];
  }
  function changeDraft(strokes: InkStroke[]): void {
    if (strokes.length > draft.value.length && !room(null, strokes)) return;
    if (strokes.length > draft.value.length) history.value.push({ itemId: null });
    else history.value.push({ itemId: null, before: draft.value });
    draft.value = strokes;
    stop?.();
    stop = appTimeout(flush, DRAFT_MS);
  }
  /** The new strokes of an existing ink item (a stroke added, or an erase). */
  function change(itemId: string, strokes: InkStroke[]): void {
    const before = ink.strokes(itemId);
    if (strokes.length > before.length && !room(itemId, strokes)) return;
    history.value.push(strokes.length > before.length ? { itemId } : { itemId, before });
    outbox.setInk(listId(), itemId, strokes);
  }
  function undo(): void {
    const step = history.value.pop();
    if (!step) return;
    if (step.itemId === null) {
      draft.value = step.before ?? draft.value.slice(0, -1);
      return;
    }
    const now = ink.strokes(step.itemId);
    const next = step.before ?? now.slice(0, -1);
    if (!next.length && created.has(step.itemId)) outbox.deleteItem(listId(), step.itemId, '');
    else outbox.setInk(listId(), step.itemId, next);
  }

  onBeforeUnmount(flush);
  return { draft, changeDraft, change, undo, flush, canUndo: computed(() => active.value && history.value.length > 0) };
}
