/**
 * Where the device store lives on this device (ADR 0025): a tiny key-value store over one IndexedDB object store, opened
 * with the `idb` library. It holds one person's data in a few records (see `stores/device.ts`); the person is remembered in
 * `localStorage` so the page knows whose store to read before it has asked the server. `setDeviceDb` swaps in another
 * implementation (unit tests use `memoryKv`, jsdom has no IndexedDB).
 */
import { openDB, type IDBPDatabase } from 'idb';

/** The calls the device store needs. */
export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  /** Writes every entry in one transaction. */
  putMany(entries: Record<string, unknown>): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'calendar-device';
const STORE = 'kv';
/** localStorage key of the person whose data the device keeps (a `cal.*` key: `clearPersonalStorage` removes it on sign-out). */
export const PERSON_KEY = 'cal.devicePerson';

/** The IndexedDB store (library `idb`); the database is opened on first use (and created then). */
export function idbKv(dbName = DB_NAME): KvStore {
  let db: Promise<IDBPDatabase> | null = null;
  const open = (): Promise<IDBPDatabase> => (db ??= openDB(dbName, 1, { upgrade: (d) => { d.createObjectStore(STORE); } }).catch((e) => { db = null; throw e; }));
  return {
    async get<T>(key: string) {
      return (await open()).get(STORE, key) as Promise<T | undefined>;
    },
    async putMany(entries) {
      const tx = (await open()).transaction(STORE, 'readwrite');
      await Promise.all([...Object.entries(entries).map(([k, v]) => tx.store.put(v, k)), tx.done]);
    },
    async clear() {
      await (await open()).clear(STORE);
    },
  };
}

/** An in-memory store with the same contract (unit tests). Values are cloned like IndexedDB does. */
export function memoryKv(): KvStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) { return data.has(key) ? structuredClone(data.get(key)) as T : undefined; },
    async putMany(entries) { for (const [k, v] of Object.entries(entries)) data.set(k, structuredClone(v)); },
    async clear() { data.clear(); },
  };
}

let kv: KvStore | null = null;
/** Set by `wipeDevice`: this page keeps nothing any more (a save still pending must not write it back). */
let wiped = false;
/** The store in use: IndexedDB when the browser has it, else `null` (nothing is kept). */
export function deviceDb(): KvStore | null {
  if (wiped) return null;
  if (!kv && typeof indexedDB !== 'undefined') kv = idbKv();
  return kv;
}
/** Replaces the store (tests); `null` goes back to the default. */
export function setDeviceDb(next: KvStore | null): void {
  kv = next;
  wiped = false;
}

/** The person whose data this device keeps, or `null`. */
export function devicePerson(): string | null {
  try { return localStorage.getItem(PERSON_KEY); } catch { return null; }
}
export function setDevicePerson(person: string): void {
  try { localStorage.setItem(PERSON_KEY, person); } catch { /* storage blocked: the data cannot be found offline */ }
}

const wipeListeners = new Set<(keepOutbox: boolean) => void>();
/** Calls `fn` whenever the device is wiped (the store drops what it holds in memory and any save still waiting). */
export function onDeviceWipe(fn: (keepOutbox: boolean) => void): void {
  wipeListeners.add(fn);
}

/** The record of unsent changes (stores/outbox.ts). */
export const OUTBOX_KEY = 'outbox';

/** Removes what this device keeps and stops this page saving again; `keepOutbox` (sign-in page): the same person may send them later. */
export async function wipeDevice(keepOutbox = false): Promise<void> {
  const db = deviceDb();
  wiped = true;
  wipeListeners.forEach((fn) => fn(keepOutbox));
  // the cached theme is device-wide, not per person: it goes with the data so the next person starts from the default
  try { for (const k of Object.keys(localStorage)) if (k === PERSON_KEY || k.startsWith('cal.theme')) localStorage.removeItem(k); } catch { /* storage blocked */ }
  try {
    const kept = keepOutbox ? await db?.get(OUTBOX_KEY) : undefined;
    await db?.clear();
    if (kept !== undefined) await db?.putMany({ [OUTBOX_KEY]: kept });
  } catch { /* IndexedDB broken: nothing readable is left either */ }
}
