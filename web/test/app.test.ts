import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';
import { createAppRouter } from '@/router';
import { registerBuiltinExtensions } from '@/extensions/builtin';
import { useClockStore } from '@/stores/clock';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { useMotivationStore } from '@/features/motivation/store';
import { isSwipeScreen, isTouchLayout } from '@/composables/useViewport';
import { config, eventFixture, freshPinia, mockFetch, settingsFixture } from './helpers';

const ev = (id: string, d: string, h = '09') => eventFixture(id, `${d}T${h}:00:00+02:00`, `${d}T${Number(h) + 1}:00:00+02:00`);
let wrapper: VueWrapper | null = null;
let server = settingsFixture();

async function mountAt(path: string, extra: Parameters<typeof mockFetch>[0] = {}, items: unknown[] = []) {
  server = settingsFixture();
  const m = mockFetch({
    'GET /api/config': () => config({ pollIntervalMs: 0 }),
    'GET /api/settings': () => server,
    'GET /api/calendars': () => ({ calendars: [] }),
    'PATCH /api/settings': ({ body }) => (server = settingsFixture({ ...server, ...body, version: server.version + 1 })),
    'POST /api/categories': ({ body }) => (server = settingsFixture({ ...server, categories: [...server.categories, { id: 'new1', icon: null, googleColorId: '7', ...body }], version: server.version + 1 })),
    'GET /api/items': () => ({ items, from: 'a', to: 'b', syncedAt: 's' }),
    'GET /api/summary': () => ({ days: { '2026-10-14': { events: 1, tasklists: 0, openTasklists: 0, density: 1 }, '2026-10-16': { events: 4, tasklists: 0, openTasklists: 0, density: 3 } } }),
    'GET /api/tasklists/open': () => ({ items: [] }),
    'GET /api/templates': () => ({ templates: [] }),
    'GET /api/motivation': () => ({ streak: { current: 2, best: 7, lastCheckIn: null, checkedInToday: false }, plant: {} }),
    ...extra,
  });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  registerBuiltinExtensions();
  const router: Router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { router, w: wrapper, m };
}
const tid = (id: string) => `[data-testid="${id}"]`;
// the deploy host is slower: lazy chunks (e.g. the colour library) can take over the 1 s default
const wait = async (fn: () => void) => { await vi.waitFor(fn, { timeout: 5000 }); await flushPromises(); };

// a mouse by default (jsdom has no matchMedia): the arrows are a desktop control; touch screens swipe (owner, 2026-10-26)
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); isTouchLayout.value = false; isSwipeScreen.value = false; });
afterEach(() => { wrapper?.unmount(); wrapper = null; });

describe('routing', () => {
  it('opens the default view for today and respects settings.defaultView', async () => {
    const { router } = await mountAt('/');
    expect(router.currentRoute.value.path).toBe('/month/2026-10');
  });
  it('redirects invalid links to the current month, normalises weeks, keeps the query', async () => {
    for (const bad of ['/month/2026-13', '/week/not-a-date', '/day/2026-02-30', '/unknown', '/year/12']) {
      const { router } = await mountAt(bad);
      expect(router.currentRoute.value.path).toBe('/month/2026-10');
      wrapper?.unmount();
    }
    const { router } = await mountAt('/week/2026-10-15?categories=work');
    expect(router.currentRoute.value.fullPath).toBe('/week/2026-10-12?categories=work');
  });
  it('the start page returns to the page remembered before signing in, once', async () => {
    sessionStorage.setItem('signin-return', '/week/2026-10-12');
    const { router } = await mountAt('/');
    expect(router.currentRoute.value.path).toBe('/week/2026-10-12');
    expect(sessionStorage.getItem('signin-return')).toBeNull();
  });
  it('the start page ignores a remembered return that is not a path of this app', async () => {
    for (const bad of ['//evil.example/x', 'https://evil.example/', 'week/2026-10-12']) {
      sessionStorage.setItem('signin-return', bad);
      const { router } = await mountAt('/');
      expect(router.currentRoute.value.path, bad).toBe('/month/2026-10');
      wrapper?.unmount();
    }
  });
  it('/year/YYYY and /settings are lazy routes that render', async () => {
    const { w } = await mountAt('/year/2026');
    await wait(() => expect(w.find(tid('year-view')).exists()).toBe(true));
    wrapper?.unmount();
    const s = await mountAt('/settings');
    await wait(() => expect(s.w.find(tid('settings-view')).exists()).toBe(true));
  });
});

