/** The outbox's work (ADR 0031): keeping entries, showing them on the device, sending them in order, answering refusals. */
import type { Ref, ShallowRef } from 'vue';
import { ApiError } from '@/api/client';
import type { CalendarEvent, CalendarItem, ChangeScope, CreateEventInput, CreateTaskListInput, TaskList, UpdateEventInput, UpdateTaskListInput } from '@/api/types';
import { t } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useUiStore } from '@/stores/ui';
import { deviceDb, devicePerson, OUTBOX_KEY } from './deviceDb';
import {
  applyEntry, editable, localTaskList, newDeviceId, newItemId, newKey, renameId, renameItems, withPending, type Change, type OutboxEntry,
} from './outbox';
import { ports } from './outboxPorts';
import { fetchCurrent, isCreate, isDelete, isEvent, perform, retriable, versioned } from './outboxSend';
import { appTimeout, type Disposer } from './timers';

const RETRY_FIRST_MS = 1000;
const RETRY_MAX_MS = 30_000;
/** A 412 is answered by reading the item again at most this often per entry and try. */
const MAX_REFETCH = 3;

type Outcome = 'sent' | 'retry' | 'refused';

/** The state one outbox store keeps. */
export interface OutboxState {
  entries: ShallowRef<OutboxEntry[]>;
  /** The last successful send: device time and app-clock time. */
  lastSent: Ref<{ wall: number; app: number } | null>;
  seq: number;
  running: boolean;
  backoff: number;
  retry: Disposer | null;
  loaded: Promise<void> | null;
}

const items = () => ports.items!;
const forId = (s: OutboxState, id: string, list = s.entries.value): OutboxEntry[] => list.filter((e) => e.change.id === id);

export function setEntries(s: OutboxState, next: OutboxEntry[]): void {
  for (const e of s.entries.value) if (!next.some((n) => n.change.id === e.change.id)) ports.items?.endPending(e.change.id);
  for (const e of next) ports.items?.beginPending(e.change.id);
  s.entries.value = next;
  if (typeof document !== 'undefined') document.documentElement.dataset.unsynced = String(next.length);
}

/** Keeps the entries on the device: at once, so a page closed right after still has them. */
async function save(s: OutboxState): Promise<void> {
  const db = deviceDb();
  if (!db) return;
  try { await db.putMany({ [OUTBOX_KEY]: JSON.parse(JSON.stringify(s.entries.value)) }); } catch { /* storage blocked: the changes live until the page closes */ }
}
function commit(s: OutboxState, next: OutboxEntry[]): void {
  setEntries(s, next);
  void save(s);
}

/** Shows one more unsent change on the device (screen and device copy). */
function showOnDevice(e: OutboxEntry): void {
  const id = e.change.id;
  const next = applyEntry(items().get(id) ?? ports.device?.find(id), e);
  if (next === null) {
    const was = items().get(id);
    items().hide(id);
    ports.device?.drop(id, was?.kind === 'event' ? was.calendarId : undefined);
  } else if (next) items().upsert(next);
}

/** Reads the entries the device kept (the app start). */
export function load(s: OutboxState): Promise<void> {
  s.loaded ??= (async () => {
    const kept = await deviceDb()?.get<OutboxEntry[]>(OUTBOX_KEY).catch(() => undefined);
    setEntries(s, s.entries.value);
    if (!kept?.length) return;
    s.seq = Math.max(...kept.map((e) => e.seq));
    setEntries(s, [...kept, ...s.entries.value]);
    for (const e of kept) showOnDevice(e);
  })();
  return s.loaded;
}

/** The entries of the person the session belongs to; those of another person are dropped, never sent. */
function dropForeign(s: OutboxState, who: string): void {
  if (s.entries.value.some((e) => e.person !== who)) commit(s, s.entries.value.filter((e) => e.person === who));
}

/** Appends a change: shown at once, kept, and sent when it can be. */
export function add(s: OutboxState, change: Change, o: { title: string; shown?: CalendarEvent; etag?: string }): void {
  const person = ports.device?.person() ?? devicePerson() ?? '-';
  const etag = o.etag ?? (versioned(change) ? items().get(change.id)?.etag : undefined);
  const e: OutboxEntry = { key: newKey(), person, seq: ++s.seq, change, title: o.title, ...(etag ? { etag } : {}), ...(o.shown ? { shown: o.shown } : {}) };
  commit(s, [...s.entries.value, e]);
  showOnDevice(e);
  void flush(s);
}

