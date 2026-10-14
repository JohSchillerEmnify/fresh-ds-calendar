import { useRoute, useRouter } from 'vue-router';
import { labPath } from '@/features/labs/labs';
import { routePath, shiftPeriod, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useUiStore } from '@/stores/ui';

/** Calendar navigation. All moves keep the filter query (`categories`, `tags`). */
export function useNav() {
  const router = useRouter();
  const route = useRoute();
  const cal = useCalendarStore();
  const clock = useClockStore();
  const ui = useUiStore();

  const go = (view: ViewKind, d: Date, stayInLab = true) => {
    const q = { ...route.query };
    // On a Labs view, moving through time stays on that view; an explicit view switch leaves it.
    const lab = stayInLab ? (route.meta.lab as string | undefined) : undefined;
    const path = lab && view === 'day' ? labPath(lab, d) : routePath(view, d);
    return router.push({ path, query: q });
  };
  return {
    go,
    prev: () => go(cal.view, shiftPeriod(cal.view, cal.anchor, -1)),
    next: () => go(cal.view, shiftPeriod(cal.view, cal.anchor, 1)),
    today: () => {
      cal.setFocus(clock.todayDate);
      return go(cal.view, clock.todayDate);
    },
    switchView: (v: ViewKind | 'tasks' | 'clock' | 'timeline' | 'strip' | 'zoom' | 'horizontal') =>
      v === 'tasks' ? router.push({ path: '/tasks', query: { ...route.query } }) : v === 'clock' || v === 'timeline' || v === 'strip' || v === 'zoom' || v === 'horizontal' ? router.push({ path: labPath(v, cal.focusDate), query: { ...route.query } }) : go(v, cal.focusDate, false),
    /** Pick a date (month picker): focus it and jump the current view (the year view opens that month). */
    pickDay: (d: Date) => {
      cal.setFocus(d);
      ui.pickerOpen = false;
      return go(cal.view === 'year' ? 'month' : cal.view, d);
    },
    openDay: (d: Date) => {
      cal.setFocus(d);
      return go('day', d);
    },
  };
}