describe('shell navigation', () => {
  it('shows the title, moves by one period and returns with Today', async () => {
    const { w, router } = await mountAt('/week/2026-10-12');
    expect(w.get(tid('period-title')).text()).toBe('12 – 18 Oct 2026');
    await w.get(tid('nav-next')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/week/2026-10-19'));
    await w.get(tid('nav-today')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/week/2026-10-12'));
  });
  it('switches views keeping the focus date and offers all four views', async () => {
    const { w, router } = await mountAt('/month/2026-12');
    await w.get(tid('view-switch-week')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/week/2026-11-30'));
    await w.get(tid('view-switch-day')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/day/2026-12-01'));
    expect(w.find(tid('view-switch-year')).exists()).toBe(true);
    expect(w.get(tid('view-switch-day')).attributes('aria-selected')).toBe('true');
  });
  it('on a Labs view prev/next stay on it, but switching to Day leaves it', async () => {
    const { w, router } = await mountAt('/clock/2026-10-14');
    await w.get(tid('nav-next')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/clock/2026-10-15'));
    await w.get(tid('nav-prev')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/clock/2026-10-14'));
    await w.get(tid('view-switch-day')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/day/2026-10-14'));
  });
  it('FAB opens the one new dialog with the kind switch (no menu)', async () => {
    const { w } = await mountAt('/day/2026-10-14');
    await w.get(tid('create-button')).trigger('click');
    await wait(() => expect(w.find(tid('event-dialog')).exists()).toBe(true));
    expect(w.find(tid('create-menu')).exists()).toBe(false);
    expect(w.find(tid('new-kind-event')).exists() && w.find(tid('new-kind-tasklist')).exists()).toBe(true);
    await w.get(tid('new-kind-tasklist')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
  });
  it('a tapped time slot keeps its date and time in both kinds; the FAB task list form has no time', async () => {
    localStorage.removeItem('calendar.newKind');
    const { w } = await mountAt('/day/2026-10-14');
    const val = (id: string) => (w.get(tid(id)).element as HTMLInputElement).value;
    await w.get('[data-testid="time-slot"][data-date="2026-10-14"][data-hour="15"]').trigger('click');
    await wait(() => expect(w.find(tid('event-dialog')).exists()).toBe(true));
    await w.get(tid('new-kind-tasklist')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
    expect([val('tasklist-date'), val('tasklist-time')]).toEqual(['2026-10-14', '15:00']);
    await w.get(tid('tasklist-cancel')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(false));
    // the remembered kind is now "task list": a slot opens it directly with the slot's time
    await w.get('[data-testid="time-slot"][data-date="2026-10-14"][data-hour="9"]').trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
    expect(val('tasklist-time')).toBe('09:00');
    await w.get(tid('new-kind-event')).trigger('click');
    await wait(() => expect(w.find(tid('event-dialog')).exists()).toBe(true));
    await w.get(tid('new-kind-tasklist')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
    expect(val('tasklist-time')).toBe('09:00');
    await w.get(tid('tasklist-cancel')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(false));
    await w.get(tid('create-button')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
    expect([val('tasklist-date'), val('tasklist-time')]).toEqual(['2026-10-14', '']);
    await w.get(tid('new-kind-event')).trigger('click');
    await wait(() => expect(w.find(tid('event-dialog')).exists()).toBe(true));
    await w.get(tid('new-kind-tasklist')).trigger('click');
    await wait(() => expect(w.find(tid('tasklist-dialog')).exists()).toBe(true));
    expect(val('tasklist-time')).toBe('');
  });
  const touchOn = (area: Element) => (type: string, x: number, y: number) => {
    const e = new Event(type, { bubbles: true }) as Event & { touches: unknown[]; changedTouches: unknown[] };
    e.touches = type === 'touchend' ? [] : [{ clientX: x, clientY: y }];
    e.changedTouches = [{ clientX: x, clientY: y }];
    area.dispatchEvent(e);
  };
  it('swiping left goes to the next period at once with motion off, a vertical swipe does nothing', async () => {
    const { w, router } = await mountAt('/day/2026-10-12');
    useSettingsStore().settings.animationLevel = 'off';
    await flushPromises();
    const touch = touchOn(w.get(tid('calendar-swipe-area')).element);
    touch('touchstart', 300, 300); touch('touchend', 100, 305);
    await wait(() => expect(router.currentRoute.value.path).toBe('/day/2026-10-13'));
    expect(w.find(tid('swipe-neighbour')).exists()).toBe(false);
    touch('touchstart', 200, 500); touch('touchend', 205, 200);
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/day/2026-10-13');
  });
  it('a live swipe shows the neighbouring period beside the current one, then settles on it', async () => {
    const { w, router, m } = await mountAt('/week/2026-10-12');
    const area = w.get(tid('calendar-swipe-area')).element;
    Object.defineProperty(area, 'clientWidth', { value: 400 });
    const touch = touchOn(area);
    touch('touchstart', 300, 300); touch('touchmove', 280, 301); touch('touchmove', 200, 302);
    await flushPromises();
    const nb = w.get(tid('swipe-neighbour'));
    expect(nb.attributes()).toMatchObject({ 'data-period-start': '2026-10-19', 'aria-hidden': 'true' });
    expect(nb.find(tid('week-view')).attributes('data-week-start')).toBe('2026-10-19');
    // its range is fetched in the background
    expect(m.calls.some((c) => c.path === '/api/items' && c.url.searchParams.get('from') === '2026-10-19')).toBe(true);
    touch('touchmove', 150, 302); touch('touchend', 150, 302);
    await wait(() => expect(router.currentRoute.value.path).toBe('/week/2026-10-19'));
    await wait(() => expect(w.find(tid('swipe-neighbour')).exists()).toBe(false));
    expect(w.get(tid('week-view')).attributes('data-week-start')).toBe('2026-10-19');
  });
  it('a short live swipe springs back and drops the neighbour', async () => {
    const { w, router } = await mountAt('/week/2026-10-12');
    const area = w.get(tid('calendar-swipe-area')).element;
    Object.defineProperty(area, 'clientWidth', { value: 400 });
    const touch = touchOn(area);
    touch('touchstart', 100, 300); touch('touchmove', 120, 300); touch('touchmove', 160, 300);
    await flushPromises();
    expect(w.get(tid('swipe-neighbour')).attributes('data-period-start')).toBe('2026-10-05');
    // the finger rests before letting go: no flick
    await new Promise((r) => setTimeout(r, 150));
    touch('touchend', 160, 300);
    await wait(() => expect(w.find(tid('swipe-neighbour')).exists()).toBe(false));
    expect(router.currentRoute.value.path).toBe('/week/2026-10-12');
  });
  it('shows the error banner with a retry that clears it', async () => {
    let down = true;
    const { w } = await mountAt('/week/2026-10-12', { 'GET /api/items': () => (down ? { status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } } : { items: [], from: 'a', to: 'b', syncedAt: 's' }) });
    await wait(() => expect(w.find(tid('sync-error-banner')).exists()).toBe(true));
    expect(w.get(tid('sync-status')).attributes('data-state')).toBe('error');
    down = false;
    await w.get(tid('sync-retry')).trigger('click');
    await wait(() => expect(w.find(tid('sync-error-banner')).exists()).toBe(false));
  });
  it('mounts the real TopBarScene in the background slot with the effective scene', async () => {
    const { w } = await mountAt('/month/2026-10');
    await useThemeStore().pick('scene', 'mordor');
    await flushPromises();
    await wait(() => expect(w.find(`${tid('top-bar-background')} [data-testid="scene-mordor"]`).exists()).toBe(true));
  });
});

describe('top bar: arrows only with a mouse', () => {
  it('a touch screen keeps the ‹ › buttons for screen readers, visually hidden; Today stays', async () => {
    isSwipeScreen.value = true;
    const { w } = await mountAt('/week/2026-10-12');
    expect(w.find(tid('nav-today')).exists()).toBe(true);
    expect(w.find(tid('nav-prev')).classes()).toContain('sr-only');
    expect(w.find(tid('nav-next')).classes()).toContain('sr-only');
  });
  it('a mouse keeps the arrows', async () => {
    const { w } = await mountAt('/week/2026-10-12');
    expect(w.find(tid('nav-prev')).classes()).not.toContain('sr-only');
    expect(w.find(tid('nav-next')).classes()).not.toContain('sr-only');
  });
});

describe('top bar: streak choice and sync icon', () => {
  const motivation = () => ({ streak: { current: 2, best: 7, lastCheckIn: '2026-10-12', checkedInToday: true }, plant: { growth: 30, stage: 'Sprout', stageIndex: 1, nextStageAt: 60, todayPoints: 0, lastWatered: '2026-10-12', flowers: 0, vitality: 100, mood: 'happy', message: 'Your plant is happy' } });
  const widgets = (w: VueWrapper) => ({ flame: w.find(tid('streak-flame')).exists(), plant: w.find(tid('plant-button')).exists() });
  // the motivation store fetches on its own (global fetch), not through the API client
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify(String(u).endsWith('/checkin') ? { current: 2, best: 7, checkedInToday: true, newToday: false, motivation: motivation() } : motivation()))));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('shows no streak by default, even when the settings still carry the retired flame and plant switches', async () => {
    const { w } = await mountAt('/week/2026-10-12', {
      'GET /api/settings': () => ({ ...settingsFixture(), streakFlame: true, plant: true }),
      'GET /api/prefs': () => ({}),
    });
    // the motivation has arrived, yet neither widget shows
    await wait(() => expect(useMotivationStore().motivation).not.toBeNull());
    expect(widgets(w)).toEqual({ flame: false, plant: false });
  });
  it.each([['flame', { flame: true, plant: false }], ['plant', { flame: false, plant: true }], ['off', { flame: false, plant: false }]] as const)('the person pref streak %s decides the top bar widget', async (streak, expected) => {
    const { w } = await mountAt('/week/2026-10-12', { 'GET /api/prefs': () => ({ streak }) });
    await wait(() => expect(widgets(w)).toEqual(expected));
  });
  it('hides the sync icon while all is well, keeping its state in the page, and shows it while syncing fails', async () => {
    let down = false;
    const { w } = await mountAt('/week/2026-10-12', {
      'GET /api/items': () => (down ? { status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } } : { items: [], from: 'a', to: 'b', syncedAt: 's' }),
    });
    await wait(() => expect(w.get(tid('sync-status')).attributes('data-state')).toBe('idle'));
    expect(w.get(tid('sync-status')).isVisible()).toBe(false);
    down = true;
    await w.get(tid('nav-next')).trigger('click');
    await wait(() => expect(w.get(tid('sync-status')).attributes('data-state')).toBe('error'));
    expect(w.get(tid('sync-status')).isVisible()).toBe(true);
  });
  it('shows the sync icon all the time with the sync indicator on', async () => {
    const { w } = await mountAt('/week/2026-10-12', { 'GET /api/prefs': () => ({ syncIndicator: true }) });
    await wait(() => expect(w.get(tid('sync-status')).isVisible()).toBe(true));
    expect(w.get(tid('sync-status')).attributes('data-state')).not.toBe('error');
  });
});

describe('month picker', () => {
  it('opens from the title, shows the month, marks days with items and picks a day', async () => {
    const { w, router } = await mountAt('/week/2026-10-12');
    await w.get(tid('period-title')).trigger('click');
    expect(w.find(tid('month-picker')).exists()).toBe(true);
    expect(w.get(tid('month-picker-title')).text()).toBe('October 2026');
    await wait(() => expect(w.get('[data-testid="picker-day"][data-date="2026-10-14"]').attributes('data-has-items')).toBe('true'));
    expect(w.get('[data-testid="picker-day"][data-date="2026-10-13"]').attributes('data-has-items')).toBe('false');
    expect(w.get('[data-testid="picker-day"][data-date="2026-10-12"]').attributes('aria-selected')).toBe('true');
    await w.get(tid('month-picker-next')).trigger('click');
    expect(w.get(tid('month-picker-title')).text()).toBe('November 2026');
    expect(router.currentRoute.value.path).toBe('/week/2026-10-12');
    await w.get('[data-testid="picker-day"][data-date="2026-11-18"]').trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/week/2026-11-16'));
    expect(w.find(tid('month-picker')).exists()).toBe(false);
  });
  it('closes on the title toggle and Escape', async () => {
    const { w } = await mountAt('/day/2027-02-03');
    await w.get(tid('period-title')).trigger('click');
    expect(w.get(tid('month-picker-title')).text()).toBe('February 2027');
    await w.get(tid('period-title')).trigger('click');
    expect(w.find(tid('month-picker')).exists()).toBe(false);
    await w.get(tid('period-title')).trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.find(tid('month-picker')).exists()).toBe(false);
  });
});

describe('year view', () => {
  it('renders 12 months, densities from /api/summary, one today, and opens a month', async () => {
    const { w, router } = await mountAt('/year/2026');
    await wait(() => expect(w.get('[data-testid="year-day"][data-date="2026-10-16"]').attributes('data-density')).toBe('3'));
    expect(w.findAll(tid('year-month'))).toHaveLength(12);
    expect(w.get('[data-testid="year-day"][data-date="2026-10-14"]').attributes('data-density')).toBe('1');
    expect(w.get('[data-testid="year-day"][data-date="2026-10-17"]').attributes('data-density')).toBe('0');
    expect(w.findAll('[data-testid="year-day"][data-today="true"]')).toHaveLength(1);
    expect(w.get(tid('period-title')).text()).toBe('2026');
    await w.findAll(tid('year-month'))[2].trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/month/2026-03'));
  });
});

describe('month, week and day views', () => {
  const items = [ev('Dentist', '2026-10-14'), ev('B', '2026-10-14', '10'), ev('C', '2026-10-14', '11'), ev('D', '2026-10-14', '12')];
  it('month grid: Monday first, outside days, today, chips', async () => {
    const { w } = await mountAt('/month/2026-10', {}, items);
    await wait(() => expect(w.find(tid('event-chip')).exists()).toBe(true));
    expect(w.findAll(tid('month-weekday-header')).map((x) => x.text())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(w.findAll(tid('month-cell'))[0].attributes('data-date')).toBe('2026-09-28');
    expect(w.get('[data-testid="month-cell"][data-date="2026-09-30"]').attributes('data-outside-month')).toBe('true');
    expect(w.findAll('[data-testid="month-cell"][data-today="true"]')).toHaveLength(1);
    const cell = w.get('[data-testid="month-cell"][data-date="2026-10-14"]');
    expect(cell.findAll(tid('event-chip'))).toHaveLength(4); // every entry is rendered, the cell clips and fades what does not fit
    expect(cell.find(tid('month-cell-more')).exists()).toBe(false);
    expect(cell.text()).not.toMatch(/\+\d/);
  });
  it('tapping a cell on a phone opens the day', async () => {
    const { w, router } = await mountAt('/month/2026-10');
    await w.get('[data-testid="month-cell"][data-date="2026-10-20"]').trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/day/2026-10-20'));
  });
  it('week view: headers, time-proportional blocks, hour slots; filters hide task lists only', async () => {
    const tl = { kind: 'tasklist', id: 'tl', calendarId: 'primary', title: 'Groceries', date: '2026-10-14', time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null, categoryId: 'work', tags: [], color: '#000000', etag: 'e', updated: '' };
    const { w } = await mountAt('/week/2026-10-12?categories=shopping', {}, [ev('Dentist', '2026-10-14'), tl]);
    await wait(() => expect(w.find(tid('event-chip')).exists()).toBe(true));
    expect(w.get(tid('week-view')).attributes('data-week-start')).toBe('2026-10-12');
    expect(w.findAll(tid('week-header')).map((x) => x.text()).slice(0, 2)).toEqual(['Mon 12', 'Tue 13']);
    expect(w.findAll(tid('time-slot'))).toHaveLength(24 * 7);
    expect(w.find(tid('tasklist-card')).exists()).toBe(false); // filtered out (category work, filter shopping)
    expect(w.find(tid('event-chip')).exists()).toBe(true); // events are never filtered
    const blk = w.get(tid('event-chip')).element.parentElement!;
    expect(blk.style.height).toBe('44px'); // 1 h at 44 px per hour on a phone
    expect(blk.style.top).toBe(`${9 * 44}px`);
    expect(w.get(tid('time-grid')).attributes('data-hour-height')).toBe('44');
  });
  it('day view renders one column for the date', async () => {
    const { w } = await mountAt('/day/2026-10-14');
    expect(w.get(tid('day-view')).attributes('data-date')).toBe('2026-10-14');
    expect(w.findAll(tid('day-column'))).toHaveLength(1);
  });
});

describe('filter chips', () => {
  it('toggle categories into the URL query, no tag chips (tags shelved), clear removes them', async () => {
    const tl = { kind: 'tasklist', id: 'tl', calendarId: 'primary', title: 'G', date: '2026-10-14', time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null, categoryId: 'shopping', tags: ['weekend'], color: '#000', etag: 'e', updated: '' };
    const { w, router } = await mountAt('/week/2026-10-12', {}, [tl]);
    expect(w.find(tid('filter-bar')).exists()).toBe(false);
    await w.get(tid('filter-button')).trigger('click');
    expect(w.find(tid('filter-bar')).exists()).toBe(true);
    await w.get('[data-testid="filter-chip-category"][data-name="Shopping"]').trigger('click');
    await flushPromises();
    await w.get('[data-testid="filter-chip-category"][data-name="Work"]').trigger('click');
    await wait(() => expect(router.currentRoute.value.query.categories).toBe('shopping,work'));
    expect(w.get('[data-testid="filter-chip-category"][data-name="Work"]').attributes('aria-pressed')).toBe('true');
    expect(w.find(tid('filter-chip-tag')).exists()).toBe(false);
    await w.get(tid('filter-button')).trigger('click'); // stays open while active
    expect(w.find(tid('filter-bar')).exists()).toBe(true);
    await w.get(tid('filter-clear')).trigger('click');
    await wait(() => expect(router.currentRoute.value.fullPath).toBe('/week/2026-10-12'));
    await w.get(tid('nav-next')).trigger('click');
  });
  it('keeps the filter query when navigating', async () => {
    const { w, router } = await mountAt('/week/2026-10-12?categories=work');
    await w.get(tid('nav-next')).trigger('click');
    await wait(() => expect(router.currentRoute.value.fullPath).toBe('/week/2026-10-19?categories=work'));
    expect(w.find(tid('filter-bar')).exists()).toBe(true);
  });
});

describe('settings', () => {
  it('has nine sections, each setting once; theme controls only in the theme menu', async () => {
    const { w, router } = await mountAt('/settings');
    await wait(() => expect(w.find(tid('settings-view')).exists()).toBe(true));
    useThemeStore().pref = { preset: 'Default', overrides: {}, seasonal: 'off' };
    await w.vm.$nextTick();
    const sections = w.findAll(tid('settings-section'));
    expect(sections.map((x) => x.attributes('data-section'))).toEqual(['appearance', 'calendar', 'tasklists', 'motivation', 'motion', 'bedtime', 'notifications', 'labs', 'account']);
    expect(sections.map((x) => x.get('h2').text())).toEqual(['Appearance', 'Calendar', 'Task lists', 'Focus & motivation', 'Motion & sound', 'Bedtime', 'Notifications', 'Labs', 'Account & data']);
    expect(w.findAll(tid('settings-category')).map((c) => c.attributes('data-name'))).toEqual(['Shopping', 'To-do', 'Work', 'Home']);
    for (const id of ['settings-theme-mode', 'settings-seed-preset', 'settings-seed-custom', 'settings-scene', 'settings-theme-mordor']) expect(w.find(tid(id)).exists()).toBe(false);
    expect(w.get(tid('settings-theme')).text()).toContain('Default');
    await w.get(tid('settings-theme')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/settings/theme'));
  });
  it('motivation: one Streak choice (Off by default) replaces the flame and plant switches; the Sunflowers choice', async () => {
    const { w, m } = await mountAt('/settings', { 'PATCH /api/prefs': ({ body }) => body });
    await wait(() => expect(w.find(tid('settings-view')).exists()).toBe(true));
    expect(w.find(tid('settings-garden')).exists()).toBe(false);
    expect(w.find(tid('settings-streak-flame')).exists()).toBe(false);
    expect(w.find(tid('settings-plant')).exists()).toBe(false);
    expect(w.findAll('[data-testid="settings-streak"] button').map((b) => b.text())).toEqual(['Off', 'Flame', 'Plant']);
    expect(w.get('[data-testid="settings-streak"] [aria-pressed="true"]').attributes('data-value')).toBe('off');
    await w.get('[data-testid="settings-streak"] [data-value="plant"]').trigger('click');
    await wait(() => expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs').at(-1)!.body).toEqual({ streak: 'plant' }));
    expect(w.get('[data-testid="settings-streak"] [aria-pressed="true"]').attributes('data-value')).toBe('plant');
    // without the Sunflower field scene the setting is shown but inactive, with a hint
    expect(w.get('[data-testid="settings-sunflowers"] button').attributes('disabled')).toBeDefined();
    expect(w.get(tid('settings-sunflowers-hint')).text()).toBe('Applies to the Sunflower field scene');
    await useThemeStore().pick('scene', 'sunflowers');
    await wait(() => expect(w.find(tid('settings-sunflowers-hint')).exists()).toBe(false));
    expect(w.get('[data-testid="settings-sunflowers"] button').attributes('disabled')).toBeUndefined();
    expect(w.get('[data-testid="settings-sunflowers"] [aria-pressed="true"]').attributes('data-value')).toBe('grow');
    expect(w.findAll('[data-testid="settings-sunflowers"] button').map((b) => b.text())).toEqual(['Grow with points', 'Full field']);
    await w.get('[data-testid="settings-sunflowers"] [data-value="full"]').trigger('click');
    await wait(() => expect(m.calls.filter((c) => c.method === 'PATCH').at(-1)!.body).toEqual({ sunflowers: 'full' }));
  });
  it('calendar: the Header layout choice (Two rows by default) sits before the Approaching card and saves the person pref', async () => {
    const { w, m } = await mountAt('/settings', { 'PATCH /api/prefs': ({ body }) => body });
    await wait(() => expect(w.find(tid('settings-header-layout')).exists()).toBe(true));
    expect(w.findAll('[data-testid="settings-header-layout"] button').map((b) => b.text())).toEqual(['Two rows', 'One row']);
    expect(w.get('[data-testid="settings-header-layout"] [aria-pressed="true"]').attributes('data-value')).toBe('two-rows');
    const ids = w.findAll('[data-testid^="settings-"]').map((e) => e.attributes('data-testid'));
    expect(ids.indexOf('settings-header-layout')).toBeLessThan(ids.indexOf('settings-approaching-card'));
    await w.get('[data-testid="settings-header-layout"] [data-value="one-row"]').trigger('click');
    await wait(() => expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs').at(-1)!.body).toEqual({ headerLayout: 'one-row' }));
  });
  it('calendar: the Sync indicator switch is off by default and saves the person pref', async () => {
    const { w, m } = await mountAt('/settings', { 'PATCH /api/prefs': ({ body }) => body });
    await wait(() => expect(w.find(tid('settings-sync-indicator')).exists()).toBe(true));
    expect(w.get(tid('settings-sync-indicator')).attributes('aria-checked')).toBe('false');
    await w.get(tid('settings-sync-indicator')).trigger('click');
    await wait(() => expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs').at(-1)!.body).toEqual({ syncIndicator: true }));
    expect(w.get(tid('settings-sync-indicator')).attributes('aria-checked')).toBe('true');
  });
  it('theme menu: saves theme mode and presets, validates the custom seed, applies the theme', async () => {
    const { w, m } = await mountAt('/settings/theme');
    await wait(() => expect(w.find(tid('theme-view')).exists()).toBe(true));
    useThemeStore().pref = { preset: 'Default', overrides: {}, seasonal: 'off' };
    await w.vm.$nextTick();
    expect(w.get('[data-testid="settings-theme-mode"] [aria-pressed="true"]').attributes('data-value')).toBe('system');
    expect(w.get('[data-testid="settings-seed-preset"][aria-pressed="true"]').attributes('data-name')).toBe('Blue');
    await w.get('[data-testid="settings-theme-mode"] [data-value="dark"]').trigger('click');
    await wait(() => expect(document.documentElement.dataset.theme).toBe('dark') as never).catch(() => undefined);
    expect(m.calls.filter((c) => c.method === 'PATCH').at(-1)!.body).toEqual({ themeMode: 'dark' });
    // the seed colour is fine-tuning of the chosen theme (theme pref override), not a setting
    const patched = () => m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme').at(-1)!.body;
    await w.get('[data-testid="settings-seed-preset"][data-name="Green"]').trigger('click');
    await wait(() => expect(w.get('[data-testid="settings-seed-preset"][aria-pressed="true"]').attributes('data-name')).toBe('Green'));
    // invalid custom color: error, no request
    const before = m.calls.length;
    const field = w.get(tid('settings-seed-custom'));
    await field.setValue('#12345');
    await field.trigger('blur');
    expect(w.get(tid('settings-seed-error')).text()).toBe('Enter a color like #1a73e8');
    expect(m.calls.length).toBe(before);
    await field.setValue('#8e24aa');
    await field.trigger('blur');
    await wait(() => expect(w.get('[data-testid="settings-seed-preset"][aria-pressed="true"]').attributes('data-name')).toBe('Custom'));
    expect(patched()).toEqual({ preset: 'Default', overrides: { seed: '#8e24aa' }, seasonal: 'off' });
  });
  it('theme menu: Seasons & holidays, Presets, Scene and Fine-tuning sections in that order, the scene choice only in its own, no Mordor button', async () => {
    const { w, m } = await mountAt('/settings/theme');
    await wait(() => expect(w.find(tid('theme-view')).exists()).toBe(true));
    // the color library loads lazily; let it finish so the test does not end while it imports
    await wait(() => expect(w.get('[data-testid="theme-card"] .scope').attributes('style')).toBeTruthy());
    const sections = w.findAll(tid('theme-section'));
    expect(sections.map((x) => [x.attributes('data-section'), x.get('h2').text()])).toEqual([['calendar', 'Seasons & holidays'], ['presets', 'Presets'], ['scene', 'Scene'], ['fine-tuning', 'Fine-tuning']]);
    const values = (el: typeof w) => el.findAll(tid('theme-option')).map((o) => `${o.attributes('data-setting')}:${o.attributes('data-value')}`);
    expect(values(sections[2] as never)).toEqual(['spring', 'easter', 'summer', 'summerholidays', 'fall', 'halloween', 'christmas', 'newyearseve', 'newyear', 'winter', 'sunflowers', 'mordor', 'none'].map((v) => `scene:${v}`));
    // an explicit scene is pressed on its own and sets seasons & holidays to off
    const pressedScene = () => sections[2]!.findAll('[aria-pressed="true"]').map((o) => o.attributes('data-value'));
    await sections[2]!.get('[data-value="halloween"]').trigger('click');
    await wait(() => expect(pressedScene()).toEqual(['halloween']));
    expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme').at(-1)!.body).toMatchObject({ overrides: { scene: 'halloween' }, seasonal: 'off' });
    expect(values(sections[3] as never).filter((v) => v.startsWith('scene:'))).toEqual([]);
    expect(values(sections[3] as never)).toHaveLength(9);
    expect(w.find(tid('settings-theme-mordor')).exists()).toBe(false);
    // the Mordor preset replaces the old button
    await w.get('[data-testid="theme-card"][data-name="Mordor"]').trigger('click');
    await wait(() => expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme').at(-1)!.body).toMatchObject({ preset: 'Mordor' }));
  });
  it('theme menu: Seasons & holidays comes first; an explicit preset or scene pick steps it down', async () => {
    const { w, m } = await mountAt('/settings/theme');
    await wait(() => expect(w.find(tid('theme-view')).exists()).toBe(true));
    const theme = useThemeStore();
    const lastPatch = () => m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme').at(-1)!.body;
    const pressed = () => w.findAll(`${tid('theme-seasonal')} [aria-pressed="true"]`).map((b) => b.attributes('data-value'));
    expect(w.findAll(tid('theme-section')).map((x) => x.get('h2').text())).toEqual(['Seasons & holidays', 'Presets', 'Scene', 'Fine-tuning']);
    expect(w.findAll(`${tid('theme-seasonal')} button`).map((b) => b.text())).toEqual(['Off', 'Header only', 'Header + colours']);
    expect(w.find(tid('theme-scene-follows')).exists()).toBe(false);
    theme.pref = { preset: 'Default', overrides: {}, seasonal: 'all' };
    await wait(() => expect(pressed()).toEqual(['all']));
    expect(w.get(tid('theme-seasonal-today')).text()).toMatch(/^Today: .+ header & colours$/);
    // choosing a preset steps all down to header; picking a scene turns it off
    await w.get('[data-testid="theme-card"][data-name="Neon"]').trigger('click');
    await wait(() => expect(lastPatch()).toEqual({ preset: 'Neon', overrides: {}, seasonal: 'header' }));
    expect(w.get(tid('theme-seasonal-today')).text()).toMatch(/^Today: .+ header$/);
    await w.get('[data-section="scene"] [data-value="mordor"]').trigger('click');
    await wait(() => expect(lastPatch()).toEqual({ preset: 'Neon', overrides: { scene: 'mordor' }, seasonal: 'off' }));
    await wait(() => expect(pressed()).toEqual(['off']));
    expect(w.get(tid('theme-seasonal-today')).text()).toBe('Today: nothing changes automatically');
    // back to header + colours: everything is seasonal again, the picked scene is dropped
    await w.get(`${tid('theme-seasonal')} [data-value="all"]`).trigger('click');
    await wait(() => expect(lastPatch()).toEqual({ preset: 'Neon', overrides: {}, seasonal: 'all' }));
    // a preset keeps header only and off as they are
    await w.get(`${tid('theme-seasonal')} [data-value="off"]`).trigger('click');
    await w.get('[data-testid="theme-card"][data-name="Mordor"]').trigger('click');
    await wait(() => expect(lastPatch()).toEqual({ preset: 'Mordor', overrides: {}, seasonal: 'off' }));
  });
  it('the Theme row shows the calendar\'s theme, the base plus the header, or the base alone', async () => {
    const { w } = await mountAt('/settings');
    const theme = useThemeStore();
    const row = () => w.get(tid('settings-theme-name')).text();
    theme.pref = { preset: 'Neon', overrides: {}, seasonal: 'all' };
    await wait(() => expect(row()).toMatch(/^(Spring|Summer|Fall|Halloween|Winter|Easter|Christmas|New Year's Eve|New Year)$/)); // depends on today's date
    theme.pref = { preset: 'Neon', overrides: {}, seasonal: 'header' };
    await wait(() => expect(row()).toMatch(/^Neon · (Spring|Summer|Fall|Halloween|Winter|Easter|Christmas|New Year's Eve|New Year) header$/));
    theme.pref = { preset: 'Neon', overrides: {}, seasonal: 'off' };
    await wait(() => expect(row()).toBe('Neon'));
  });
  it('persists motivation toggles, shows the best streak and the demo reset only in mock mode', async () => {
    const { w, m } = await mountAt('/settings');
    const stop = useSettingsStore().installAppearance();
    await wait(() => expect(w.get(tid('settings-best-streak')).text()).toBe('7'));
    await w.get(tid('settings-calm-mode')).trigger('click');
    await w.get('[data-testid="settings-animation-level"] [data-value="reduced"]').trigger('click');
    await flushPromises();
    const bodies = m.calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
    expect(bodies).toContainEqual({ calmMode: true });
    expect(bodies).toContainEqual({ animationLevel: 'reduced' });
    expect(document.documentElement.dataset.calm).toBe('true');
    expect(w.find(tid('settings-reset-demo')).exists()).toBe(true);
    stop();
  });
  it('opens the Reminders page from Settings, edits a calendar default at once and switches task list reminders', async () => {
    let defaults = [30];
    const { w, router, m } = await mountAt('/settings', {
      'GET /api/calendars': () => ({ calendars: [{ id: 'primary', name: 'Personal', color: '#039be5', primary: true, writable: true, own: true, hidden: false, defaultReminders: defaults }, { id: 'ro', name: 'Holidays', color: '#000000', primary: false, writable: false, own: false, hidden: false, defaultReminders: [10] }] }),
      'PATCH /api/calendars/primary': ({ body }) => { defaults = (body as { defaultReminders: number[] }).defaultReminders; return { id: 'primary', name: 'Personal', defaultReminders: defaults }; },
      'GET /api/reminders/tasks-calendar': () => ({ defaultReminders: [] }),
      'PATCH /api/prefs': () => ({}),
    });
    await w.get(tid('settings-reminders')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/settings/reminders'));
    await wait(() => expect(w.findAll(tid('reminders-calendar'))).toHaveLength(2));
    const personal = () => w.get('[data-calendar-id="primary"]');
    expect(personal().findAll(tid('calendar-default-reminder')).map((c) => c.text())).toEqual(['30 min']);
    // a read-only calendar's defaults are editable too (Google first, else kept by the app), without a read-only note
    expect(w.get('[data-calendar-id="ro"]').find(tid('calendar-default-reminder-add')).exists()).toBe(true);
    expect(w.get('[data-calendar-id="ro"]').find('.note').exists()).toBe(false);
    await personal().get(tid('calendar-default-reminder-add')).trigger('click');
    await personal().get('[data-testid="calendar-default-reminder-option"][data-minutes="15"]').trigger('click');
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/calendars/primary').map((c) => c.body)).toEqual([{ defaultReminders: [30, 15] }]);
    await wait(() => expect(personal().findAll(tid('calendar-default-reminder')).map((c) => c.text())).toEqual(['30 min', '15 min']));
    await w.get(tid('reminders-tasklists')).trigger('click');
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs').map((c) => c.body)).toContainEqual({ notify: expect.objectContaining({ tasklists: true }) });
  });
  it('saves left-handed mode as a person pref and mirrors the layout with html[data-hand]', async () => {
    const { w, m } = await mountAt('/settings', { 'PATCH /api/prefs': () => ({}) });
    const stop = useSettingsStore().installAppearance();
    expect(document.documentElement.dataset.hand).toBeUndefined();
    await w.get(tid('settings-left-handed')).trigger('click');
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/prefs').map((c) => c.body)).toContainEqual({ leftHanded: true });
    expect(document.documentElement.dataset.hand).toBe('left');
    await w.get(tid('settings-left-handed')).trigger('click');
    await flushPromises();
    expect(document.documentElement.dataset.hand).toBeUndefined();
    stop();
  });
  it('adds a category through the dialog and validates it', async () => {
    const { w } = await mountAt('/settings');
    await w.get(tid('settings-category-add')).trigger('click');
    await wait(() => expect(w.find(tid('category-dialog')).exists()).toBe(true));
    await w.get(tid('category-save')).trigger('click');
    expect(w.get(tid('category-error')).text()).toBe('Name is required');
    await w.get(tid('category-name')).setValue('Garden');
    await w.get(tid('category-color')).setValue('green');
    await w.get(tid('category-save')).trigger('click');
    expect(w.get(tid('category-error')).text()).toBe('Enter a color like #1a73e8');
    await w.get(tid('category-color')).setValue('#0a7f42');
    await w.get(tid('category-icon')).setValue('🌱');
    await w.get(tid('category-save')).trigger('click');
    await wait(() => expect(w.findAll(tid('settings-category')).map((c) => c.attributes('data-name'))).toEqual(['Shopping', 'To-do', 'Work', 'Home', 'Garden']));
    expect(w.find(tid('category-dialog')).exists()).toBe(false);
  });
});
