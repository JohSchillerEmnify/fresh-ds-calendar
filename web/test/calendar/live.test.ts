import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NowMarker from '@/features/calendar/NowMarker.vue';
import NowCard from '@/features/calendar/NowCard.vue';
import { startTransitionWarnings, stopTransitionWarnings } from '@/features/calendar/transitionWarning';
import { enableTimerCounting } from '@/lib/timers';
import { useCalendarStore } from '@/stores/calendar';
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

async function boot(hm: string, running: boolean) {
  const pinia = freshPinia();
  mockFetch({ 'GET /api/config': () => config({ now: at(hm).toISOString(), clockFrozen: !running }) });
  const clock = useClockStore();
  await clock.load();
  const items = useItemsStore();
  items.applyResponse(D, '2026-10-13', [ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist' }), ev('call', t(D, '13:00'), t(D, '13:30'), { title: 'Call' })], 's');
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

  it('keeps a running carried-over task list with a time on the approach track', async () => {
    const { pinia, items } = await boot('02:17', false);
    const tax = {
      kind: 'tasklist', id: 'tax', calendarId: 'primary', title: 'Tax paperwork', date: '2026-10-09', time: '02:00', items: [], doneCount: 0, totalCount: 2,
      estimateMinutes: null, categoryId: null, tags: [], color: '#000000', etag: 'e', updated: '',
    } as unknown as CalendarItem;
    items.applyResponse(D, '2026-10-13', [tax, ev('dentist', t(D, '10:40'), t(D, '11:30'), { title: 'Dentist' })], 's');
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    const chips = w.findAll('[data-testid="approach-item"]');
    expect(chips.map((c) => [c.attributes('data-title'), c.attributes('data-running')])).toEqual([['Tax paperwork', 'true']]);
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
        items: url.searchParams.get('from') === D ? [ev('dentist', t(D, '10:40'), t(D, '11:00'), { title })] : [],
        from: url.searchParams.get('from'), to: url.searchParams.get('to'), syncedAt: 's',
      }),
    });
    await useClockStore().load();
    usePrefsStore().approachBar = false;
    const items = useItemsStore();
    useCalendarStore().setFromRoute('week', new Date(2026, 9, 19));
    await flushPromises();
    const ranges = calls.filter((c) => c.path === '/api/items').map((c) => `${c.url.searchParams.get('from')}_${c.url.searchParams.get('to')}`);
    expect(ranges).toEqual(['2026-10-19_2026-10-26', '2026-10-12_2026-10-13']);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] });
    const w = mount(NowCard, { global: { plugins: [pinia, router] } });
    expect(w.findAll('[data-testid="now-card-line"]').map((l) => l.text())).toEqual(['Next: Dentist in 1 h 20 min']);
    title = 'Doctor';
    await items.refreshVisible();
    await nextTick();
    expect(w.findAll('[data-testid="now-card-line"]').map((l) => l.text())).toEqual(['Next: Doctor in 1 h 20 min']);
  });
});

describe('transition warning (fake timers, one shared ticker)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }); vi.setSystemTime(at('10:25')); document.body.innerHTML = ''; });
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

  it('auto-hides at the start and stays quiet when switched off', async () => {
    const { clock } = await boot('10:25', true);
    const ui = useUiStore();
    const settings = useSettingsStore();
    settings.settings = settingsFixture();
    startTransitionWarnings();
    clock.startTicker();
    await vi.advanceTimersByTimeAsync(5 * 60000);
    expect(ui.snackbars.some((s) => s.testid === 'transition-warning')).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60000);
    await flushPromises();
    expect(ui.snackbars.some((s) => s.testid === 'transition-warning')).toBe(false);
    ui.snackbars = [];
    settings.settings = settingsFixture({ transitionWarningMinutes: 0 });
    useItemsStore().applyResponse(D, '2026-10-13', [ev('later', t(D, '11:00'), t(D, '12:00'), { title: 'Later' })], 's');
    await vi.advanceTimersByTimeAsync(50 * 60000);
    expect(ui.snackbars).toHaveLength(0);
  });
});
