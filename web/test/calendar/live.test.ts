import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NowMarker from '@/features/calendar/NowMarker.vue';
import NowCard from '@/features/calendar/NowCard.vue';
import { morningOverview, NATIVE_LEGACY_PREFIX, NATIVE_MORNING_ID, NATIVE_REMINDER_PREFIX, startTransitionWarnings, stopTransitionWarnings } from '@/features/calendar/transitionWarning';
import { enableTimerCounting } from '@/lib/timers';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import type { CalendarItem } from '@/api/types';
import { config, freshPinia, mockFetch, settingsFixture } from '../helpers';
import { createMemoryHistory, createRouter } from 'vue-router';
import { advance, ev, t } from './helpers';

const D = '2026-10-12';
const at = (hm: string) => new Date(`${D}T${hm}:00+02:00`);
const laundry = { kind: 'tasklist', id: 'laundry', calendarId: 'tasks', title: 'Laundry', date: D, time: '18:00', items: [], doneCount: 0, totalCount: 1,
  estimateMinutes: 60, categoryId: null, tags: [], color: '#0b8043', reminders: { useDefault: false, minutes: [30] }, etag: 'e', updated: '' } as unknown as CalendarItem;
const ten = { useDefault: false, minutes: [10] };
/** End of the 8 planned days from D: the native schedule and the push plan wait until all of them are loaded. */
const W = '2026-10-20';

