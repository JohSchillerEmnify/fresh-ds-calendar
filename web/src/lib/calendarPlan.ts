import type { CalendarPlan } from '@calendar/shared/prefs';
import { dayText, parseIsoDate, weekdayLabels } from '@/lib/dates';

/** What the plan UI shows about a calendar's plan (feature calendar-off-plan). Whether the calendar is off is not decided here: the server sets `hidden` at the plan's edges. All times are wall times `YYYY-MM-DDTHH:MM`. */

/** Whether the plan has anything that switches the calendar. */
export function hasPlan(plan: CalendarPlan | undefined): plan is CalendarPlan {
  return !!plan && (!!plan.windows?.length || !!plan.until);
}

/** Whether "Off for a while" still has the calendar off at `nowWall`. */
export function awayActive(plan: CalendarPlan | undefined, nowWall: string): boolean {
  return !!plan?.until && nowWall < `${plan.until}T00:00`;
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
