/**
 * Where the last known state lives on this device (ADR 0023): a tiny key-value store over one IndexedDB object store,
 * no dependency. The key is the person (see `stores/lastKnown.ts`); at most one person's snapshot is kept.
 * `setLastKnownDb` swaps in another implementation (unit tests use `memoryKv`, jsdom has no IndexedDB).
 */

/** The three calls the last known state needs. */
export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  /** Stores `value` under `key` as the only entry (every other key is removed in the same transaction). */
  setOnly(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'calendar-last-known';
const STORE = 'snapshots';
/** localStorage key of the person whose snapshot is kept (a `cal.*` key: `clearPersonalStorage` removes it on sign-out). */
export const PERSON_KEY = 'cal.lastKnownPerson';

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
    async setOnly(key, value) {
      const tx = (await open()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.objectStore(STORE).put(value, key);
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
    async setOnly(key, value) { data.clear(); data.set(key, structuredClone(value)); },
    async clear() { data.clear(); },
  };
}

let kv: KvStore | null = null;
/** Set by `wipeLastKnown`: this page keeps nothing any more (a save still pending must not write it back). */
let wiped = false;
/** The store in use: IndexedDB when the browser has it, else `null` (nothing is kept). */
export function lastKnownDb(): KvStore | null {
  if (wiped) return null;
  if (!kv && typeof indexedDB !== 'undefined') kv = idbKv();
  return kv;
}
/** Replaces the store (tests); `null` goes back to the default. */
export function setLastKnownDb(next: KvStore | null): void {
  kv = next;
  wiped = false;
}

/** The person whose snapshot this device keeps, or `null`. */
export function lastKnownPerson(): string | null {
  try { return localStorage.getItem(PERSON_KEY); } catch { return null; }
}
export function setLastKnownPerson(person: string): void {
  try { localStorage.setItem(PERSON_KEY, person); } catch { /* storage blocked: the snapshot cannot be found offline */ }
}

/** Removes what this device keeps of the last known state (sign-out, the sign-in page) and stops this page from saving again. Never throws. */
export async function wipeLastKnown(): Promise<void> {
  const db = lastKnownDb();
  wiped = true;
  try { localStorage.removeItem(PERSON_KEY); } catch { /* storage blocked */ }
  try { await db?.clear(); } catch { /* IndexedDB blocked or broken: nothing readable is left either */ }
}
