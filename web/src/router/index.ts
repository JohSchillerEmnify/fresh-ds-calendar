import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router';
import { parseParam, routePath, toIsoDate, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { RETURN_KEY, useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useSettingsStore } from '@/stores/settings';

const CAL_VIEWS: ViewKind[] = ['year', 'month', 'week', 'day'];

const lazy = {
  year: () => import('@/views/YearView.vue'),
  month: () => import('@/views/MonthView.vue'),
  week: () => import('@/views/WeekView.vue'),
  day: () => import('@/views/DayView.vue'),
};

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
  { path: '/signin', name: 'signin', component: () => import('@/views/SignInView.vue'), meta: { public: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { settings: true } },
  { path: '/lab', name: 'lab', component: () => import('@/features/motivation/MotionLab.vue'), meta: { settings: true } },
  { path: '/:pathMatch(.*)*', redirect: (to) => ({ path: routePath('month', useClockStore().todayDate), query: to.query }) },
];

function takeReturn(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v;
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
    await auth.check();
    if (auth.status !== 'out') return true;
    try { if (to.fullPath !== '/') sessionStorage.setItem(RETURN_KEY, to.fullPath); } catch { /* private mode: no deep link */ }
    return { path: '/signin', replace: true };
  });
  router.afterEach((to) => {
    const view = to.meta.view as ViewKind | undefined;
    if (!view) return;
    const d = parseParam(view, to.params.param as string);
    if (d) useCalendarStore().setFromRoute(view, d);
  });
  return router;
}

export { toIsoDate };
