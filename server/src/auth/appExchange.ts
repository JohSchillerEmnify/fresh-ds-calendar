import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const CODE_TTL_MS = 60_000;
const MAX_CODES = 50;

/** What a one-time code stands for: a session already created by an app sign-in, where the app lands afterwards, and the app's challenge. */
export interface ExchangeEntry { sessionId: string; redirect: string; challenge: string }

/** Shape of a challenge (base64url of a SHA-256) and of a verifier (base64url of 32 random bytes, RFC 7636 allows up to 128). */
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** Whether the verifier belongs to the challenge: base64url(SHA-256(verifier)) equals it (RFC 7636 S256), compared in constant time. */
function verifierMatches(verifier: string | undefined, challenge: string): boolean {
  if (!verifier || !VERIFIER_RE.test(verifier)) return false;
  const a = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

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

  /**
   * Redeems a code: the entry the first time within 60 s, null for an unknown, used or expired code and for a missing or
   * wrong verifier. A wrong verifier burns the code too, so a code someone else caught cannot be guessed at.
   */
  consume(code: string | undefined, verifier: string | undefined): ExchangeEntry | null {
    const e = code ? this.codes.get(code) : undefined;
    if (!code || !e) return null;
    this.codes.delete(code);
    if (this.now() - e.at > CODE_TTL_MS || !verifierMatches(verifier, e.challenge)) return null;
    return { sessionId: e.sessionId, redirect: e.redirect, challenge: e.challenge };
  }

  /** Whether a code is still redeemable, without using it up (the fallback page shows its button only for a live code). */
  has(code: string | undefined): boolean {
    const e = code ? this.codes.get(code) : undefined;
    return !!e && this.now() - e.at <= CODE_TTL_MS;
  }

  clear(): void {
    this.codes.clear();
  }
}
