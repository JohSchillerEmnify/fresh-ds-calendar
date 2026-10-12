import { defineStore } from 'pinia';
import { ApiError } from '@/api/client';
import type { CalendarEvent, TaskItem, TaskList } from '@/api/types';
import { removeItem } from '@/features/tasklists/ops';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { useItemsStore } from './items';
import { useUiStore } from './ui';

/** How long a delete can be undone before its request is sent (ARCHITECTURE "Delete with undo"). */
export const UNDO_MS = 6000;
/** Every string of the undo snackbar. */
export const UNDO_TEXT = {
  deleted: (title: string) => `Deleted: ${title}`,
  undo: 'Undo',
  untitledList: 'List',
} as const;

declare global {
  interface Window {
    /** Deletes waiting for their undo time or still in flight (e2e: "the undo time is over"). */
    __pendingDeletes?: number;
  }
}

interface Pending {
  title: string;
  /** Task list item deletes: the list holding the item. */
  listId?: string;
  /** Show the entry again (undo, or the request failed). */
  restore(): void;
  /** Send the DELETE request. */
  send(keepalive: boolean): Promise<void>;
}

/** The entry is gone on the server already: the delete counts as done. */
const gone = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 410);

/**
 * Deferred deletes with undo. A delete hides the entry at once (items store `hide*`) and shows the undo snackbar;
 * the request is sent only when the snackbar times out. One pending delete at a time: a new one sends the previous
 * at once; `pagehide` / hidden tab sends it with `keepalive`. A failed request brings the entry back (the request
 * paths report to the sync error banner).
 */
export const usePendingDeletesStore = defineStore('pendingDeletes', () => {
  let current: { p: Pending; stop: Disposer; snack: number } | null = null;
  let inFlight = 0;
  const mark = () => { if (typeof window !== 'undefined') window.__pendingDeletes = inFlight + (current ? 1 : 0); };

  // The page may go away before the timer fires: send what is pending while the page can still send.
  if (typeof window !== 'undefined') {
    listen(window, 'pagehide', () => { void flush(true); });
    listen(document, 'visibilitychange', () => { if (document.hidden) void flush(true); });
  }

  /** Take the pending delete off the timer and the snackbar. */
  function take(): Pending | null {
    const c = current;
    if (!c) return null;
    current = null;
    c.stop();
    useUiStore().dismiss(c.snack);
    return c.p;
  }

  function start(p: Pending, hide: () => void): void {
    void flush();
    hide();
    const snack = useUiStore().notify(UNDO_TEXT.deleted(p.title), {
      duration: 0, testid: 'undo-snackbar',
      action: { label: UNDO_TEXT.undo, testid: 'undo-action', run: undo },
    });
    current = { p, snack, stop: appTimeout(() => { void flush(); }, UNDO_MS) };
    mark();
  }

  /** Bring the pending entry back; nothing is sent. */
  function undo(): void {
    take()?.restore();
    mark();
  }

  /** Send the pending delete now. Resolves when its request finished (a failure restores the entry). */
  async function flush(keepalive = false): Promise<void> {
    const p = take();
    if (!p) return;
    inFlight++;
    mark();
    try {
      await p.send(keepalive);
    } catch (e) {
      if (!gone(e)) p.restore();
    } finally {
      inFlight--;
      mark();
    }
  }

  /**
   * Send a pending item delete of this list now. A reorder needs it: the server wants every item id, and the
   * cached list no longer shows the hidden one. Queued first, so the reorder sees the list without it.
   */
  function flushList(listId: string): void {
    if (current?.p.listId === listId) void flush();
  }

  function deleteEvent(ev: CalendarEvent): void {
    const items = useItemsStore();
    start({
      title: ev.title,
      restore: () => items.unhide(ev),
      send: (keepalive) => items.deleteEvent(ev.id, ev.etag, { keepalive }),
    }, () => items.hide(ev.id));
  }

  function deleteTaskList(tl: TaskList): void {
    const items = useItemsStore();
    start({
      title: tl.title || UNDO_TEXT.untitledList,
      restore: () => items.unhide(tl),
      send: (keepalive) => items.deleteTaskList(tl.id, tl.etag, { keepalive }),
    }, () => items.hide(tl.id));
  }

  /** `index`: the item's position in the list, where an undo puts it back. */
  function deleteTaskItem(listId: string, item: TaskItem, index: number): void {
    const items = useItemsStore();
    start({
      title: item.title,
      listId,
      restore: () => items.unhideTaskItem(listId, item, index),
      send: (keepalive) => new Promise<void>((resolve, reject) => {
        removeItem(listId, item.id, { keepalive }, (err) => (err === undefined ? resolve() : reject(err)));
      }),
    }, () => items.hideTaskItem(listId, item.id));
  }

  return { deleteEvent, deleteTaskList, deleteTaskItem, undo, flush, flushList };
});
