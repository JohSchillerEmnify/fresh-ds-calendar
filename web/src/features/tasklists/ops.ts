/**
 * Task list item operations with optimistic UI that stays correct under rapid input.
 *
 * Per list there is one serial queue. The list shown in the UI is `base` (the last server-confirmed TaskList)
 * with every still-pending operation replayed on top. So:
 * - each tap shows its result at once;
 * - requests are sent one after another (the server merges item operations itself, no etag needed);
 * - patches to the same item that have not been sent yet are merged (last write wins per field);
 * - a failed operation is dropped (rolled back, the others stay) and a snackbar says so;
 * - a poll never overwrites the list while operations are pending (items store `beginPending`).
 */
import { api, ApiError, type RequestOptions } from '@/api/client';
import type { ChangeScope, TaskItem, TaskList } from '@/api/types';
import { t } from '@/i18n';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { moveTo } from './reorder';

type Resolve = (id: string) => string;
interface Queue {
  base: TaskList;
  ops: Op[];
  running: boolean;
  alias: Map<string, string>;
}
interface Op {
  /** Same-key ops that are not in flight yet are merged. */
  key?: string;
  patch?: { title?: string; done?: boolean };
  inflight: boolean;
  apply(tl: TaskList, r: Resolve): TaskList;
  call(q: Queue, r: Resolve): Promise<TaskList>;
  done?(fresh: TaskList, q: Queue, before: TaskList): void;
  /** The request failed (the queue still rolls back and reports as usual). */
  failed?(e: unknown): void;
}

const queues = new Map<string, Queue>();
/** real id -> temporary id of items added in this session, so list keys stay stable when the server id arrives. */
const keyOf = new Map<string, string>();
let tmpSeq = 0;


function recount(tl: TaskList): TaskList {
  return { ...tl, doneCount: tl.items.filter((i) => i.done).length, totalCount: tl.items.length };
}
const mapItem = (tl: TaskList, id: string, fn: (i: TaskItem) => TaskItem | null): TaskList =>
  recount({ ...tl, items: tl.items.flatMap((i) => (i.id === id ? (fn(i) ? [fn(i)!] : []) : [i])) });

function render(q: Queue): void {
  const r: Resolve = (id) => q.alias.get(id) ?? id;
  const tl = q.ops.reduce((t, o) => o.apply(t, r), recount(structuredClone(q.base)));
  useItemsStore().upsert(tl);
}

async function run(listId: string, q: Queue): Promise<void> {
  const items = useItemsStore();
  q.running = true;
  const r: Resolve = (id) => q.alias.get(id) ?? id;
  try {
    while (q.ops.length) {
      const op = q.ops[0];
      op.inflight = true;
      const before = q.base;
      try {
        const fresh = await op.call(q, r);
        q.base = fresh;
        op.done?.(fresh, q, before);
      } catch (e) {
        op.failed?.(e);
        if (e instanceof ApiError) {
          if (e.isUnavailable) useSyncStore().reportError(e);
          if (e.status === 404) {
            // The list was removed elsewhere: stop, drop it from the cache.
            q.ops.length = 0;
            items.remove(listId);
            useUiStore().notify(t('tasks.list.gone'));
            break;
          }
        }
        useUiStore().notify(t('tasks.list.rollback'), { testid: 'tasklist-rollback' });
      }
      q.ops.shift();
      if (q.ops.length) render(q);
    }
  } finally {
    queues.delete(listId);
    items.endPending(listId);
    if (items.get(listId)) items.upsert(q.base);
  }
}

function enqueue(listId: string, op: Op): void {
  const items = useItemsStore();
  let q = queues.get(listId);
  if (!q) {
    const cur = items.get(listId);
    if (!cur || cur.kind !== 'tasklist') return;
    q = { base: cur, ops: [], running: false, alias: new Map() };
    queues.set(listId, q);
    items.beginPending(listId);
  }
  const prev = op.key ? q.ops.find((o) => o.key === op.key && !o.inflight) : undefined;
  if (prev && prev.patch && op.patch) {
    prev.patch = { ...prev.patch, ...op.patch }; // `apply`/`call` of prev read prev.patch
  } else {
    q.ops.push(op);
  }
  render(q);
  if (!q.running) void run(listId, q);
}

