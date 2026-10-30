/** The pure parts of the outbox (ADR 0031): kinds of change, how an unsent change shows, id replacement, names. */
import type {
  CalendarEvent, CalendarItem, ChangeScope, InkStroke, CreateEventInput, CreateTaskListInput, TaskItem, TaskList, UpdateEventInput, UpdateTaskListInput,
} from '@/api/types';

/** One change of an event, a task list or one of its items; `id` is the event or the list (a device id until its create was sent). */
export type Change =
  | { op: 'event.create'; id: string; input: CreateEventInput }
  | { op: 'event.update'; id: string; patch: UpdateEventInput }
  | { op: 'event.delete'; id: string }
  | { op: 'list.create'; id: string; input: CreateTaskListInput }
  | { op: 'list.update'; id: string; patch: UpdateTaskListInput; scope?: ChangeScope }
  | { op: 'list.delete'; id: string }
  | { op: 'item.add'; id: string; itemId: string; title: string; scope?: ChangeScope; strokes?: InkStroke[] }
  /** `base`: keys of the strokes the change started from, `at`: when it was made; the server merges with other devices' changes (decision G5). */
  | { op: 'item.ink'; id: string; itemId: string; strokes: InkStroke[]; base: string[]; at: number }
  | { op: 'item.patch'; id: string; itemId: string; patch: { title?: string; done?: boolean }; scope?: ChangeScope }
  | { op: 'item.delete'; id: string; itemId: string; scope?: ChangeScope }
  | { op: 'item.order'; id: string; itemIds: string[] };

/** An unsent change as the outbox keeps it (IndexedDB). */
export interface OutboxEntry {
  /** Sent as `Idempotency-Key`, so a resend is harmless. */
  key: string;
  /** Whose change it is: it is never sent under another person. */
  person: string;
  /** Order of making. */
  seq: number;
  change: Change;
  /** The version the change was based on (`If-Match`); refreshed on a 412 and by the answer to an earlier entry. */
  etag?: string;
  /** How an event change looked on the device (the form's result), kept to show it again after a sync. */
  shown?: CalendarEvent;
  /** A repeating list's delete: the series it goes as a whole for, pinned at its first try ('' = the list alone). */
  series?: string;
  /** Names the change in notices and in the list of unsent changes. */
  title: string;
}

export type ChangeKind = 'ticked' | 'created' | 'renamed' | 'changed' | 'deleted';

/** The kind of an entry for the list of unsent changes ("Milk ticked"). */
export function kindOf(c: Change): ChangeKind {
  switch (c.op) {
    case 'event.create': case 'list.create': case 'item.add': return 'created';
    case 'event.delete': case 'list.delete': case 'item.delete': return 'deleted';
    case 'item.patch': return c.patch.done === true && c.patch.title === undefined ? 'ticked' : c.patch.title !== undefined ? 'renamed' : 'changed';
    case 'list.update': return Object.keys(c.patch).length === 1 && c.patch.title !== undefined ? 'renamed' : 'changed';
    default: return 'changed';
  }
}

/** Whether an entry has something to correct in a form (not a tick, a delete or a reorder). */
export const editable = (c: Change): boolean => c.op === 'event.create' || c.op === 'event.update' || c.op === 'list.create' || c.op === 'list.update';

/** The items of a new list the server keeps: an empty line is no item (it drops them, so positions must be counted after this). */
export function keptItems<T extends { title: string; strokes?: unknown }>(items: T[] | undefined): T[] {
  return (items ?? []).filter((i) => i.title.trim() || i.strokes);
}

const recount = (tl: TaskList, items: TaskItem[]): TaskList => ({ ...tl, items, doneCount: items.filter((i) => i.done).length, totalCount: items.length });

/** A new task list as the device shows it before the server has answered. */
export function localTaskList(id: string, input: CreateTaskListInput): TaskList {
  const items = keptItems(input.items).map((i, n) => ({ id: `${id}-${n}`, title: i.title, done: i.done ?? false, ...(i.strokes ? { ink: true as const } : {}) }));
  return recount({
    kind: 'tasklist', id, calendarId: '', title: input.title, date: input.date, time: input.date ? input.time ?? null : null, items, doneCount: 0, totalCount: 0,
    estimateMinutes: input.estimateMinutes ?? null, recurrence: input.recurrence ?? null, categoryId: input.categoryId ?? null, tags: input.tags ?? [],
    color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '', updated: '',
  }, items);
}

