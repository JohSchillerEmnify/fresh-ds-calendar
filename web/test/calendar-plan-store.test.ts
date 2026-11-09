import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setPlanSource, useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { config, freshPinia, mockFetch } from './helpers';

const weekend = { windows: [{ from: { day: 5, time: '17:00' }, to: { day: 0, time: '16:00' } }] };
const work = { id: 'work', name: 'Work', color: '#039be5', hidden: false };

/** Sets up the calendars store with the clock at `now` (UTC) and the Work calendar's plan. */
async function setup(now: string, plan: object | undefined, frozen = true) {
  const m = mockFetch({
    'GET /api/config': () => config({ now, clockFrozen: frozen }),
    'PATCH /api/calendars/work': (r: { body: { hidden?: boolean; color?: string; colorId?: string } }) => ({ ...work, hidden: r.body.hidden ?? false, ...(r.body.color ? { color: r.body.color } : {}) }),
    'PATCH /api/prefs': (r: { body: object }) => ({ ...usePrefsStore().current(), ...r.body }),
  });
  await useClockStore().load();
  setPlanSource({ plans: () => usePrefsStore().calendarPlans, save: (calendarPlans) => usePrefsStore().set({ calendarPlans }) });
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

describe('plan source wired late (feature calendar-off-plan)', () => {
  beforeEach(() => freshPinia());

  it('works the hidden calendars out again once the plans arrive', async () => {
    mockFetch({ 'GET /api/config': () => config({ now: '2026-11-07T09:00:00.000Z', clockFrozen: true }) });
    await useClockStore().load();
    setPlanSource({ plans: () => ({}), save: async () => {} });
    const cals = useCalendarsStore();
    cals.fromDevice([{ ...work }] as never);
    expect(cals.isHidden('work')).toBe(false);
    setPlanSource({ plans: () => ({ work: weekend }), save: async () => {} });
    expect(cals.isHidden('work')).toBe(true);
  });
});

describe('calendars store colour (feature calendar-colours)', () => {
  beforeEach(() => freshPinia());

  it('shows the colour at once and sends it to the server', async () => {
    const { cals, m } = await setup('2026-11-07T09:00:00.000Z', undefined);
    const done = cals.setColor('work', '#0b8043');
    expect(cals.list[0].color).toBe('#0b8043');
    await done;
    expect(m.calls.find((c) => c.method === 'PATCH' && c.path === '/api/calendars/work')?.body).toEqual({ color: '#0b8043' });
    expect(cals.list[0].color).toBe('#0b8043');
  });

  it('sends the palette colorId instead of the colour when there is one', async () => {
    const { cals, m } = await setup('2026-11-07T09:00:00.000Z', undefined);
    await cals.setColor('work', '#4986e7', '16');
    expect(cals.list[0].color).toBe('#4986e7');
    expect(m.calls.find((c) => c.method === 'PATCH' && c.path === '/api/calendars/work')?.body).toEqual({ colorId: '16' });
  });

  it('puts the old colour back when the server refuses', async () => {
    const { cals } = await setup('2026-11-07T09:00:00.000Z', undefined);
    mockFetch({ 'PATCH /api/calendars/work': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'no' } } }) });
    await expect(cals.setColor('work', '#0b8043')).rejects.toBeTruthy();
    expect(cals.list[0].color).toBe('#039be5');
  });
});
