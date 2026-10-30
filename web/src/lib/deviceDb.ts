/**
 * Where the device store lives on this device (ADR 0025): a tiny key-value store over one IndexedDB object store, no
 * dependency. It holds one person's data in a few records (see `stores/device.ts`); the person is remembered in
 * `localStorage` so the page knows whose store to read before it has asked the server. `setDeviceDb` swaps in another
 * implementation (unit tests use `memoryKv`, jsdom has no IndexedDB).
 */

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

const done = (r: IDBRequest | IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  if (r instanceof IDBTransaction) {
    r.oncomplete = () => resolve();
    r.onerror = r.onabort = () => reject(r.error);
  } else {
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  }
});

/** The IndexedDB store; the database is opened on first use (and created then). */
export function idbKv(dbName = DB_NAME): KvStore {
  let db: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { db = null; reject(req.error); };
  }));
  return {
    async get<T>(key: string) {
      const req = (await open()).transaction(STORE).objectStore(STORE).get(key);
      await done(req);
      return req.result as T | undefined;
    },
    async putMany(entries) {
      const tx = (await open()).transaction(STORE, 'readwrite');
      for (const [k, v] of Object.entries(entries)) tx.objectStore(STORE).put(v, k);
      await done(tx);
    },
    async clear() {
      const tx = (await open()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await done(tx);
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

const wipeListeners = new Set<() => void>();
/** Calls `fn` whenever the device is wiped (the store drops what it holds in memory and any save still waiting). */
export function onDeviceWipe(fn: () => void): void {
  wipeListeners.add(fn);
}

/** Removes what this device keeps (sign-out, the sign-in page) and stops this page from saving again. Never throws. */
export async function wipeDevice(): Promise<void> {
  const db = deviceDb();
  wiped = true;
  wipeListeners.forEach((fn) => fn());
  // the cached theme is device-wide, not per person: it goes with the data so the next person starts from the default
  try { for (const k of Object.keys(localStorage)) if (k === PERSON_KEY || k.startsWith('cal.theme')) localStorage.removeItem(k); } catch { /* storage blocked */ }
  try { await db?.clear(); } catch { /* IndexedDB broken: nothing readable is left either */ }
}