/** The writes the views make; each is shown on the device at once. */
export function writes(s: OutboxState) {
  const title = (listId: string, itemId: string): string => {
    const tl = items().get(listId);
    return tl?.kind === 'tasklist' ? tl.items.find((i) => i.id === itemId)?.title ?? '' : '';
  };
  const scoped = (scope?: ChangeScope) => (scope ? { scope } : {});
  const updateList = (id: string, patch: UpdateTaskListInput, scope?: ChangeScope, etag?: string): void =>
    add(s, { op: 'list.update', id, patch, ...scoped(scope) }, { title: patch.title ?? (items().get(id)?.title ?? ''), etag });
  /** `shown`: the event as the form made it. Returns its id (a device id for a new one). */
  const saveEvent = (shown: CalendarEvent, input: CreateEventInput | UpdateEventInput, creating: boolean): string => {
    const id = creating ? newDeviceId() : shown.id;
    add(s, creating ? { op: 'event.create', id, input: input as CreateEventInput } : { op: 'event.update', id, patch: input as UpdateEventInput }, { title: shown.title, shown: { ...shown, id } });
    return id;
  };
  return {
    saveEvent,
    updateList,
    /** A move or resize of an event or list: `next` is how it shows at once. */
    changeItem(item: CalendarItem, next: CalendarItem, patch: UpdateEventInput | UpdateTaskListInput, etag: string | undefined): void {
      if (item.kind === 'event') saveEvent({ ...(next as CalendarEvent), etag: etag ?? item.etag }, patch as UpdateEventInput, false);
      else updateList(item.id, patch as UpdateTaskListInput, undefined, etag);
    },
    deleteEvent: (ev: CalendarEvent): void => add(s, { op: 'event.delete', id: ev.id }, { title: ev.title, etag: ev.etag }),
    createList(input: CreateTaskListInput): TaskList {
      const id = newDeviceId();
      add(s, { op: 'list.create', id, input }, { title: input.title });
      return localTaskList(id, input);
    },
    deleteList: (tl: TaskList): void => add(s, { op: 'list.delete', id: tl.id }, { title: tl.title, etag: tl.etag }),
    addItem: (listId: string, text: string, scope?: ChangeScope): void => add(s, { op: 'item.add', id: listId, itemId: newItemId(), title: text, ...scoped(scope) }, { title: text }),
    patchItem: (listId: string, itemId: string, patch: { title?: string; done?: boolean }, scope?: ChangeScope): void =>
      add(s, { op: 'item.patch', id: listId, itemId, patch, ...scoped(scope) }, { title: patch.title ?? title(listId, itemId) }),
    deleteItem: (listId: string, itemId: string, text: string, scope?: ChangeScope): void => add(s, { op: 'item.delete', id: listId, itemId, ...scoped(scope) }, { title: text }),
    orderItems: (listId: string, itemIds: string[]): void => add(s, { op: 'item.order', id: listId, itemIds }, { title: items().get(listId)?.title ?? '' }),
  };
}

// --- sending ---------------------------------------------------------------------------------------------------------
/** Once the create of an event or list was sent its device id is replaced by the server's, everywhere. */
function replaceId(s: OutboxState, from: string, fresh: CalendarItem): void {
  let next = renameId(s.entries.value, from, fresh.id);
  if (fresh.kind === 'tasklist') next = renameItems(next, fresh.id, from, fresh.items);
  items().remove(from);
  ports.device?.drop(from);
  setEntries(s, next);
  const ui = useUiStore();
  if (ui.expandedCard?.id === from) ui.expandedCard = { ...ui.expandedCard, id: fresh.id };
  if (ui.dialog?.props.id === from) ui.dialog = { ...ui.dialog, props: { ...ui.dialog.props, id: fresh.id } };
}

/** A repeating list deleted as a whole: every cached occurrence leaves, also parts split off by a "this and following" change. */
function dropSeries(series: string, id: string): void {
  for (const it of items().all()) if (it.kind === 'tasklist' && (it.seriesKey ?? it.seriesId) === series) { items().hide(it.id); ports.device?.drop(it.id); }
  items().forgetSeries(id);
  ports.resync?.();
}

/** After a successful send: the answer is the new version and the entries after it are based on it. */
function showAnswer(s: OutboxState, c: Change, id: string, result: CalendarItem): void {
  if (result.etag) setEntries(s, s.entries.value.map((x) => (x.change.id === id && versioned(x.change) ? { ...x, etag: result.etag } : x)));
  const shown = withPending(result, forId(s, id));
  if (shown) items().upsert(shown);
  const series = result.kind === 'tasklist' ? result.seriesId : undefined;
  if (c.op === 'list.create' && series) items().noteSeries(result.id, series);
  if ((c.op === 'list.create' && series) || (c.op === 'list.update' && c.scope === 'following')) ports.resync?.();
}

/** An entry reached the server: it leaves the outbox and the server's version replaces the device copy. */
function sent(s: OutboxState, e: OutboxEntry, fresh: unknown): void {
  const c = e.change;
  const result = fresh as CalendarItem | undefined;
  setEntries(s, s.entries.value.filter((x) => x.key !== e.key));
  if (isCreate(c) && result) replaceId(s, c.id, result);
  const id = isCreate(c) && result ? result.id : c.id;
  if (c.op === 'list.delete' || c.op === 'event.delete') {
    items().hide(id);
    const series = c.op === 'list.delete' ? items().seriesOf(id) : undefined;
    if (series) dropSeries(series, id);
  } else if (result) showAnswer(s, c, id, result);
  void save(s);
  s.lastSent.value = { wall: Date.now(), app: useClockStore().nowMs() };
}

