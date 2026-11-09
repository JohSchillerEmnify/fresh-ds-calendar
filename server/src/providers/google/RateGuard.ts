/**
 * Per-person guard around Google Calendar calls (ADR 0007): a short-lived
 * result cache with single-flight, and a cooldown with exponential backoff once Google says the person is over the limit.
 */
import { RateLimitedError } from '../CalendarProvider.js';
import { logEvent } from '../../lib/diag.js';

export interface GuardOptions {
  now?: () => number;
  /** How long a cached result counts as fresh. */
  ttlMs?: number;
  /** How long a result may still be served as stale data while rate limited. */
  staleMaxMs?: number;
  /** First cooldown; doubles with every consecutive rate-limit answer. */
  baseMs?: number;
  capMs?: number;
  maxEntries?: number;
  /** Short hash of the person, for the `rate_limited` log line. */
  subHash?: string;
}

interface Entry { value: unknown; at: number; stored: number }

/** Google's 403 reasons (and 429) that mean "too many requests", never a permission problem. */
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);

/** Whether a described Google failure is a rate-limit answer. */
export function isRateLimit(status: number | undefined, reason: string | undefined): boolean {
  return status === 429 || (status === 403 && reason !== undefined && RATE_REASONS.has(reason));
}

/** The `Retry-After` header of a gaxios error in seconds (numeric form only), if any. */
export function retryAfterSec(e: unknown): number | undefined {
  const h = (e as { response?: { headers?: unknown } } | null)?.response?.headers as { get?: (k: string) => string | null } & Record<string, unknown> | undefined;
  if (!h) return undefined;
  const raw = typeof h.get === 'function' ? h.get('retry-after') : h['retry-after'];
  const n = Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

export class RateGuard {
  private readonly now: () => number;
  private readonly ttl: number;
  private readonly staleMax: number;
  private readonly base: number;
  private readonly cap: number;
  private readonly max: number;
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, { p: Promise<unknown>; gen: number }>();
  /** Bumped by every write: a read that started before it must not be cached as fresh. */
  private gen = 0;
  private until = 0;
  private step = 0;
  private active = false;

  constructor(private readonly o: GuardOptions = {}) {
    this.now = o.now ?? Date.now;
    this.ttl = o.ttlMs ?? 25_000;
    this.staleMax = o.staleMaxMs ?? 30 * 60_000;
    this.base = o.baseMs ?? 5_000;
    this.cap = o.capMs ?? 120_000;
    this.max = o.maxEntries ?? 300;
  }

  /** Milliseconds of cooldown left (0 when none). */
  cooldownMs(): number {
    return Math.max(0, this.until - this.now());
  }

  /** Throws {@link RateLimitedError} while cooling down, so no Google call is made. */
  assertOpen(): void {
    const left = this.cooldownMs();
    if (left > 0) throw new RateLimitedError(Math.max(1, Math.ceil(left / 1000)));
  }

  /** A Google call succeeded: ends a cooldown that has run out (one `rate_limited` end line) and resets the backoff. */
  noteSuccess(): void {
    if (this.active && this.cooldownMs() === 0) {
      this.active = false;
      logEvent('rate_limited', { state: 'end', subHash: this.o.subHash });
    }
    if (this.cooldownMs() === 0) this.step = 0;
  }

  /** Google answered "rate limited": starts (or, for a failed probe, lengthens) the cooldown and returns the error to throw. */
  noteRateLimited(op: string, retryAfter?: number): RateLimitedError {
    // siblings of the call that started the cooldown fail at the same moment: they neither log nor escalate
    if (this.cooldownMs() === 0) {
      const ms = retryAfter !== undefined ? Math.min(retryAfter * 1000, 600_000) : Math.min(this.cap, this.base * 2 ** this.step);
      this.step = Math.min(this.step + 1, 16);
      this.until = this.now() + ms;
      this.active = true;
      logEvent('rate_limited', { state: 'start', subHash: this.o.subHash, op, cooldownSec: Math.ceil(ms / 1000), step: this.step, retryAfter });
    }
    return new RateLimitedError(Math.max(1, Math.ceil(this.cooldownMs() / 1000)));
  }

  /** Marks every cached result as no longer fresh (a write happened); they stay usable as stale data. */
  invalidate(): void {
    this.gen++;
    for (const e of this.entries.values()) e.at = 0;
  }

  /**
   * Fresh cache hit, else one shared load per key. When the load is refused or rate limited, the last known value
   * (up to `staleMaxMs` old) is returned instead of the error.
   */
  async cached<T>(key: string, load: () => Promise<T>, copy: (v: T) => T = structuredClone): Promise<T> {
    const e = this.entries.get(key);
    if (e && this.now() - e.at < this.ttl) return copy(e.value as T);
    // a read that started before the last write is not shared: it may miss what was just written
    const running = this.inflight.get(key);
    let p = running && running.gen === this.gen ? (running.p as Promise<T>) : undefined;
    if (!p) {
      const gen = this.gen;
      const load$: Promise<T> = load().then((v) => {
        if (gen === this.gen || !this.entries.has(key)) {
          this.entries.delete(key);
          this.entries.set(key, { value: v, at: gen === this.gen ? this.now() : 0, stored: this.now() });
          while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
        }
        return v;
      }).finally(() => { if (this.inflight.get(key)?.p === load$) this.inflight.delete(key); });
      p = load$;
      this.inflight.set(key, { p, gen });
    }
    try {
      return copy(await p);
    } catch (err) {
      const old = this.entries.get(key);
      if (err instanceof RateLimitedError && old && this.now() - old.stored < this.staleMax) return copy(old.value as T);
      throw err;
    }
  }
}
