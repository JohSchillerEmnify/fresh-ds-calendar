/** A calendar's plan in one line (feature calendar-off-plan): "Off Fri 17:00 – Sun 16:00 · Back Tue 10", or "Always on". */
import { t } from '@/i18n';
import { backDay, windowEnds } from '@/lib/calendarPlan';
import { useCalendarsStore } from '@/stores/calendars';

/** The plan of calendar `id` as the settings show it. */
export function planSummary(id: string): string {
  const cals = useCalendarsStore();
  const plan = cals.planOf(id);
  const w = windowEnds(plan);
  const back = backDay(plan, cals.nowWall);
  const parts = [w ? t('calendar.plan.window', w) : '', back ? t('calendar.plan.back', { day: back }) : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('calendar.plan.alwaysOn');
}
