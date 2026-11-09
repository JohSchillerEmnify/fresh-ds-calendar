/** The rule of a calendar plan (feature calendar-off-plan): whether it has the calendar off at a wall time and when it last switched. Only the plan scheduler reads it; everything else reads the `hidden` flag the scheduler sets. All times are wall times `YYYY-MM-DDTHH:MM` in the calendar zone. */
import type { CalendarPlan, WeekPoint } from '@calendar/shared/prefs';

const DAY = 1440;
const WEEK = 7 * DAY;

/** Minutes since the Unix epoch of a wall time, so plain arithmetic ignores DST jumps. */
export function toMin(wall: string): number {
  return Date.UTC(+wall.slice(0, 4), +wall.slice(5, 7) - 1, +wall.slice(8, 10)) / 60000 + (+wall.slice(11, 13)) * 60 + (+wall.slice(14, 16));
}

/** The last time at or before `now` that the weekly point came round. The epoch's first day was a Thursday (day 4). */
function lastAt(p: WeekPoint, now: number): number {
  const day = Math.floor(now / DAY);
  const weekStart = (day - ((day + 4) % 7)) * DAY;
  const at = weekStart + p.day * DAY + (+p.time.slice(0, 2)) * 60 + (+p.time.slice(3, 5));
  return at > now ? at - WEEK : at;
}

/** The latest switch of the plan at or before `now` (minutes), or -Infinity. */
export function lastEdge(plan: CalendarPlan, now: number): number {
  const edges = (plan.windows ?? []).flatMap((w) => [lastAt(w.from, now), lastAt(w.to, now)]);
  if (plan.until) {
    const back = toMin(`${plan.until}T00:00`);
    const since = plan.since ? toMin(plan.since) : -Infinity;
    if (since <= now && since < back) edges.push(since);
    if (back <= now) edges.push(back);
  }
  return Math.max(-Infinity, ...edges);
}

/** Whether the plan alone has the calendar off at `nowWall`: inside a weekly window or off for a while. */
export function planOff(plan: CalendarPlan, nowWall: string): boolean {
  const now = toMin(nowWall);
  const inWindow = (plan.windows ?? []).some((w) => lastAt(w.from, now) > lastAt(w.to, now));
  const away = !!plan.until && now < toMin(`${plan.until}T00:00`) && (!plan.since || toMin(plan.since) <= now);
  return inWindow || away;
}

/** Whether the plan has anything that switches the calendar. */
export function hasPlan(plan: CalendarPlan | undefined): plan is CalendarPlan {
  return !!plan && (!!plan.windows?.length || !!plan.until);
}
