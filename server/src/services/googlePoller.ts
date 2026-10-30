/** Asks Google for changes while a person has an app open (ADR 0030) and publishes a nudge when there are any; keeps its own sync tokens. */
import type { ChangeKind } from './changeBus.js';
import type { CalendarService, ChangeState } from './calendar.js';
import { logEvent } from '../lib/diag.js';
import { RateLimitedError } from '../providers/CalendarProvider.js';

/** The longest wait between two looks while Google keeps failing. */
const MAX_BACKOFF_MS = 5 * 60_000;

export interface GooglePollerDeps {
  /** The person's calendar service. */
  calendarFor(sub: string): CalendarService;
  today(): string;
  intervalMs(): number;
  publish(subs: string[], kind: ChangeKind): void;
}

interface Watch { timer: ReturnType<typeof setTimeout> | null; state: ChangeState | null; busy: boolean; stopped: boolean; failures: number; retryAfterMs: number }

export class GooglePoller {
  private readonly watches = new Map<string, Watch>();

  constructor(private readonly deps: GooglePollerDeps) {}

  /** Starts asking for this person (idempotent). */
  start(sub: string): void {
    if (this.watches.has(sub)) return;
    const w: Watch = { timer: null, state: null, busy: false, stopped: false, failures: 0, retryAfterMs: 0 };
    this.watches.set(sub, w);
    // the first look only takes the baseline tokens, so it is done at once and never nudges
    void this.look(sub, w, false).finally(() => this.arm(sub, w));
  }

  /** Stops asking for this person. */
  stop(sub: string): void {
    const w = this.watches.get(sub);
    if (!w) return;
    w.stopped = true;
    if (w.timer) clearTimeout(w.timer);
    this.watches.delete(sub);
  }

  /** The people being watched. */
  watching(): string[] {
    return [...this.watches.keys()];
  }

  /** The wait before the next look: the interval, doubled per failure in a row (at most 5 min), and never less than Google's `Retry-After`. */
  private waitMs(w: Watch): number {
    const interval = Math.max(this.deps.intervalMs(), 50);
    return Math.max(Math.min(interval * 2 ** w.failures, Math.max(MAX_BACKOFF_MS, interval)), w.retryAfterMs);
  }

  private arm(sub: string, w: Watch): void {
    if (w.stopped) return;
    w.timer = setTimeout(() => {
      void this.look(sub, w, true).finally(() => this.arm(sub, w));
    }, this.waitMs(w));
    w.timer.unref?.();
  }

  private async look(sub: string, w: Watch, nudge: boolean): Promise<void> {
    if (w.busy || w.stopped) return;
    w.busy = true;
    // without a baseline everything looks new: take it, do not nudge
    const known = w.state !== null;
    try {
      const g = await this.deps.calendarFor(sub).changesSince(w.state, this.deps.today(), new Set());
      w.state = g.state;
      this.succeeded(w);
      if (nudge && known && !w.stopped) this.nudgeFor(sub, g);
    } catch (e) {
      this.failed(w, e);
    } finally {
      w.busy = false;
    }
  }

  private nudgeFor(sub: string, g: { events: { replace: unknown[]; series: unknown[]; removed: unknown[]; upserts: unknown[] }; taskLists: { replace: boolean; series: unknown[]; removed: unknown[]; upserts: unknown[] } }): void {
    const e = g.events, t = g.taskLists;
    if (e.replace.length || e.series.length || e.removed.length || e.upserts.length) this.deps.publish([sub], 'events');
    if (t.replace || t.series.length || t.removed.length || t.upserts.length) this.deps.publish([sub], 'taskLists');
  }

  private succeeded(w: Watch): void {
    if (w.failures > 0) logEvent('live_google_poll', { ok: true });
    w.failures = 0;
    w.retryAfterMs = 0;
  }

  /** Google unavailable or rate limited: look again later and less often; the apps' own sync is the safety net. */
  private failed(w: Watch, e: unknown): void {
    if (w.failures === 0) logEvent('live_google_poll', { ok: false, cause: e instanceof Error ? e.constructor.name : 'error' });
    w.failures++;
    w.retryAfterMs = e instanceof RateLimitedError ? e.retryAfterSec * 1000 : 0;
  }
}
