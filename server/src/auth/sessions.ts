import { randomBytes } from 'node:crypto';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';

export const SESSION_COOKIE = 'cal_session';
export const SESSION_TTL_MS = 90 * 86_400_000;
/** A session is pushed forward at most this often, to limit writes. */
export const EXTEND_EVERY_MS = 3_600_000;

export interface Session { sub: string; email: string; name?: string; expiresAt: number }

/** Server-side sessions in `DATA_DIR/sessions.json` (`id -> { sub, email, expiresAt }`), 90 days, extended on use. */
export class SessionStore {
  /** A Map, so a cookie value like `constructor` is never an inherited property of a plain object. */
  private sessions: Map<string, Session>;

  constructor(private readonly file: string | null, private readonly now: () => number) {
    this.sessions = new Map(Object.entries(file ? readJson<Record<string, Session>>(file) ?? {} : {}));
  }

  create(p: { sub: string; email: string; name?: string }): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(id, { ...p, expiresAt: this.now() + SESSION_TTL_MS });
    this.save();
    return id;
  }

  /** The live session for an id, or null. `extended` is true when its expiry was pushed forward by this use. */
  get(id: string | undefined): { session: Session; extended: boolean } | null {
    const s = id ? this.sessions.get(id) : undefined;
    if (!id || !s) return null;
    const t = this.now();
    if (s.expiresAt <= t) {
      this.sessions.delete(id);
      this.save();
      return null;
    }
    const extended = t + SESSION_TTL_MS - s.expiresAt >= EXTEND_EVERY_MS;
    if (extended) {
      s.expiresAt = t + SESSION_TTL_MS;
      this.save();
    }
    return { session: s, extended };
  }

  delete(id: string | undefined): void {
    if (id && this.sessions.delete(id)) {
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
