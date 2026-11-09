/** Sets a calendar's `hidden` flag at its plan's edges (feature calendar-off-plan); readers only read `hidden`. */
import type { CalendarPlan } from '@calendar/shared/prefs';
import { listUserSubs } from '../auth/people.js';
import type { Clock } from '../lib/clock.js';
import { hasPlan, lastEdge, planOff, toMin } from '../lib/planEdges.js';
import { formatInZone } from '../lib/time.js';
import type { ChangeBus } from './changeBus.js';
import type { PrefsStore } from './prefsStore.js';

/** How often the loop looks for a plan edge (edges are whole minutes). */
const TICK_MS = 30_000;

/** What the scheduler needs from the server. */
export interface PlanSchedulerDeps {
  dataDir: string;
  clock: Clock;
  tz: string;
  prefs: PrefsStore;
  /** Where a saved plan is noticed (a `prefs` change) and where a switched calendar is announced. */
  changes: ChangeBus;
}

/** Applies each plan at its edges: off at a window start, on at its end, off for a while until 00:00 of its day. */
export class CalendarPlanScheduler {
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly d: PlanSchedulerDeps) {
    // a plan that was just saved applies at once, without waiting for the next tick
    d.changes.on((e) => { if (e.kind === 'prefs') e.subs.forEach((sub) => this.apply(sub)); });
  }

  /** Applies a person's plans for now, only where the last edge or the plan changed, so a tap holds until the next edge. */
  apply(sub: string): void {
    const plans = this.d.prefs.labsPrefs(sub).calendarPlans;
    const before = this.d.prefs.planApplied(sub);
    const applied: Record<string, { plan: string; edge: number | null }> = {};
    const hidden = new Set(this.d.prefs.hiddenCalendars(sub));
    const nowWall = formatInZone(this.d.clock.nowMs(), this.d.tz).slice(0, 16);
    let flipped = false;
    for (const [id, plan] of Object.entries(plans) as [string, CalendarPlan][]) {
      if (!hasPlan(plan)) continue;
      // `switchedAt` is a retired field and must not make a plan look changed
      const key = JSON.stringify({ windows: plan.windows, until: plan.until, since: plan.since });
      const edge = lastEdge(plan, toMin(nowWall));
      applied[id] = { plan: key, edge: Number.isFinite(edge) ? edge : null };
      if (before[id]?.plan === key && before[id].edge === applied[id]!.edge) continue;
      const off = planOff(plan, nowWall);
      if (hidden.has(id) !== off) {
        this.d.prefs.setHidden(sub, id, off);
        flipped = true;
      }
    }
    if (JSON.stringify(applied) !== JSON.stringify(before)) this.d.prefs.setPlanApplied(sub, applied);
    if (flipped) {
      this.d.changes.emit([sub], 'calendars');
      this.d.changes.emit([sub], 'prefs');
    }
  }

  /** Applies everyone's plans now (the loop's tick, and the test clock after it moves). */
  tick(): void {
    for (const sub of listUserSubs(this.d.dataDir)) this.apply(sub);
  }

  /** Applies the current state of every plan, then keeps applying edges on a timer. Called by the server, not by tests. */
  start(): void {
    this.tick();
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.interval.unref();
  }

  /** Stops the timer loop. */
  close(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }
}
