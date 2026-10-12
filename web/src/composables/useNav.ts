import { useRoute, useRouter } from 'vue-router';
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

  const go = (view: ViewKind, d: Date) => {
    const q = { ...route.query };
    return router.push({ path: routePath(view, d), query: q });
  };
  return {
    go,
    prev: () => go(cal.view, shiftPeriod(cal.view, cal.anchor, -1)),
    next: () => go(cal.view, shiftPeriod(cal.view, cal.anchor, 1)),
    today: () => {
      cal.setFocus(clock.todayDate);
      return go(cal.view, clock.todayDate);
    },
    switchView: (v: ViewKind) => go(v, cal.focusDate),
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
