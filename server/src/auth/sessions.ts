import { randomBytes } from 'node:crypto';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';

export const SESSION_COOKIE = 'cal_session';
export const SESSION_TTL_MS = 90 * 86_400_000;
/** A session is pushed forward at most this often, to limit writes. */
export const EXTEND_EVERY_MS = 3_600_000;

export interface Session { sub: string; email: string; name?: string; expiresAt: number }

/** Server-side sessions in `DATA_DIR/sessions.json` (`id -> { sub, email, expiresAt }`), 90 days, extended on use. */
export class SessionStore {
  private sessions: Record<string, Session>;

  constructor(private readonly file: string | null, private readonly now: () => number) {
    this.sessions = file ? readJson<Record<string, Session>>(file) ?? {} : {};
  }

  create(p: { sub: string; email: string; name?: string }): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions[id] = { ...p, expiresAt: this.now() + SESSION_TTL_MS };
    this.save();
    return id;
  }

  /** The live session for an id, or null. `extended` is true when its expiry was pushed forward by this use. */
  get(id: string | undefined): { session: Session; extended: boolean } | null {
    const s = id ? this.sessions[id] : undefined;
    if (!id || !s) return null;
    const t = this.now();
    if (s.expiresAt <= t) {
      delete this.sessions[id];
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
    if (id && this.sessions[id]) {
      delete this.sessions[id];
      this.save();
    }
  }

  /** Ends every session of one person (TEST_MODE: the server "forgot" them). */
  deleteSub(sub: string): void {
    const ids = Object.keys(this.sessions).filter((id) => this.sessions[id]!.sub === sub);
    for (const id of ids) delete this.sessions[id];
    if (ids.length) this.save();
  }

  clear(): void {
    const had = Object.keys(this.sessions).length > 0;
    this.sessions = {};
    if (had) this.save();
  }

  private save(): void {
    if (this.file) writeJsonAtomic(this.file, this.sessions, 0o600);
  }
}