/** A change for every week of a repeating list landed: the other weeks the views show are read again. */
function allWeeksDone(): void {
  useItemsStore().refreshVisible().catch(() => undefined);
}
/** `scope` of a request: only `all` goes to the server (`this` is the plain request). */
const sent = (scope?: ChangeScope) => (scope === 'all' ? 'all' : undefined);

// --- public operations --------------------------------------------------------------------------------
/**
 * Set or merge a patch for one item (tick / rename). `scope` `all` renames the item in every week of a repeating list
 * (feature tasklist-repeating); such a patch is never merged with a tick.
 */
export function patchItem(listId: string, itemId: string, patch: { title?: string; done?: boolean }, scope?: ChangeScope): void {
  const all = sent(scope);
  const op: Op = {
    key: all ? undefined : `patch:${itemId}`, patch: { ...patch }, inflight: false,
    apply: () => { throw new Error('replaced below'); },
    call: async (q, r) => {
      const id = r(itemId);
      if (id.startsWith('tmp-')) return q.base; // the add failed, nothing to patch
      return api.updateTaskItem(listId, id, op.patch!, undefined, all);
    },
    done: all ? allWeeksDone : undefined,
  };
  op.apply = (tl, r) => mapItem(tl, r(itemId), (i) => ({ ...i, ...op.patch }));
  enqueue(listId, op);
}

/** Add an item at the end; `scope` `all` adds it to every week of a repeating list. */
export function addItem(listId: string, title: string, scope?: ChangeScope): void {
  const tmp = `tmp-${++tmpSeq}`;
  const all = sent(scope);
  const op: Op = {
    inflight: false,
    apply: (tl) => recount({ ...tl, items: [...tl.items, { id: tmp, title, done: false }] }),
    call: () => api.addTaskItem(listId, { title }, undefined, all),
    done: (fresh, q, before) => {
      if (all) allWeeksDone();
      const known = new Set(before.items.map((i) => i.id));
      const real = [...fresh.items].reverse().find((i) => !known.has(i.id));
      if (real) {
        q.alias.set(tmp, real.id);
        keyOf.set(real.id, tmp);
      }
    },
  };
  enqueue(listId, op);
}

/**
 * Remove an item. `o` is passed to the request; `done` is called once it finished (with the error if it failed);
 * `scope` `all` removes it from every week of a repeating list.
 */
export function removeItem(listId: string, itemId: string, o: RequestOptions = {}, done?: (err?: unknown) => void, scope?: ChangeScope): void {
  const all = sent(scope);
  // A deferred delete may land after the list left the cache (no queue possible): send it directly.
  if (useItemsStore().get(listId)?.kind !== 'tasklist') {
    api.deleteTaskItem(listId, itemId, o, all).then(() => { if (all) allWeeksDone(); done?.(); }, (e) => { useSyncStore().reportError(e); done?.(e); });
    return;
  }
  enqueue(listId, {
    inflight: false,
    apply: (tl, r) => mapItem(tl, r(itemId), () => null),
    call: async (q, r) => {
      const id = r(itemId);
      if (id.startsWith('tmp-')) return q.base;
      return api.deleteTaskItem(listId, id, o, all);
    },
    done: () => { if (all) allWeeksDone(); done?.(); },
    failed: (e) => done?.(e ?? new Error('delete failed')),
  });
}

/** Move an item to index `to` (a drag and drop); optimistic like a tick, rolled back with a snackbar if saving fails. */
export function moveItemTo(listId: string, itemId: string, to: number): void {
  enqueue(listId, {
    inflight: false,
    apply: (tl, r) => ({ ...tl, items: moveTo(tl.items, tl.items.findIndex((i) => i.id === r(itemId)), to) }),
    call: async (q, r) => {
      const ids = q.base.items.map((i) => i.id);
      const id = r(itemId);
      if (id.startsWith('tmp-') || !ids.includes(id)) return q.base;
      return api.reorderTaskItems(listId, moveTo(ids, ids.indexOf(id), to));
    },
  });
}

/** Stable v-for key: the temporary id an item had when added in this session. */
export const stableKey = (id: string): string => keyOf.get(id) ?? id;
export function forget(listId: string): void {
  const items = useItemsStore().get(listId);
  if (items?.kind === 'tasklist') for (const i of items.items) keyOf.delete(i.id);
}
export const hasPending = (listId: string): boolean => queues.has(listId);
