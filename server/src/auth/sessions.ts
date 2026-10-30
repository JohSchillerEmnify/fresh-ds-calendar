import { createHash, randomBytes } from 'node:crypto';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';

export const SESSION_COOKIE = 'cal_session';
export const SESSION_TTL_MS = 90 * 86_400_000;
/** A session is pushed forward at most this often, to limit writes. */
export const EXTEND_EVERY_MS = 3_600_000;

/** A session is never extended past this age, however often it is used. */
export const SESSION_ABSOLUTE_MAX_MS = 180 * 86_400_000;

export interface Session { sub: string; email: string; name?: string; expiresAt: number; createdAt?: number }

/** What is stored and looked up: the SHA-256 of the raw id, so a leaked file holds no usable cookie. */
const hashId = (id: string): string => createHash('sha256').update(id).digest('hex');
const isHash = (k: string): boolean => /^[0-9a-f]{64}$/.test(k);

/** Server-side sessions in `DATA_DIR/sessions.json` (`sha256(id) -> { sub, email, expiresAt }`), 90 days, extended on use, 180 days at most. */
export class SessionStore {
  /** A Map, so a cookie value like `constructor` is never an inherited property of a plain object. */
  private sessions: Map<string, Session>;

  constructor(private readonly file: string | null, private readonly now: () => number) {
    this.sessions = new Map();
    let migrated = false;
    for (const [k, v] of Object.entries(file ? readJson<Record<string, Session>>(file) ?? {} : {})) {
      // a raw id from before hashing is hashed in place, so nobody is signed out
      if (!isHash(k)) migrated = true;
      this.sessions.set(isHash(k) ? k : hashId(k), { ...v, createdAt: v.createdAt ?? now() });
    }
    if (migrated) this.save();
  }

  create(p: { sub: string; email: string; name?: string }): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(hashId(id), { ...p, createdAt: this.now(), expiresAt: this.now() + SESSION_TTL_MS });
    this.save();
    return id;
  }

  /** The live session for an id, or null. `extended` is true when its expiry was pushed forward by this use. */
  get(id: string | undefined): { session: Session; extended: boolean } | null {
    const key = id ? hashId(id) : '';
    const s = id ? this.sessions.get(key) : undefined;
    if (!id || !s) return null;
    const t = this.now();
    const end = Math.min(s.expiresAt, (s.createdAt ?? t) + SESSION_ABSOLUTE_MAX_MS);
    if (end <= t) {
      this.sessions.delete(key);
      this.save();
      return null;
    }
    const next = Math.min(t + SESSION_TTL_MS, (s.createdAt ?? t) + SESSION_ABSOLUTE_MAX_MS);
    const extended = next - s.expiresAt >= EXTEND_EVERY_MS;
    if (extended) {
      s.expiresAt = next;
      this.save();
    }
    return { session: s, extended };
  }

  delete(id: string | undefined): void {
    if (id && this.sessions.delete(hashId(id))) {
      this.save();
    }
  }

  /** Ends every session of one person (TEST_MODE: the server "forgot" them). */
  deleteSub(sub: string): void {
    const ids = [...this.sessions].filter(([, s]) => s.sub === sub).map(([id]) => id);
    for (const id of ids) this.sessions.delete(id);
    if (ids.length) this.save();
  }

  clear(): void {
    const had = this.sessions.size > 0;
    this.sessions = new Map();
    if (had) this.save();
  }

  private save(): void {
    if (this.file) writeJsonAtomic(this.file, Object.fromEntries(this.sessions), 0o600);
  }
}