/** The device copy goes back to what the server has (with the entries still unsent on top); false when it could not be read. */
async function rollback(s: OutboxState, e: OutboxEntry, remaining: OutboxEntry[]): Promise<boolean> {
  const c = e.change;
  if (isCreate(c)) {
    items().remove(c.id);
    ports.device?.drop(c.id);
    return true;
  }
  try {
    const shown = withPending(await fetchCurrent(c), forId(s, c.id, remaining));
    if (shown) { items().unhide(shown); ports.device?.put(shown); }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) return false;
    items().hide(c.id);
    ports.device?.drop(c.id);
  }
  return true;
}

/** Reopens the form with what was typed: on the thing itself while it still exists, else as a new one. */
function editAgain(e: OutboxEntry): void {
  const c = e.change;
  const base = items().get(c.id);
  const ui = useUiStore();
  if (isEvent(c)) ui.openDialog('event', { ...(base ? { id: c.id } : { mode: 'create' }), draftEvent: e.shown });
  else ui.openDialog('tasklist', { ...(base ? { mode: 'edit', id: c.id } : { mode: 'create' }), draftList: applyEntry(base ?? localTaskList(c.id, { title: '', date: null }), e) });
}

/** The notice of a refused change: persistent, with a way to try again where the person typed something. */
function tell(d: OutboxEntry, err: ApiError): void {
  // a change the person must sort out first (409, e.g. a list shown twice) says what to do
  const text = err.status === 409 ? err.userMessage : t(err.status === 404 ? 'outbox.gone' : 'outbox.refused', { title: d.title });
  const action = editable(d.change) ? { action: { label: t('outbox.editAgain'), testid: 'outbox-edit-again', keep: true, run: () => editAgain(d) } } : {};
  useUiStore().notify(text, { duration: 0, testid: 'outbox-notice', ...action });
}

/** The server will not take an entry: it is undone on the device and the person is told. False when the device copy could not be restored yet. */
async function refuse(s: OutboxState, e: OutboxEntry, err: ApiError): Promise<boolean> {
  // what followed a refused create cannot be sent either (its thing does not exist)
  const dropped = isCreate(e.change) ? forId(s, e.change.id) : [e];
  const remaining = s.entries.value.filter((x) => !dropped.includes(x));
  if (!(await rollback(s, e, remaining))) return false;
  commit(s, remaining);
  for (const d of dropped) tell(d, err);
  return true;
}

/** A 412: the same change goes on the newest version (last arrival wins, only its fields). Resolves to the entry on that version. */
async function onNewestVersion(s: OutboxState, e: OutboxEntry): Promise<OutboxEntry> {
  const next = { ...e, etag: (await fetchCurrent(e.change)).etag };
  setEntries(s, s.entries.value.map((x) => (x.key === e.key ? next : x)));
  return next;
}

/** What an error of the server means for an entry; a 412 returns the entry to try again on the newest version. */
async function answer(s: OutboxState, e: OutboxEntry, err: unknown): Promise<Outcome | OutboxEntry> {
  if (!(err instanceof ApiError)) return 'retry';
  if (err.status === 404 && isDelete(e.change)) { sent(s, e, undefined); return 'sent'; }
  if (err.status === 412 && versioned(e.change)) {
    try { return await onNewestVersion(s, e); } catch (again) {
      return again instanceof ApiError && again.status === 404 && (await refuse(s, e, again)) ? 'refused' : 'retry';
    }
  }
  if (retriable(err)) return 'retry';
  return (await refuse(s, e, err)) ? 'refused' : 'retry';
}

/** One try of an entry, a 412 answered by reading the version again. */
async function attempt(s: OutboxState, first: OutboxEntry): Promise<Outcome> {
  let e = first;
  for (let n = 0; n < MAX_REFETCH; n++) {
    try {
      sent(s, e, await perform(e, (id) => items().seriesOf(id)));
      return 'sent';
    } catch (err) {
      const r = await answer(s, e, err);
      if (typeof r === 'string') return r;
      e = r;
    }
  }
  return 'retry';
}

function scheduleRetry(s: OutboxState): void {
  s.retry?.();
  s.backoff = Math.min(RETRY_MAX_MS, s.backoff ? s.backoff * 2 : RETRY_FIRST_MS);
  s.retry = appTimeout(() => { s.retry = null; void flush(s); }, s.backoff);
}

/** Sends the entries in order, one at a time, until one has to wait. `resync`: tell live sync afterwards (not from inside a sync). */
export async function flush(s: OutboxState, resync = true): Promise<void> {
  if (s.running || !s.entries.value.length) return;
  s.running = true;
  let any = false;
  try {
    const auth = useAuthStore();
    if (auth.status === 'unknown') await auth.check();
    const who = ports.device?.person();
    if (!who) return;
    dropForeign(s, who);
    while (s.entries.value.length) {
      const r = await attempt(s, s.entries.value[0]);
      if (r === 'retry') { scheduleRetry(s); return; }
      any ||= r === 'sent';
    }
    s.backoff = 0;
  } finally {
    s.running = false;
    if (any && resync) ports.resync?.();
  }
}
