import { randomBytes } from 'node:crypto';

const CODE_TTL_MS = 60_000;
const MAX_CODES = 50;

/** What a one-time code stands for: a session already created by an app sign-in, and where the app lands afterwards. */
export interface ExchangeEntry { sessionId: string; redirect: string }

/**
 * Single-use, 60 s exchange codes of the Android app sign-in. The OAuth round trip runs in the system browser, which
 * must not keep the session; the app trades the code (handed over by deep link) for the session cookie inside its own
 * WebView. In memory only: a restart in the 60 s window just means signing in again.
 */
export class ExchangeStore {
  private codes = new Map<string, ExchangeEntry & { at: number }>();

  constructor(private readonly now: () => number) {}

  /** Mints a 128-bit random code for the session. */
  create(entry: ExchangeEntry): string {
    const code = randomBytes(16).toString('base64url');
    const t = this.now();
    for (const [c, e] of this.codes) if (t - e.at > CODE_TTL_MS) this.codes.delete(c);
    if (this.codes.size >= MAX_CODES) this.codes.delete(this.codes.keys().next().value!);
    this.codes.set(code, { ...entry, at: t });
    return code;
  }

  /** Redeems a code: the entry the first time within 60 s, null for an unknown, used or expired code. */
  consume(code: string | undefined): ExchangeEntry | null {
    const e = code ? this.codes.get(code) : undefined;
    if (!code || !e) return null;
    this.codes.delete(code);
    return this.now() - e.at <= CODE_TTL_MS ? { sessionId: e.sessionId, redirect: e.redirect } : null;
  }

  clear(): void {
    this.codes.clear();
  }
}
