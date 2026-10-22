import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
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

describe('the Web Push plan (feature reminders)', () => {
  afterEach(() => { stopTransitionWarnings(); sent.length = 0; });

  it('is sent once today is loaded, also when today has no appointments', async () => {
    freshPinia();
    mockFetch({ 'GET /api/config': () => config({ now: new Date(`${D}T10:00:00+02:00`).toISOString(), clockFrozen: true }) });
    await useClockStore().load();
    const items = useItemsStore();
    startTransitionWarnings();
    await nextTick();
    // nothing is loaded yet: an empty plan would wipe the server's
    expect(sent).toEqual([]);
    items.applyResponse(D, '2026-10-19', [ev('trip', t('2026-10-13', '12:00'), t('2026-10-13', '13:30'), { title: 'Trip', reminders: { useDefault: false, minutes: [30] } })], 's');
    await nextTick();
    expect(sent.at(-1)?.map((p) => [p.title, p.body, p.kind])).toEqual([['Trip', '12:00 – 13:30', 'event']]);
  });
});
