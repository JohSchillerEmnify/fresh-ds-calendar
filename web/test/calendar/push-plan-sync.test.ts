import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { startTransitionWarnings, stopTransitionWarnings } from '@/features/calendar/transitionWarning';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { DEFAULT_BEDTIME } from '@/features/bedtime/bedtime';
import { useCalendarsStore } from '@/stores/calendars';
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

  it('also plans the bedtime reminders and the morning overviews of the next 7 days, with their texts and kinds', async () => {
    freshPinia();
    mockFetch({ 'GET /api/config': () => config({ now: new Date(`${D}T20:00:00+02:00`).toISOString(), clockFrozen: true }) });
    await useClockStore().load();
    const prefs = usePrefsStore();
    prefs.bedtime = { ...DEFAULT_BEDTIME, enabled: true };
    prefs.notify = { ...prefs.notify, events: true, bedtime: true, morning: true, morningTime: '07:30' };
    useItemsStore().applyResponse(D, '2026-10-20', [trip], 's');
    startTransitionWarnings();
    await flushPromises();
    const plan = sent.at(-1)!;
    const show = (kind: string) => plan.filter((p) => p.kind === kind).map((p) => [new Date(p.at).toISOString(), p.title, p.body, p.key]);
    // tonight's 22:30 and the next six; the last one (19 Oct) is beyond 7 days from now
    expect(show('bedtime').slice(0, 2)).toEqual([
      ['2026-10-12T20:30:00.000Z', 'Bedtime at 23:00', '', 'bedtime:2026-10-13'],
      ['2026-10-13T20:30:00.000Z', 'Bedtime at 23:00', '', 'bedtime:2026-10-14'],
    ]);
    expect(show('bedtime')).toHaveLength(7);
    expect(show('summary').slice(0, 2)).toEqual([
      ['2026-10-13T05:30:00.000Z', 'Your day', '1 appointment · no lists · first: Trip 12:00', 'morning:2026-10-13'],
      ['2026-10-14T05:30:00.000Z', 'Your day', 'no appointments · no lists', 'morning:2026-10-14'],
    ]);
    expect(show('summary')).toHaveLength(7);
    expect(plan.map((p) => p.at)).toEqual([...plan.map((p) => p.at)].sort((a, b) => a - b));
    // switched off in Settings → Notifications: none of them
    prefs.notify = { ...prefs.notify, bedtime: false, morning: false };
    await flushPromises();
    expect(sent.at(-1)!.map((p) => p.kind)).toEqual(['event']);
  });

  /** Boots at `iso` with the planned days loaded (`items`), bedtime and morning overview on, and starts the plan. */
  async function bootAt(iso: string, items: unknown[], bedtime: Partial<typeof DEFAULT_BEDTIME> = {}) {
    freshPinia();
    mockFetch({ 'GET /api/config': () => config({ now: new Date(iso).toISOString(), clockFrozen: true }), 'GET /api/items': () => ({ items: [], syncedAt: 'x' }) });
    const clock = useClockStore();
    await clock.load();
    const prefs = usePrefsStore();
    prefs.bedtime = { ...DEFAULT_BEDTIME, enabled: true, ...bedtime };
    prefs.notify = { ...prefs.notify, events: true, bedtime: true, morning: true, morningTime: '07:30' };
    const store = useItemsStore();
    store.applyResponse(clock.today, '2026-11-30', items as never[], 's');
    startTransitionWarnings();
    await flushPromises();
    return { clock, prefs, store };
  }
  const kinds = (kind: string) => sent.at(-1)!.filter((p) => p.kind === kind);

  it('pushes no bedtime reminder while bedtime mode is off or its lead is 0', async () => {
    const { prefs } = await bootAt(`${D}T20:00:00+02:00`, []);
    expect(kinds('bedtime')).toHaveLength(7);
    prefs.bedtime = { ...prefs.bedtime, reminderMinutes: 0 };
    await flushPromises();
    expect(kinds('bedtime')).toEqual([]);
    prefs.bedtime = { ...prefs.bedtime, reminderMinutes: 30, enabled: false };
    await flushPromises();
    expect(kinds('bedtime')).toEqual([]);
  });

  it('never plans a night that ends after the loaded days (its first appointment may not be known yet)', async () => {
    // after tonight's reminder: the reminder of the night 19 -> 20 Oct (22:30 on the 19th) is within 7 days
    await bootAt(`${D}T22:45:00+02:00`, [], { mode: 'dynamic' });
    const nights = kinds('bedtime').map((p) => p.key);
    expect(nights.at(-1)).toBe('bedtime:2026-10-19');
    expect(nights).not.toContain('bedtime:2026-10-20');
  });

  it('moves the plan on with the day while the tab stays open', async () => {
    const { clock } = await bootAt(`${D}T20:00:00+02:00`, []);
    expect(kinds('summary').at(-1)!.key).toBe('morning:2026-10-19');
    clock.nowTick = Date.parse('2026-10-13T08:00:00+02:00');
    await flushPromises();
    expect(kinds('summary').at(-1)!.key).toBe('morning:2026-10-20');
  });

  it('leaves the events of hidden calendars out of the morning overview', async () => {
    const work = ev('w', t('2026-10-13', '09:00'), t('2026-10-13', '10:00'), { title: 'Standup', calendarId: 'work' });
    await bootAt(`${D}T20:00:00+02:00`, [trip, work]);
    expect(kinds('summary')[0]!.body).toBe('2 appointments · no lists · first: Standup 09:00');
    const cals = useCalendarsStore();
    cals.list = [{ id: 'work', name: 'Work', color: '#1a73e8', primary: false, writable: true, own: true, hidden: true }];
    await flushPromises();
    expect(kinds('summary')[0]!.body).toBe('1 appointment · no lists · first: Trip 12:00');
  });

  it('pushes the bedtime reminder and the overview at their wall-clock times across the change to winter time', async () => {
    await bootAt('2026-10-24T12:00:00+02:00', []);
    const at = (key: string) => new Date(sent.at(-1)!.find((p) => p.key === key)!.at).toISOString();
    // 22:30 summer time on the 24th, 07:30 and 22:30 winter time on the 25th
    expect(at('bedtime:2026-10-25')).toBe('2026-10-24T20:30:00.000Z');
    expect(at('morning:2026-10-25')).toBe('2026-10-25T06:30:00.000Z');
    expect(at('bedtime:2026-10-26')).toBe('2026-10-25T21:30:00.000Z');
  });
});
