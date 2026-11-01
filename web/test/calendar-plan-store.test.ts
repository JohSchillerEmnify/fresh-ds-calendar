import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { config, freshPinia, mockFetch } from './helpers';

const weekend = { windows: [{ from: { day: 5, time: '17:00' }, to: { day: 0, time: '16:00' } }] };
const work = { id: 'work', name: 'Work', color: '#039be5', hidden: false };

/** Sets up the calendars store with the clock at `now` (UTC) and the Work calendar's plan. */
async function setup(now: string, plan: object | undefined, frozen = true) {
  const m = mockFetch({
    'GET /api/config': () => config({ now, clockFrozen: frozen }),
    'PATCH /api/calendars/work': (r: { body: { hidden: boolean } }) => ({ ...work, hidden: r.body.hidden }),
    'PATCH /api/prefs': (r: { body: object }) => ({ ...usePrefsStore().current(), ...r.body }),
  });
  await useClockStore().load();
  usePrefsStore().fromDevice({ calendarPlans: plan ? { work: plan } : {} });
  const cals = useCalendarsStore();
  cals.fromDevice([{ ...work }] as never);
  return { cals, m };
}

describe('calendars store with a plan (feature calendar-off-plan)', () => {
  beforeEach(() => freshPinia());
  afterEach(() => vi.useRealTimers());

  it('hides the calendar everywhere while the weekly window is on', async () => {
    const { cals } = await setup('2026-11-07T09:00:00.000Z', weekend); // Sat 10:00 Berlin
    expect(cals.isHidden('work')).toBe(true);
  });

  it('a tap shows it and records the tap in the plan', async () => {
    const { cals, m } = await setup('2026-11-07T09:00:00.000Z', weekend);
    await cals.toggle('work');
    await flushPromises();
    expect(cals.isHidden('work')).toBe(false);
    expect(m.calls.find((c) => c.method === 'PATCH' && c.path === '/api/prefs')?.body).toEqual({ calendarPlans: { work: { ...weekend, switchedAt: '2026-11-07T10:00' } } });
  });

  it('a tap ends off for a while and keeps the window', async () => {
    const { cals } = await setup('2026-11-07T09:00:00.000Z', { ...weekend, until: '2026-11-10', since: '2026-11-07T09:00' });
    await cals.toggle('work');
    await flushPromises();
    expect(usePrefsStore().calendarPlans.work).toEqual({ ...weekend, switchedAt: '2026-11-07T10:00' });
  });

  it('switches back on at the window end while the app is open', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-08T14:58:00.000Z') });
    const { cals } = await setup('2026-11-08T14:58:00.000Z', weekend, false); // Sun 15:58 Berlin
    useClockStore().startTicker();
    expect(cals.isHidden('work')).toBe(true);
    vi.advanceTimersByTime(3 * 60_000);
    expect(cals.isHidden('work')).toBe(false);
    useClockStore().stopTicker();
  });

  it('Always on removes the plan and switches the calendar on', async () => {
    const { cals } = await setup('2026-11-07T09:00:00.000Z', weekend);
    await cals.setPlan('work', undefined);
    expect(usePrefsStore().calendarPlans).toEqual({});
    expect(cals.isHidden('work')).toBe(false);
  });

  it('a new off-for-a-while counts from now', async () => {
    const { cals } = await setup('2026-11-04T07:00:00.000Z', undefined);
    await cals.setPlan('work', { until: '2026-11-06' });
    expect(usePrefsStore().calendarPlans.work).toEqual({ until: '2026-11-06', since: '2026-11-04T08:00' });
    expect(cals.isHidden('work')).toBe(true);
  });
});
