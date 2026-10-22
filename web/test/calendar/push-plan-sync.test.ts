import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { startTransitionWarnings, stopTransitionWarnings } from '@/features/calendar/transitionWarning';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import type { PushPlanEntry } from '@/features/calendar/reminderPlan';
import { config, freshPinia, mockFetch } from '../helpers';
import { ev, t } from './helpers';

// a browser subscribed to Web Push: the plan goes to the server through `sendPushPlan`
const sent = vi.hoisted(() => [] as PushPlanEntry[][]);
vi.mock('@/pwa/push', () => ({
  pushSupported: () => true,
  refreshPushState: () => Promise.resolve(),
  pushEndpoint: ref('https://push.example.test/unit'),
  sendPushPlan: (_endpoint: string, plan: PushPlanEntry[]) => { sent.push(plan); return Promise.resolve(true); },
}));

const D = '2026-10-12';
const trip = ev('trip', t('2026-10-13', '12:00'), t('2026-10-13', '13:30'), { title: 'Trip', reminders: { useDefault: false, minutes: [30] } });

describe('the Web Push plan (feature reminders)', () => {
  afterEach(() => { stopTransitionWarnings(); sent.length = 0; });

  it('is sent once the planned days are loaded, also when today has no appointments, and never from a partial load', async () => {
    freshPinia();
    const { calls } = mockFetch({
      'GET /api/config': () => config({ now: new Date(`${D}T10:00:00+02:00`).toISOString(), clockFrozen: true }),
      'GET /api/items': () => ({ items: [trip], syncedAt: 's2' }),
    });
    await useClockStore().load();
    const items = useItemsStore();
    startTransitionWarnings();
    await nextTick();
    // only today is loaded (e.g. the day view): its plan would wipe the server's pushes of the next days
    items.applyResponse(D, '2026-10-13', [], 's');
    await nextTick();
    expect(sent).toEqual([]);
    // so the whole window is fetched, and the plan goes out once it is in
    expect(calls.filter((c) => c.path === '/api/items').map((c) => [c.url.searchParams.get('from'), c.url.searchParams.get('to')])).toEqual([[D, '2026-10-20']]);
    await flushPromises();
    expect(sent.map((plan) => plan.map((p) => [p.title, p.body, p.kind]))).toEqual([[['Trip', '12:00 – 13:30', 'event']]]);
  });
});