async function boot(hm: string, running: boolean) {
  const pinia = freshPinia();
  mockFetch({ 'GET /api/config': () => config({ now: at(hm).toISOString(), clockFrozen: !running }) });
  const clock = useClockStore();
  await clock.load();
  const items = useItemsStore();
  items.applyResponse(D, W, [ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist', reminders: ten }), ev('call', t(D, '13:00'), t(D, '13:30'), { title: 'Call', reminders: ten })], 's');
  useSettingsStore().$patch({});
  return { pinia, clock, items };
}

describe('now marker', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('sits at the current time in today\'s column only and follows the clock', async () => {
    const { pinia, clock } = await boot('09:20', false);
    const w = mount(NowMarker, { props: { date: D, hourHeight: 48 }, global: { plugins: [pinia] } });
    const m = w.get('[data-testid="now-marker"]');
    expect(m.attributes('data-time')).toBe('09:20');
    expect(m.attributes('style')).toContain(`top: ${(560 / 60) * 48}px`);
    advance(30);
    await nextTick();
    expect(w.get('[data-testid="now-marker"]').attributes('data-time')).toBe('09:50');
    expect(clock.minutesNow).toBe(9 * 60 + 50);
    const other = mount(NowMarker, { props: { date: '2026-10-13', hourHeight: 48 }, global: { plugins: [pinia] } });
    expect(other.find('[data-testid="now-marker"]').exists()).toBe(false);
  });
});

describe('now card', () => {
  it('is the always-compact Approaching card with the approach track on by default', async () => {
    const { pinia } = await boot('09:20', false);
    expect(usePrefsStore()).toMatchObject({ approachBar: true, approachingCard: true, approachWindowHours: 3 });
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    const card = w.get('[data-testid="now-card"]');
    expect(card.attributes('aria-label')).toBe('Approaching');
    expect(card.attributes('role')).toBeUndefined();
    expect(card.attributes('data-collapsed')).toBeUndefined();
    expect(w.find('[data-testid="approach-bar"]').exists()).toBe(true);
    expect(w.findAll('[data-testid="now-card-line"]').map((l) => l.text())).toEqual([]);
    // tapping the card no longer collapses it
    await card.trigger('click');
    expect(w.find('[data-testid="approach-bar"]').exists()).toBe(true);
  });

  it('keeps a carried-over task list off the approach track (untimed today)', async () => {
    const { pinia, items } = await boot('02:17', false);
    const tax = {
      kind: 'tasklist', id: 'tax', calendarId: 'primary', title: 'Tax paperwork', date: '2026-10-09', time: '02:00', items: [], doneCount: 0, totalCount: 2,
      estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '',
    } as unknown as CalendarItem;
    items.applyResponse(D, W, [tax, ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist' })], 's');
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    const chips = w.findAll('[data-testid="approach-item"]');
    expect(chips.map((c) => [c.attributes('data-title'), c.attributes('data-running')])).toEqual([['Dentist', undefined]]);
  });

  it('counts down the current event and shows next, also while another period is shown', async () => {
    const { pinia } = await boot('09:20', false);
    usePrefsStore().approachBar = false;
    const cal = useCalendarStore();
    cal.view = 'day';
    cal.anchor = at('00:00');
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    const lines = () => w.findAll('[data-testid="now-card-line"]').map((l) => l.text());
    expect(lines()).toEqual(['Next: Dentist in 1 h 20 min']);
    expect(w.find('[data-testid="now-card-current"]').exists()).toBe(false);
    advance(95);
    await nextTick();
    expect(lines()).toEqual(['Dentist · 35 min left', 'Next: Call in 2 h 5 min']);
    expect(w.get('[data-testid="now-progress"]').attributes('aria-valuenow')).toBe('30');
    cal.view = 'week'; cal.anchor = new Date(2026, 9, 19);
    await nextTick();
    expect(lines()).toEqual(['Dentist · 35 min left', 'Next: Call in 2 h 5 min']);
  });

  it('browsing another week keeps today\'s next event loaded for the card (and refreshes it on poll)', async () => {
    const pinia = freshPinia();
    let title = 'Dentist';
    const { calls } = mockFetch({
      'GET /api/config': () => config({ now: at('09:20').toISOString(), clockFrozen: true }),
      'GET /api/items': ({ url }) => ({
        items: url.searchParams.get('from') === D || url.searchParams.get('also')?.startsWith(`${D}..`) ? [ev('dentist', t(D, '10:40'), t(D, '11:00'), { title })] : [],
        from: url.searchParams.get('from'), to: url.searchParams.get('to'), syncedAt: 's',
      }),
    });
    await useClockStore().load();
    usePrefsStore().approachBar = false;
    const items = useItemsStore();
    useCalendarStore().setFromRoute('week', new Date(2026, 9, 19));
    await flushPromises();
    const ranges = calls.filter((c) => c.path === '/api/items').map((c) => `${c.url.searchParams.get('from')}_${c.url.searchParams.get('to')} also=${c.url.searchParams.get('also')}`);
    expect(ranges).toEqual(['2026-10-19_2026-10-26 also=2026-10-12..2026-10-13']); // one request per load/poll
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    expect(w.findAll('[data-testid="now-card-line"]').map((l) => l.text())).toEqual(['Next: Dentist in 1 h 20 min']);
    title = 'Doctor';
    await items.refreshVisible();
    await nextTick();
    expect(w.findAll('[data-testid="now-card-line"]').map((l) => l.text())).toEqual(['Next: Doctor in 1 h 20 min']);
    expect(calls.filter((c) => c.path === '/api/items')).toHaveLength(2);
  });
});

describe('transition warning (fake timers, one shared ticker)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }); vi.setSystemTime(at('10:25')); document.body.innerHTML = ''; localStorage.clear(); });
  afterEach(() => { stopTransitionWarnings(); useClockStore().stopTicker(); vi.useRealTimers(); });

  it('appears 10 min before, once, dismissible, and leaves no timers behind', async () => {
    enableTimerCounting(true);
    const { clock } = await boot('10:25', true);
    const ui = useUiStore();
    useSettingsStore().settings = settingsFixture();
    startTransitionWarnings();
    clock.startTicker();
    const warn = () => ui.snackbars.filter((s) => s.testid === 'transition-warning');
    expect(warn()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5 * 60000);
    await flushPromises();
    expect(warn().map((s) => s.text)).toEqual(['Dentist starts in 10 min']);
    ui.dismiss(warn()[0].id);
    await vi.advanceTimersByTimeAsync(2 * 60000);
    await flushPromises();
    expect(warn()).toHaveLength(0);
    // the only live timer is the clock's next minute tick
    expect(window.__appTimers).toBe(1);
    stopTransitionWarnings();
    clock.stopTicker();
    expect(window.__appTimers).toBe(0);
  });

  it('auto-hides at the start and stays quiet for an event without reminders', async () => {
    const { clock } = await boot('10:25', true);
    const ui = useUiStore();
    useSettingsStore().settings = settingsFixture();
    startTransitionWarnings();
    clock.startTicker();
    await vi.advanceTimersByTimeAsync(5 * 60000);
    expect(ui.snackbars.some((s) => s.testid === 'transition-warning')).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60000);
    await flushPromises();
    expect(ui.snackbars.some((s) => s.testid === 'transition-warning')).toBe(false);
    ui.snackbars = [];
    useItemsStore().applyResponse(D, W, [ev('later', t(D, '11:00'), t(D, '12:00'), { title: 'Later', reminders: { useDefault: true, minutes: [] } })], 's');
    await vi.advanceTimersByTimeAsync(50 * 60000);
    expect(ui.snackbars).toHaveLength(0);
  });

  it('rings at every lead of an event, the nearest due one only, and counts down the minutes left', async () => {
    const { clock, items } = await boot('10:25', true);
    items.applyResponse(D, W, [ev('d', t(D, '11:00'), t(D, '11:30'), { title: 'Dentist', reminders: { useDefault: false, minutes: [30, 15] } })], 's');
    const ui = useUiStore();
    startTransitionWarnings();
    clock.startTicker();
    const warn = () => ui.snackbars.filter((s) => s.testid === 'transition-warning').map((s) => s.text);
    expect(warn()).toEqual([]);
    await vi.advanceTimersByTimeAsync(5 * 60000);
    expect(warn()).toEqual(['Dentist starts in 30 min']);
    // while it is open it counts down
    await vi.advanceTimersByTimeAsync(2 * 60000);
    expect(warn()).toEqual(['Dentist starts in 28 min']);
    ui.snackbars = [];
    await vi.advanceTimersByTimeAsync(13 * 60000);
    expect(warn()).toEqual(['Dentist starts in 15 min']);
    // joining late: both leads are due, only the nearest speaks, with the minutes really left
    stopTransitionWarnings();
    ui.snackbars = [];
    localStorage.clear();
    vi.setSystemTime(at('10:50'));
    clock.nowTick = at('10:50').getTime();
    startTransitionWarnings();
    expect(warn()).toEqual(['Dentist starts in 10 min']);
  });

  it('does not show a reminder again when the app is opened again, but still shows a later lead', async () => {
    const { clock, items } = await boot('10:25', true);
    items.applyResponse(D, W, [ev('d', t(D, '11:00'), t(D, '11:30'), { title: 'Dentist', reminders: { useDefault: false, minutes: [30, 15] } })], 's');
    const ui = useUiStore();
    startTransitionWarnings();
    clock.startTicker();
    const warn = () => ui.snackbars.filter((s) => s.testid === 'transition-warning').map((s) => s.text);
    await vi.advanceTimersByTimeAsync(5 * 60000);
    expect(warn()).toEqual(['Dentist starts in 30 min']);
    // the app is closed and opened again with the same time: the 30 min reminder was said
    stopTransitionWarnings();
    ui.snackbars = [];
    startTransitionWarnings();
    expect(warn()).toEqual([]);
    // the later lead still speaks
    await vi.advanceTimersByTimeAsync(15 * 60000);
    expect(warn()).toEqual(['Dentist starts in 15 min']);
  });

  it('stays quiet for an event of a hidden calendar and speaks up when it is shown again', async () => {
    const { clock, items } = await boot('10:25', true);
    const cals = useCalendarsStore();
    const calId = items.all.find((i) => i.id === 'dentist')!.calendarId;
    cals.list = [{ id: calId, name: 'Work', color: '#1a73e8', primary: false, writable: true, hidden: true, defaultReminders: [] }];
    const ui = useUiStore();
    useSettingsStore().settings = settingsFixture();
    startTransitionWarnings();
    clock.startTicker();
    await vi.advanceTimersByTimeAsync(5 * 60000);
    await flushPromises();
    expect(ui.snackbars.filter((s) => s.testid === 'transition-warning')).toHaveLength(0);
    cals.list = [{ ...cals.list[0]!, hidden: false }];
    await vi.advanceTimersByTimeAsync(60000);
    await flushPromises();
    expect(ui.snackbars.filter((s) => s.testid === 'transition-warning').map((s) => s.text)).toEqual(['Dentist starts in 9 min']);
  });
});

describe('transition warnings as Android notifications', () => {
  afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; stopTransitionWarnings(); });

  it('schedules them through the plugin, re-sends only changes and cancels what is gone', async () => {
    const plugin = {
      schedule: vi.fn((_o: { id: string; at: number; title: string; body: string; kind: string; start?: number; end?: number }) => Promise.resolve()),
      cancel: vi.fn((_o: { id: string }) => Promise.resolve()),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    const { clock, items } = await boot('09:00', false);
    useSettingsStore().settings = settingsFixture();
    startTransitionWarnings();
    // named by the event with its times and a start the phone counts down to, never "starts in 10 min"
    // and kept until the event ends
    expect(plugin.schedule.mock.calls.map(([o]) => [o.id.startsWith(NATIVE_REMINDER_PREFIX), o.title, o.body, o.kind, o.at, o.start, o.end]))
      .toEqual([
        [true, 'Dentist', '10:40 – 11:30', 'event', at('10:30').getTime(), at('10:40').getTime(), at('11:30').getTime()],
        [true, 'Call', '13:00 – 13:30', 'event', at('12:50').getTime(), at('13:00').getTime(), at('13:30').getTime()],
      ]);
    clock.nowTick = at('09:01').getTime();
    await nextTick();
    expect(plugin.schedule).toHaveBeenCalledTimes(2);
    items.applyResponse(D, W, [ev('call', t(D, '13:00'), t(D, '13:30'), { title: 'Call' })], 's3');
    await nextTick();
    expect(plugin.cancel).toHaveBeenCalledWith({ id: expect.stringContaining('dentist') });
  });

  it('leaves a reminder that rang alone while its item is there (its notification stays), and cancels it when the item goes', async () => {
    const plugin = {
      schedule: vi.fn((_o: { id: string }) => Promise.resolve()),
      cancel: vi.fn((_o: { id: string }) => Promise.resolve()),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    const { clock, items } = await boot('09:00', false);
    startTransitionWarnings();
    const dentist = `${NATIVE_REMINDER_PREFIX}dentist@${D}T10:40-10`;
    expect(plugin.schedule.mock.calls.map(([o]) => o.id)).toContain(dentist);
    // the app goes to the background, the reminder rings there, the person comes back before the start
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    clock.nowTick = at('10:33').getTime();
    await nextTick();
    hidden.mockReturnValue(false);
    clock.nowTick = at('10:34').getTime();
    await nextTick();
    expect(plugin.cancel).not.toHaveBeenCalled();
    hidden.mockRestore();
    // the event is deleted: its notification goes with it
    items.applyResponse(D, W, [ev('call', t(D, '13:00'), t(D, '13:30'), { title: 'Call', reminders: ten })], 's8');
    await nextTick();
    expect(plugin.cancel.mock.calls.map(([o]) => o.id)).toEqual([dentist]);
  });

  describe('a reminder that rang', () => {
    const dentist = `${NATIVE_REMINDER_PREFIX}dentist@${D}T10:40-10`;
    /** Boots with the plugin, lets the dentist reminder (10:30) ring while the app is hidden, and comes back at `back`. */
    async function rang(back: string) {
      const plugin = { schedule: vi.fn((_o: { id: string }) => Promise.resolve()), cancel: vi.fn((_o: { id: string }) => Promise.resolve()) };
      (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
      const { clock, items } = await boot('09:00', false);
      const prefs = usePrefsStore();
      prefs.notify = { ...prefs.notify, events: true, tasklists: true };
      items.applyResponse(D, W, [ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist', reminders: ten }), laundry], 's');
      startTransitionWarnings();
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      clock.nowTick = at('10:33').getTime();
      await nextTick();
      hidden.mockRestore();
      clock.nowTick = at(back).getTime();
      await nextTick();
      return { plugin, clock, items, prefs };
    }

    it('is cancelled when an edit moved its item', async () => {
      const { plugin, items } = await rang('10:34');
      expect(plugin.cancel).not.toHaveBeenCalled();
      items.applyResponse(D, W, [ev('dentist', t(D, '10:50'), t(D, '11:30'), { title: 'Dentist', reminders: ten }), laundry], 's2');
      await nextTick();
      expect(plugin.cancel.mock.calls.map(([o]) => o.id)).toEqual([dentist]);
    });

    it('of a task list is kept while the list is there', async () => {
      const { plugin, clock } = await rang('10:34');
      const list = `${NATIVE_REMINDER_PREFIX}laundry@${D}T18:00-30`;
      expect(plugin.schedule.mock.calls.map(([o]) => o.id)).toContain(list);
      clock.nowTick = at('17:45').getTime(); // rang at 17:30, the list starts at 18:00
      await nextTick();
      expect(plugin.cancel.mock.calls.map(([o]) => o.id)).not.toContain(list);
    });

    it('is forgotten at its end without a cancel (a later delete cancels nothing)', async () => {
      const { plugin, clock, items } = await rang('10:34');
      clock.nowTick = at('11:31').getTime();
      await nextTick();
      items.applyResponse(D, W, [laundry], 's3');
      await nextTick();
      expect(plugin.cancel).not.toHaveBeenCalled();
    });

    it('is cancelled when its kind is switched off', async () => {
      const { plugin, prefs } = await rang('10:34');
      prefs.notify = { ...prefs.notify, events: false };
      await nextTick();
      expect(plugin.cancel.mock.calls.map(([o]) => o.id)).toEqual([dentist]);
    });

    it('is cancelled when its calendar is hidden', async () => {
      const { plugin, items } = await rang('10:34');
      const cals = useCalendarsStore();
      cals.list = [{ id: items.get('dentist')!.calendarId, name: 'Work', color: '#1a73e8', primary: false, writable: true, hidden: true, defaultReminders: [] }];
      await nextTick();
      expect(plugin.cancel.mock.calls.map(([o]) => o.id)).toContain(dentist);
    });
  });

  it('keeps the schedule while planned days are evicted from the range cache, and fetches them again', async () => {
    const plugin = {
      schedule: vi.fn((_o: { id: string }) => Promise.resolve()),
      cancel: vi.fn((_o: { id: string }) => Promise.resolve()),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    const { items } = await boot('09:00', false);
    const { calls } = mockFetch({ 'GET /api/items': () => ({ items: [], syncedAt: 's9' }) });
    items.applyResponse(D, W, [ev('trip', t('2026-10-17', '12:00'), t('2026-10-17', '13:00'), { title: 'Trip', reminders: ten })], 's6');
    startTransitionWarnings();
    expect(plugin.schedule.mock.calls.map(([o]) => o.id)).toEqual([`${NATIVE_REMINDER_PREFIX}trip@2026-10-17T12:00-10`]);
    // browsing months pushes the window out of the 6-range cache: only today stays loaded
    for (let m = 1; m <= 6; m++) items.applyResponse(`2027-0${m}-01`, `2027-0${m}-28`, [], `m${m}`);
    items.applyResponse(D, '2026-10-13', [], 's7');
    await nextTick();
    expect(plugin.cancel).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.path === '/api/items').map((c) => c.url.searchParams.get('to'))).toEqual([W]);
  });

  it('builds the morning overview', async () => {
    const { items } = await boot('09:00', false);
    items.applyResponse(D, W, [ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist' }), laundry], 's4');
    expect(morningOverview(items.byDate.get(D) ?? [])).toEqual({ title: 'Your day', body: '1 appointment · 1 list · first: Dentist 10:40' });
    expect(morningOverview([]).body).toBe('no appointments · no lists');
  });

  it('schedules a timed task list only with the switch on, and cleans up ids the plan does not hold', async () => {
    const plugin = {
      schedule: vi.fn((_o: { id: string; at: number; title: string; body: string; kind: string; start?: number; end?: number }) => Promise.resolve()),
      cancel: vi.fn((_o: { id: string }) => Promise.resolve()),
      list: vi.fn(() => Promise.resolve({ ids: ['reminder:gone@2026-10-12T10:00-10', 'transition:old@2026-10-12T10:00', 'morning', 'other'] })),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    const { items } = await boot('09:00', false);
    items.applyResponse(D, W, [laundry], 's5');
    const prefs = usePrefsStore();
    prefs.notify = { ...prefs.notify, tasklists: false };
    startTransitionWarnings();
    await flushPromises();
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.cancel.mock.calls.map(([o]) => o.id).sort()).toEqual(['reminder:gone@2026-10-12T10:00-10', 'transition:old@2026-10-12T10:00']);
    prefs.notify = { ...prefs.notify, tasklists: true };
    await nextTick();
    expect(plugin.schedule.mock.calls.map(([o]) => [o.id, o.title, o.kind, o.at, o.start])).toEqual([[`${NATIVE_REMINDER_PREFIX}laundry@${D}T18:00-30`, 'Laundry', 'tasklist', at('17:30').getTime(), at('18:00').getTime()]]);
    expect(NATIVE_LEGACY_PREFIX).toBe('transition:');
  });

  it('schedules the morning overview only when chosen, and nothing for switched-off kinds', async () => {
    const plugin = {
      schedule: vi.fn((_o: { id: string; at: number; title: string; body: string; kind: string; start?: number; end?: number }) => Promise.resolve()),
      cancel: vi.fn((_o: { id: string }) => Promise.resolve()),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    await boot('07:00', false);
    useSettingsStore().settings = settingsFixture();
    const prefs = usePrefsStore();
    prefs.notify = { bedtime: true, events: false, tasklists: false, morning: true, morningTime: '07:30' };
    startTransitionWarnings();
    expect(plugin.schedule.mock.calls.map(([o]) => [o.id, o.at, o.title, o.kind, o.start])).toEqual([[NATIVE_MORNING_ID, at('07:30').getTime(), 'Your day', 'summary', undefined]]);
    prefs.notify = { ...prefs.notify, morning: false };
    await nextTick();
    expect(plugin.cancel).toHaveBeenCalledWith({ id: NATIVE_MORNING_ID });
  });

  it("plans tomorrow's morning overview once today's time has passed, summing up tomorrow", async () => {
    const plugin = {
      schedule: vi.fn<(o: { id: string; at: number; title: string; body: string }) => Promise<void>>(() => Promise.resolve()),
      cancel: vi.fn(() => Promise.resolve()),
    };
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { Reminders: plugin } };
    const { items } = await boot('20:00', false);
    const next = '2026-10-13';
    items.applyResponse(D, W, [ev('dentist', t(next, '10:00'), t(next, '11:00'), { title: 'Dentist' })], 's6');
    usePrefsStore().notify = { bedtime: false, events: false, tasklists: false, morning: true, morningTime: '07:30' };
    startTransitionWarnings();
    expect(plugin.schedule.mock.calls.filter(([o]) => o.id === NATIVE_MORNING_ID).map(([o]) => [o.at, o.title, o.body]))
      .toEqual([[new Date(`${next}T07:30:00+02:00`).getTime(), 'Your day', '1 appointment · no lists · first: Dentist 10:00']]);
  });
});
