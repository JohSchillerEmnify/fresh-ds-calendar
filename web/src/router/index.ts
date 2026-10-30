import { bindRouterToOverlays } from '@/lib/overlayHistory';
import type { Component } from 'vue';
import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router';
import { parseParam, routePath, toIsoDate, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { RETURN_KEY, useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { useSettingsStore } from '@/stores/settings';

const CAL_VIEWS: ViewKind[] = ['year', 'month', 'week', 'day'];

const lazy = {
  year: () => import('@/views/YearView.vue'),
  month: () => import('@/views/MonthView.vue'),
  week: () => import('@/views/WeekView.vue'),
  day: () => import('@/views/DayView.vue'),
};

/**
 * Starts downloading the calendar view the page is about to show, while the settings and the session check are still
 * on the wire (the route resolves only after them). `/` opens the default view, assumed to be the month.
 */
export function warmView(path: string): void {
  const name = path === '/' ? 'month' : path.split('/')[1];
  if (name in lazy) void lazy[name as ViewKind]();
}

function viewRoute(view: ViewKind): RouteRecordRaw {
  return {
    path: `/${view}/:param`,
    name: view,
    component: lazy[view],
    meta: { view },
    beforeEnter: (to) => {
      const raw = to.params.param as string;
      const d = parseParam(view, raw);
      const keep = { query: to.query, hash: to.hash, replace: true };
      if (!d) return { path: routePath('month', useClockStore().todayDate), ...keep };
      // Normalise (week → its Monday).
      const canonical = routePath(view, d);
      if (to.path !== canonical) return { path: canonical, ...keep };
      return true;
    },
  };
}

/** Experimental Labs views (always routable; the view switcher offers them only with Labs on). */
const labDated = (
  name: 'clock' | 'clock-rings' | 'strip' | 'zoom' | 'horizontal', component: () => Promise<unknown>, noSwipe = false, props?: Record<string, unknown>,
): RouteRecordRaw => ({
  path: `/${name}/:param`,
  name,
  component: component as () => Promise<Component>,
  props,
  meta: { lab: name, noSwipe },
  beforeEnter: (to) => (parseParam('day', to.params.param as string) ? true : { path: `/${name}/${toIsoDate(useClockStore().todayDate)}`, replace: true }),
});

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: (to) => {
      // back to the page the person wanted before being sent to /signin
      const back = takeReturn();
      if (back) return back;
      const view = useSettingsStore().settings.defaultView;
      return { path: routePath(view, useClockStore().todayDate), query: to.query };
    },
  },
  ...CAL_VIEWS.map(viewRoute),
  labDated('clock', () => import('@/features/labs/clock/ClockView.vue')),
  labDated('clock-rings', () => import('@/features/labs/clock/ClockView.vue'), false, { variant: 'rings' }),
  { path: '/timeline', name: 'timeline', component: () => import('@/features/labs/timeline/TimelineView.vue'), meta: { lab: 'timeline' } },
  { path: '/runway', name: 'runway', component: () => import('@/features/labs/runway/RunwayView.vue'), meta: { lab: 'runway', noSwipe: true } },
  labDated('strip', () => import('@/features/labs/strip/StripView.vue')),
  labDated('zoom', () => import('@/features/labs/zoom/ZoomMonthView.vue')),
  labDated('horizontal', () => import('@/features/labs/htime/HorizontalTimeView.vue'), true),
  { path: '/now', name: 'now', component: () => import('@/features/labs/nownext/NowNextView.vue'), meta: { lab: 'now', noSwipe: true } },
  { path: '/tasks', name: 'tasks', component: () => import('@/features/tasklists/TasksView.vue'), meta: { tasks: true } },
  { path: '/signin', name: 'signin', component: () => import('@/views/SignInView.vue'), meta: { public: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { settings: true } },
  { path: '/settings/reminders', name: 'reminders', component: () => import('@/views/RemindersView.vue'), meta: { settings: true } },
  { path: '/settings/templates', name: 'templates', component: () => import('@/views/TemplatesView.vue'), meta: { settings: true } },
  { path: '/settings/theme', name: 'theme', component: () => import('@/views/ThemeView.vue'), meta: { settings: true } },
  { path: '/lab', name: 'lab', component: () => import('@/features/motivation/MotionLab.vue'), meta: { settings: true } },
  { path: '/:pathMatch(.*)*', redirect: (to) => ({ path: routePath('month', useClockStore().todayDate), query: to.query }) },
];

/** Takes (and forgets) the remembered return; only a path of this app counts (no `//host` or `scheme:` URL). */
function takeReturn(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && /^\/(?!\/)/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
  const router = createRouter({ history, routes });
  // Everything but /signin needs a session when the server has sign-in on (the answer is fetched once).
  router.beforeEach(async (to) => {
    if (to.meta.public) return true;
    const auth = useAuthStore();
    const asked = auth.check();
    // with the device store on screen the answer is not waited for: a refused session still goes to /signin (auth.listen)
    if (!useDeviceStore().ready) await asked;
    if (auth.status !== 'out') return true;
    try { if (to.fullPath !== '/') sessionStorage.setItem(RETURN_KEY, to.fullPath); } catch { /* private mode: no deep link */ }
    return { path: '/signin', replace: true };
  });
  router.afterEach((to) => {
    const view = to.meta.view as ViewKind | undefined;
    // A dated Labs view loads the items of its day like the day view does.
    const d0 = to.meta.lab && to.params.param ? parseParam('day', to.params.param as string) : null;
    if (d0) useCalendarStore().setFromRoute('day', d0);
    if (!view) return;
    const d = parseParam(view, to.params.param as string);
    if (d) useCalendarStore().setFromRoute(view, d);
  });
  bindRouterToOverlays(router);
  return router;
}

export { toIsoDate };
