import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router';
import { parseParam, routePath, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

function viewRoute(view: ViewKind, component: () => Promise<unknown>): RouteRecordRaw {
  return {
    path: `/${view}/:date?`,
    name: view,
    component: component as RouteRecordRaw['component'],
    meta: { view },
    beforeEnter: (to) => {
      const d = parseParam(view, to.params.date as string | undefined);
      if (!d) return { path: routePath(view, new Date()), replace: true };
      return true;
    },
  } as RouteRecordRaw;
}

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: () => routePath('month', new Date()) },
  viewRoute('month', () => import('@/views/MonthView.vue')),
  viewRoute('week', () => import('@/views/WeekView.vue')),
  viewRoute('day', () => import('@/views/DayView.vue')),
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export function createAppRouter(history = createWebHistory()): Router {
  const router = createRouter({ history, routes });
  router.afterEach((to) => {
    const view = to.meta.view as ViewKind | undefined;
    if (!view) return;
    const d = parseParam(view, to.params.date as string | undefined);
    if (d) useCalendarStore().setFromRoute(view, d);
  });
  return router;
}
