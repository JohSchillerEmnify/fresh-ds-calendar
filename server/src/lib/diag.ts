/**
 * Diagnostics log (ADR 0009): one structured JSON line per event on stdout, so `docker compose logs`
 * shows why Google or the server was unreachable. Only whitelisted, non-personal fields ever reach a line: no tokens,
 * no e-mail addresses, no raw `sub`, no event content or titles.
 */
import { createHash } from 'node:crypto';

/** Where lines go. Tests replace it with {@link setDiagSink}; under vitest the default drops them to keep output clean. */
let sink: (line: string) => void = (line) => {
  if (!process.env.VITEST) process.stdout.write(`${line}\n`);
};

/** Replaces the line sink (tests); returns a function that restores the default. */
export function setDiagSink(fn: (line: string) => void): () => void {
  const prev = sink;
  sink = fn;
  return () => { sink = prev; };
}

/** Writes one `{ ts, event, ...fields }` JSON line; fields that are undefined are left out. */
export function logEvent(event: string, fields: Record<string, string | number | boolean | undefined>): void {
  sink(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

/** A short, stable pseudonym of a person's Google `sub` (8 hex characters); lets lines be grouped without identifying anyone. */
export function subHash(sub: string | null | undefined): string | undefined {
  return sub ? createHash('sha256').update(`cal-diag:${sub}`).digest('hex').slice(0, 8) : undefined;
}

/** A short, stable pseudonym of a calendar id (8 hex characters): the id may be an e-mail address, so only its hash is logged. */
export function calHash(calendarId: string | undefined): string | undefined {
  return calendarId ? createHash('sha256').update(`cal-diag-cal:${calendarId}`).digest('hex').slice(0, 8) : undefined;
}

/** What is known about one failed Google call; every value is a status number or a short code, never message text. */
export interface GoogleErrorInfo {
  status?: number;
  /** Google's error reason (`rateLimitExceeded`, `backendError`, `invalid_grant` ...). */
  reason?: string;
  /** Network error code (`ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND` ...). */
  code?: string;
  /** Retry attempt the client library had reached, when it retries at all. */
  retry?: number;
  /** The request field Google objected to (`errors[0].location`, e.g. `backgroundColor`). */
  field?: string;
  /** Google's own error text, only when it holds no address or id-like token (at most 120 characters). */
  message?: string;
}

const CODE = /^[A-Za-z0-9_.:-]{1,64}$/;
const safe = (v: unknown): string | undefined => (typeof v === 'string' && CODE.test(v) ? v : undefined);
/** Plain words only: no `@`, no long tokens, so no address or calendar id can reach the log. */
const plainText = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length <= 120 && /^[\w .,:;'()\-]*$/.test(v) && !/[A-Za-z0-9_-]{25,}/.test(v) ? v : undefined;

/** Pulls the status, Google reason, network code and retry attempt out of a googleapis/gaxios error. */
export function describeGoogleError(e: unknown): GoogleErrorInfo {
  const err = e as {
    code?: unknown; status?: unknown; name?: unknown; cause?: { code?: unknown; cause?: { code?: unknown } };
    response?: { status?: unknown; data?: { error?: unknown } };
    config?: { retryConfig?: { currentRetryAttempt?: unknown } };
  } | null;
  const out: GoogleErrorInfo = {};
  if (!err || typeof err !== 'object') return out;
  const status = Number(err.response?.status ?? err.status ?? (typeof err.code === 'number' ? err.code : NaN));
  if (Number.isInteger(status) && status >= 100 && status <= 599) out.status = status;
  const body = err.response?.data?.error;
  if (typeof body === 'string') out.reason = safe(body);
  else if (body && typeof body === 'object') {
    const b = body as { errors?: { reason?: unknown; location?: unknown; message?: unknown }[]; details?: { reason?: unknown }[]; status?: unknown; message?: unknown };
    out.reason = safe(b.errors?.[0]?.reason) ?? safe(b.details?.[0]?.reason) ?? safe(b.status);
    out.field = safe(b.errors?.[0]?.location);
    out.message = plainText(b.errors?.[0]?.message) ?? plainText(b.message);
  }
  if (out.status === undefined) {
    out.code = safe(err.code) ?? safe(err.cause?.code) ?? safe(err.cause?.cause?.code);
    if (!out.code && (err.name === 'TimeoutError' || err.name === 'AbortError')) out.code = 'TIMEOUT';
  }
  const retry = err.config?.retryConfig?.currentRetryAttempt;
  if (typeof retry === 'number' && Number.isInteger(retry) && retry >= 0) out.retry = retry;
  return out;
}

/** One short cause string for the `api_unavailable` line: `429:rateLimitExceeded`, `503`, `ETIMEDOUT`. */
export function causeOf(i: GoogleErrorInfo): string | undefined {
  if (i.status !== undefined) return i.reason ? `${i.status}:${i.reason}` : String(i.status);
  return i.code ?? i.reason;
}

const causes = new WeakMap<object, string>();

/** Remembers why an error was mapped to a provider error, for the `api_unavailable` line. */
export function noteCause(target: object, cause: string | undefined): void {
  if (cause) causes.set(target, cause);
}

/** The cause noted for an error (or any other key), if any. */
export function causeFor(target: object): string | undefined {
  return causes.get(target);
}
