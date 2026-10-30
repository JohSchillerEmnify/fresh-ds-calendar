/**
 * Asks Google for changes made in Google Calendar itself while at least one app of a person is connected (ADR 0030) and
 * publishes a nudge when there are any. It keeps its own sync tokens per person, apart from every device's cursor.
 */
import type { ChangeKind } from './changeBus.js';
import type { CalendarService, ChangeState } from './calendar.js';

/** How often Google is asked while an app is open, unless configured otherwise. */
export const DEFAULT_GOOGLE_POLL_MS = 20_000;

export interface GooglePollerDeps {
  /** The person's calendar service. */
  calendarFor(sub: string): CalendarService;
  today(): string;
  intervalMs(): number;
  publish(subs: string[], kind: ChangeKind): void;
}

interface Watch { timer: ReturnType<typeof setTimeout> | null; state: ChangeState | null; busy: boolean; stopped: boolean }

export class GooglePoller {
  private readonly watches = new Map<string, Watch>();

  constructor(private readonly deps: GooglePollerDeps) {}

  /** Starts asking for this person (idempotent). */
  start(sub: string): void {
    if (this.watches.has(sub)) return;
    const w: Watch = { timer: null, state: null, busy: false, stopped: false };
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

  private arm(sub: string, w: Watch): void {
    if (w.stopped) return;
    w.timer = setTimeout(() => {
      void this.look(sub, w, true).finally(() => this.arm(sub, w));
    }, Math.max(this.deps.intervalMs(), 50));
    w.timer.unref?.();
  }

  private async look(sub: string, w: Watch, nudge: boolean): Promise<void> {
    if (w.busy || w.stopped) return;
    w.busy = true;
    // without a baseline everything looks new: take it, do not nudge
    const known = w.state !== null;
    try {
      const g = await this.deps.calendarFor(sub).changesSince(w.state, this.deps.today(), new Set());
      const e = g.events, t = g.taskLists;
      const events = e.replace.length || e.series.length || e.removed.length || e.upserts.length;
      const tasks = t.replace || t.series.length || t.removed.length || t.upserts.length;
      // a failed calendar keeps its old token, so the next look retries it
      w.state = g.state;
      if (nudge && known && !w.stopped) {
        if (events) this.deps.publish([sub], 'events');
        if (tasks) this.deps.publish([sub], 'taskLists');
      }
    } catch {
      // Google unavailable or rate limited: the next look tries again, the apps' own sync is the safety net
    } finally {
      w.busy = false;
    }
  }
}
