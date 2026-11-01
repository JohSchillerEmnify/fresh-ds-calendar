import { useRoute, useRouter } from 'vue-router';
import { LABS_VIEWS, labPath } from '@/features/labs/labs';
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

  const go = (view: ViewKind, d: Date, stayInLab = true, replace = false) => {
    const q = { ...route.query };
    // On a Labs view, moving through time stays on that view; an explicit view switch leaves it.
    const lab = stayInLab ? (route.meta.lab as string | undefined) : undefined;
    const path = lab && view === 'day' ? labPath(lab, d) : routePath(view, d);
    // over an open overlay's entry, push already replaces it (bindRouterToOverlays) and drops the overlay marker
    const overlayOnTop = (history.state as { overlay?: number } | null)?.overlay != null;
    return replace && !overlayOnTop ? router.replace({ path, query: q }) : router.push({ path, query: q });
  };
  // Moving through the periods of a view adds no back step, so back leaves the view (feature navigation).
  const step = (dir: 1 | -1) => go(cal.view, shiftPeriod(cal.view, cal.anchor, dir), true, true);
  return {
    go,
    prev: () => step(-1),
    next: () => step(1),
    today: () => {
      cal.setFocus(clock.todayDate);
      return go(cal.view, clock.todayDate);
    },
    /** Switch to a calendar view, the Tasks view or a Labs view (any id of the Labs registry). */
    switchView: (v: ViewKind | 'tasks' | string) =>
      v === 'tasks' ? router.push({ path: '/tasks', query: { ...route.query } }) : LABS_VIEWS.some((l) => l.id === v) ? router.push({ path: labPath(v, cal.focusDate), query: { ...route.query } }) : go(v as ViewKind, cal.focusDate, false),
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
