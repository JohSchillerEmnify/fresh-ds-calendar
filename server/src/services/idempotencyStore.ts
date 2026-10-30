/** Answers of writes that carried an `Idempotency-Key`, kept per person for 24 hours and across restarts (ADR 0031). */
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

const IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000;

export interface StoredAnswer { signature: string; at: number; status: number; body: string; type: string | null }
type Doc = Record<string, StoredAnswer>;

export class IdempotencyStore {
  private readonly files: PersonJsonStore<Doc>;
  private readonly cache = new Map<string, Doc>();

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<Doc>(dataDir, 'idempotency.json', (r) => (isRecord(r) ? (r as Doc) : null), () => ({}));
  }

  private doc(sub: string): Doc {
    let d = this.cache.get(sub);
    if (!d) this.cache.set(sub, (d = this.files.read(sub)));
    return d;
  }

  /** The stored answer of a key, or undefined (also when it is older than 24 hours). */
  get(sub: string, key: string, now: number): StoredAnswer | undefined {
    const a = this.doc(sub)[key];
    return a && now - a.at <= IDEMPOTENCY_TTL_MS ? a : undefined;
  }

  /** Keeps an answer and forgets the expired ones of that person. */
  put(sub: string, key: string, answer: StoredAnswer, now: number): void {
    const d = this.doc(sub);
    for (const [k, a] of Object.entries(d)) if (now - a.at > IDEMPOTENCY_TTL_MS) delete d[k];
    d[key] = answer;
    this.files.write(sub, d);
  }

  /** Forgets everyone's answers (test reset). */
  reset(): void {
    this.cache.clear();
    this.files.reset();
  }
}