/** The item as it looks with one more unsent change on top (`null`: the change deletes it). */
export function applyEntry(cur: CalendarItem | null | undefined, e: OutboxEntry): CalendarItem | null | undefined {
  const c = e.change;
  switch (c.op) {
    case 'event.create': return e.shown ?? cur;
    case 'event.update': return e.shown ? { ...e.shown, etag: cur?.etag ?? e.shown.etag } : cur;
    case 'list.create': return cur ?? localTaskList(c.id, c.input);
    case 'event.delete': case 'list.delete': return null;
    case 'list.update': {
      if (cur?.kind !== 'tasklist') return cur;
      const rest = Object.fromEntries(Object.entries(c.patch).filter(([k]) => k !== 'items')) as Omit<UpdateTaskListInput, 'items'>;
      return { ...cur, ...rest, time: rest.date === null ? null : rest.time !== undefined ? rest.time : cur.time };
    }
    default: break;
  }
  return cur?.kind === 'tasklist' ? applyItemOp(cur, c) : cur;
}

/** One unsent item change on top of a task list. */
function applyItemOp(cur: TaskList, c: Change): TaskList {
  switch (c.op) {
    case 'item.add': return cur.items.some((i) => i.id === c.itemId) ? cur : recount(cur, [...cur.items, { id: c.itemId, title: c.title, done: false, ...(c.strokes ? { ink: true as const } : {}) }]);
    case 'item.patch': return recount(cur, cur.items.map((i) => (i.id === c.itemId ? { ...i, ...c.patch } : i)));
    case 'item.delete': return recount(cur, cur.items.filter((i) => i.id !== c.itemId));
    case 'item.order': {
      const at = (i: TaskItem) => { const n = c.itemIds.indexOf(i.id); return n < 0 ? Infinity : n; };
      return { ...cur, items: [...cur.items].sort((a, b) => at(a) - at(b)) };
    }
    default: return cur;
  }
}

/** What to show for an event or list: the server's version with these unsent entries (of that item, in order) on top. */
export function withPending(base: CalendarItem | undefined, entries: OutboxEntry[]): CalendarItem | null {
  let cur: CalendarItem | null | undefined = base;
  for (const e of entries) { cur = applyEntry(cur, e); if (cur === null) return null; }
  return cur ?? null;
}

/** The same entries with the device id `from` replaced by the server's `to` (after the create was sent). */
export function renameId(entries: OutboxEntry[], from: string, to: string): OutboxEntry[] {
  return entries.map((e) => (e.change.id === from
    ? { ...e, change: { ...e.change, id: to }, ...(e.shown ? { shown: { ...e.shown, id: to } } : {}) } as OutboxEntry
    : e));
}

/** The same entries with the device ids of a created list's items (`<list>-<n>`) replaced by the ids the server gave them. */
export function renameItems(entries: OutboxEntry[], listId: string, from: string, fresh: TaskItem[]): OutboxEntry[] {
  const real = (id: string): string => {
    const n = id.startsWith(`${from}-`) ? Number(id.slice(from.length + 1)) : NaN;
    return Number.isInteger(n) && fresh[n] ? fresh[n].id : id;
  };
  return entries.map((e) => {
    const c = e.change;
    if (c.id !== listId) return e;
    if (c.op === 'item.patch' || c.op === 'item.delete' || c.op === 'item.ink') return { ...e, change: { ...c, itemId: real(c.itemId) } };
    if (c.op === 'item.order') return { ...e, change: { ...c, itemIds: c.itemIds.map(real) } };
    return e;
  });
}

/** Random letters and digits (`getRandomValues` works on insecure LAN origins, unlike `crypto.randomUUID`). */
const randomText = (n: number): string => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');
let keySeq = 0;
/** A fresh `Idempotency-Key`. */
export const newKey = (): string => `${Date.now().toString(36)}-${(++keySeq).toString(36)}-${randomText(8)}`;
/** A device id for something created offline; the server's id replaces it. */
export const newDeviceId = (): string => `dev-${newKey()}`;
/** A task list item id in the server's pattern (8-21 of `A-Za-z0-9_-`): the add names it, so the id never changes. */
export const newItemId = (): string => `${Date.now().toString(36)}${randomText(6)}`;
