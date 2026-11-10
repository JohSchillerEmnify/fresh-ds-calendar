/** The error a failed request throws, and what the client saw of it (feature device-log). */
import type { ErrorCode } from './types';
import { hasKey, t } from '@/i18n';

type ClientErrorCode = ErrorCode | 'NETWORK' | 'ABORTED' | 'HTTP';

/** What the client saw of a failed request, without body or ids (feature device-log). */
export interface RequestSeen {
  method: string;
  route: string;
  status: number;
  code?: string;
  contentType?: string;
  contentLength?: string;
  bodyEmpty?: boolean;
  type?: string;
  redirected?: boolean;
  errorName?: string;
  errorMessage?: string;
}


export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly details: { field?: string; issue?: string }[];
  /** Message key the server sent; translated by {@link userMessage} when the catalogue knows it. */
  readonly key?: string;
  /** The request ran into its time limit (a `TimeoutError`); only used for the diagnostics beacon. */
  readonly timeout: boolean;
  /** Seconds the server asked to wait (`Retry-After`), when it sent one. */
  readonly retryAfterSec?: number;
  /** What the client saw (device log); set by {@link ApiClient.request}. */
  seen?: RequestSeen;
  constructor(status: number, code: ClientErrorCode, message: string, details: { field?: string; issue?: string }[] = [], key?: string, timeout = false, retryAfterSec?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.key = key;
    this.timeout = timeout;
    this.retryAfterSec = retryAfterSec;
  }
  /** The server is holding Google back (503 `RATE_LIMITED`): data on screen is still the last known, a retry before `retryAfterSec` is pointless. */
  get isRateLimited(): boolean {
    return this.status === 503 && this.code === 'RATE_LIMITED';
  }
  /** Network failure, 502 or 503: Google (or the server) cannot be reached. Drives the sync error banner. */
  get isUnavailable(): boolean {
    return this.code === 'NETWORK' || this.status === 502 || this.status === 503;
  }
  /** Our own server did not answer (a failed request, or a proxy's body-less 502/503 during a restart): not a Google outage, which the server reports with its own error code. */
  get isServerUnreachable(): boolean {
    return this.code === 'NETWORK' || ((this.status === 502 || this.status === 503) && this.code === 'HTTP');
  }
  get isConflict(): boolean {
    return this.status === 412;
  }
  get isValidation(): boolean {
    return this.status === 400;
  }
  get isAbort(): boolean {
    return this.code === 'ABORTED';
  }
  /** The message the UI shows for a failed save, in the active language (API.md "Error format"). */
  get userMessage(): string {
    if (this.isServerUnreachable) return t('errors.saveServerUnreachable');
    if (this.isUnavailable) return t('errors.saveUnavailable');
    if (this.isConflict) return t('errors.conflict');
    // unknown keys fall back to the server's English text; `details` name the message's values (e.g. `{date}`)
    if (!this.key || !hasKey(this.key)) return this.message;
    const named = Object.fromEntries(this.details.filter((d) => d.field && d.issue).map((d) => [d.field!, d.issue!]));
    return t(this.key as Parameters<typeof t>[0], named);
  }
}
