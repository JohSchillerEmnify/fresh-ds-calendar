import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router';
import { parseParam, routePath, toIsoDate, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
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
      const view = useSettingsStore().settings.defaultView;
      return { path: routePath(view, useClockStore().todayDate), query: to.query };
    },
  },
  ...CAL_VIEWS.map(viewRoute),
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { settings: true } },
  { path: '/lab', name: 'lab', component: () => import('@/features/motivation/MotionLab.vue'), meta: { settings: true } },
  { path: '/:pathMatch(.*)*', redirect: (to) => ({ path: routePath('month', useClockStore().todayDate), query: to.query }) },
];

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
  const router = createRouter({ history, routes });
  router.afterEach((to) => {
    const view = to.meta.view as ViewKind | undefined;
    if (!view) return;
    const d = parseParam(view, to.params.param as string);
    if (d) useCalendarStore().setFromRoute(view, d);
  });
  return router;
}

export { toIsoDate };
