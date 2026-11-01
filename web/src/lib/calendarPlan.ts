import type { CalendarPlan, WeekPoint } from '@calendar/shared/prefs';
import { dayText, parseIsoDate, weekdayLabels } from '@/lib/dates';

/** When a calendar is off by its plan (feature calendar-off-plan). All times are wall times `YYYY-MM-DDTHH:MM` in the calendar zone. */

const DAY = 1440;
const WEEK = 7 * DAY;

/** Minutes since the Unix epoch of a wall time, so plain arithmetic ignores DST jumps. */
function toMin(wall: string): number {
  return Date.UTC(+wall.slice(0, 4), +wall.slice(5, 7) - 1, +wall.slice(8, 10)) / 60000 + (+wall.slice(11, 13)) * 60 + (+wall.slice(14, 16));
}

/** The last time at or before `now` that the weekly point came round. The epoch's first day was a Thursday (day 4). */
function lastAt(p: WeekPoint, now: number): number {
  const day = Math.floor(now / DAY);
  const weekStart = (day - ((day + 4) % 7)) * DAY;
  const at = weekStart + p.day * DAY + (+p.time.slice(0, 2)) * 60 + (+p.time.slice(3, 5));
  return at > now ? at - WEEK : at;
}

/** Each switch of the plan at or before `now` (`at`) and whether it switched off. */
function pastEdges(plan: CalendarPlan, now: number): { at: number; off: boolean }[] {
  const edges = (plan.windows ?? []).flatMap((w) => [{ at: lastAt(w.from, now), off: true }, { at: lastAt(w.to, now), off: false }]);
  if (plan.until) {
    const back = toMin(`${plan.until}T00:00`);
    const since = plan.since ? toMin(plan.since) : -Infinity;
    if (since <= now && since < back) edges.push({ at: since, off: true });
    if (back <= now) edges.push({ at: back, off: false });
  }
  return edges;
}

/** The latest switch of the plan at or before `now`, or -Infinity. */
function lastEdge(plan: CalendarPlan, now: number): number {
  return Math.max(-Infinity, ...pastEdges(plan, now).map((e) => e.at));
}

/** Whether the plan alone has the calendar off at `now`: inside a weekly window or off for a while. */
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

/** Whether "Off for a while" still has the calendar off at `nowWall`. */
export function awayActive(plan: CalendarPlan | undefined, nowWall: string): boolean {
  return !!plan?.until && toMin(nowWall) < toMin(`${plan.until}T00:00`);
}

/** The calendar's state: the manual switch, unless the plan has switched since the last tap. */
export function planEffectiveHidden(manualHidden: boolean, plan: CalendarPlan | undefined, nowWall: string): boolean {
  if (!hasPlan(plan)) return manualHidden;
  const now = toMin(nowWall);
  if (plan.switchedAt && toMin(plan.switchedAt) >= lastEdge(plan, now)) return manualHidden;
  return planOff(plan, nowWall);
}

/** The wall time of the app clock's date and minutes since midnight. */
export function wallNow(date: string, minutes: number): string {
  return `${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "Fri 6" for the day an active "Off for a while" ends, or '' when none is active. */
export function backDay(plan: CalendarPlan | undefined, nowWall: string): string {
  return awayActive(plan, nowWall) ? dayText(parseIsoDate(plan!.until)!) : '';
}

/** The weekly window as "Fri 17:00", "Sun 16:00" in the active language, or null. */
export function windowEnds(plan: CalendarPlan | undefined): { from: string; to: string } | null {
  const w = plan?.windows?.[0];
  if (!w) return null;
  // weekdayLabels() starts on Monday, the plan's days on Sunday
  const day = (d: number) => weekdayLabels()[(d + 6) % 7];
  return { from: `${day(w.from.day)} ${w.from.time}`, to: `${day(w.to.day)} ${w.to.time}` };
}
