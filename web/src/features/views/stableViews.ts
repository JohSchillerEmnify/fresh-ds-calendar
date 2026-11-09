import type { Component } from 'vue';
import type { MessageKey } from '@/i18n';
import { IconCalendarMonth as IconYear, IconCalendarViewMonth as IconMonth, IconCalendarViewWeek as IconWeek, IconCalendarViewDay as IconDay, IconChecklist as IconTasks, IconSchedule as IconClock } from '@/components/icons';
import { routePath, type ViewKind } from '@/lib/dates';
import { labPath } from '@/features/labs';

/** One main view of the view switcher; each has its own on/off switch in Settings › Views. */
export interface StableView {
  /** Route name, the part after `view-switch-` / `settings-view-switch-` in test ids, and the key in the `stableViews` pref. */
  id: string;
  labelKey: MessageKey;
  icon: Component;
}

/** The main views in switcher order; the Clock is the Labs registry's `clock-rings` route. */
export const STABLE_VIEWS: readonly StableView[] = [
  { id: 'year', labelKey: 'views.year', icon: IconYear },
  { id: 'month', labelKey: 'views.month', icon: IconMonth },
  { id: 'week', labelKey: 'views.week', icon: IconWeek },
  { id: 'day', labelKey: 'views.day', icon: IconDay },
  { id: 'tasks', labelKey: 'views.tasks', icon: IconTasks },
  { id: 'clock-rings', labelKey: 'views.clockRings', icon: IconClock },
];

const CALENDAR_VIEWS = ['year', 'month', 'week', 'day'];

/** Whether the person has the main view `id` on; without a stored choice it is on. */
export function isStableViewOn(id: string, chosen: Record<string, boolean>): boolean {
  return chosen[id] ?? true;
}

/** The main views the switcher offers; all of them when every one is off (a race between two devices must not empty the switcher). */
export function visibleStableViews(chosen: Record<string, boolean>): StableView[] {
  const on = STABLE_VIEWS.filter((v) => isStableViewOn(v.id, chosen));
  return on.length ? on : [...STABLE_VIEWS];
}

/** Id of the first main view that is on: where the app opens when the default view is off. */
export function firstStableView(chosen: Record<string, boolean>): string {
  return visibleStableViews(chosen)[0].id;
}

/** Route path of the main view `id` around the day `d`. */
export function stableViewPath(id: string, d: Date): string {
  if (id === 'tasks') return '/tasks';
  return CALENDAR_VIEWS.includes(id) ? routePath(id as ViewKind, d) : labPath(id, d);
}
