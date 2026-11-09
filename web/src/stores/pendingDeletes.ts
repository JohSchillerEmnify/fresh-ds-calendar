import { defineStore } from 'pinia';
import { ApiError } from '@/api/client';
import { t } from '@/i18n';
import type { CalendarEvent, ChangeScope, TaskItem, TaskList } from '@/api/types';
import { removeItem } from '@/features/tasklists/ops';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { useItemsStore } from './items';
import { useOutboxStore } from './outbox';
import { useSyncStore } from './sync';
import { useThemeStore } from './theme';
import { useUiStore } from './ui';

/** How long a delete can be undone before its request is sent (view deleteWithUndo). */
export const UNDO_MS = 6000;

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
    const snack = useUiStore().notify(t('calendar.undo.deleted', { title: p.title }), {
      duration: 0, testid: 'undo-snackbar',
      action: { label: t('calendar.undo.undo'), testid: 'undo-action', run: undo },
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
    const outbox = useOutboxStore();
    start({
      title: ev.title,
      restore: () => items.unhide(ev),
      send: async () => {
        outbox.deleteEvent(ev);
        // a birthday goes with every year: reload what the views show
        if (ev.special) void useSyncStore().resyncAfterWrite();
      },
    }, () => items.hide(ev.id));
  }

  function deleteTaskList(tl: TaskList): void {
    const items = useItemsStore();
    const outbox = useOutboxStore();
    start({
      title: tl.title || t('tasks.list.fallbackLabel'),
      restore: () => items.unhide(tl),
      send: async () => { outbox.deleteList(tl); },
    }, () => items.hide(tl.id));
  }

  function deleteTheme(id: string, name: string): void {
    const theme = useThemeStore();
    start({
      title: name,
      restore: () => theme.unhide(id),
      send: (keepalive) => theme.removeCustom(id, keepalive),
    }, () => theme.hide(id));
  }

  /** A task list template (feature tasklist-templates): gone from the Templates page at once, deleted after the undo time. */
  function deleteTemplate(id: string, name: string): void {
    const templates = useTemplatesStore();
    start({
      title: name,
      restore: () => templates.unhide(id),
      send: (keepalive) => templates.remove(id, keepalive),
    }, () => templates.hide(id));
  }

  /** `index`: the item's position in the list, where an undo puts it back; `scope` `following`: this and all later occurrences of a repeating list. */
  function deleteTaskItem(listId: string, item: TaskItem, index: number, scope?: ChangeScope): void {
    const items = useItemsStore();
    start({
      title: item.title,
      listId,
      restore: () => items.unhideTaskItem(listId, item, index),
      send: () => new Promise<void>((resolve) => { removeItem(listId, item.id, item.title, resolve, scope); }),
    }, () => items.hideTaskItem(listId, item.id));
  }

  return { deleteEvent, deleteTaskList, deleteTaskItem, deleteTheme, deleteTemplate, undo, flush, flushList };
});
