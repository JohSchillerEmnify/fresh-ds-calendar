import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';
import { createAppRouter } from '@/router';
import { registerBuiltinExtensions } from '@/extensions/builtin';
import { useClockStore } from '@/stores/clock';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { config, eventFixture, freshPinia, mockFetch, settingsFixture } from './helpers';

const ev = (id: string, d: string, h = '09') => eventFixture(id, `${d}T${h}:00:00+02:00`, `${d}T${Number(h) + 1}:00:00+02:00`);
let wrapper: VueWrapper | null = null;
let server = settingsFixture();

async function mountAt(path: string, extra: Record<string, () => unknown> = {}, items: unknown[] = []) {
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
const wait = async (fn: () => void) => { await vi.waitFor(fn); await flushPromises(); };

beforeEach(() => { document.body.innerHTML = ''; });
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
    const s = useSettingsStore();
    await s.applyMordor();
    await flushPromises();
    await wait(() => expect(w.find(`${tid('top-bar-background')} [data-testid="scene-mordor"]`).exists()).toBe(true));
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
  it('has seven sections, each setting once; theme controls only in the theme menu', async () => {
    const { w, router } = await mountAt('/settings');
    await wait(() => expect(w.find(tid('settings-view')).exists()).toBe(true));
    const sections = w.findAll(tid('settings-section'));
    expect(sections.map((x) => x.attributes('data-section'))).toEqual(['appearance', 'calendar', 'tasklists', 'motivation', 'motion', 'labs', 'account']);
    expect(sections.map((x) => x.get('h2').text())).toEqual(['Appearance', 'Calendar', 'Task lists', 'Focus & motivation', 'Motion & sound', 'Labs', 'Account & data']);
    expect(w.findAll(tid('settings-category')).map((c) => c.attributes('data-name'))).toEqual(['Shopping', 'To-do', 'Work', 'Home']);
    for (const id of ['settings-theme-mode', 'settings-seed-preset', 'settings-seed-custom', 'settings-scene', 'settings-theme-mordor']) expect(w.find(tid(id)).exists()).toBe(false);
    expect(w.get(tid('settings-theme')).text()).toContain('Default');
    await w.get(tid('settings-theme')).trigger('click');
    await wait(() => expect(router.currentRoute.value.path).toBe('/settings/theme'));
  });
  it('theme menu: saves theme mode and presets, validates the custom seed, applies the theme', async () => {
    const { w, m } = await mountAt('/settings/theme');
    await wait(() => expect(w.find(tid('theme-view')).exists()).toBe(true));
    expect(w.get('[data-testid="settings-theme-mode"] [aria-pressed="true"]').attributes('data-value')).toBe('system');
    expect(w.get('[data-testid="settings-seed-preset"][aria-pressed="true"]').attributes('data-name')).toBe('Blue');
    await w.get('[data-testid="settings-theme-mode"] [data-value="dark"]').trigger('click');
    await wait(() => expect(document.documentElement.dataset.theme).toBe('dark') as never).catch(() => undefined);
    expect(m.calls.filter((c) => c.method === 'PATCH').at(-1)!.body).toEqual({ themeMode: 'dark' });
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
    expect(m.calls.at(-1)!.body).toEqual({ seedColor: '#8e24aa' });
  });
  it('Mordor shortcut (theme menu) sets seed and dark mode, and the theme scene', async () => {
    const { w, m } = await mountAt('/settings/theme');
    await wait(() => expect(w.find(tid('settings-theme-mordor')).exists()).toBe(true));
    await w.get(tid('settings-theme-mordor')).trigger('click');
    await wait(() => expect(m.calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(m.calls.find((c) => c.method === 'PATCH' && c.path === '/api/settings')!.body).toEqual({ seedColor: '#c43e00', themeMode: 'dark' });
    await wait(() => expect(m.calls.some((c) => c.method === 'PATCH' && c.path === '/api/prefs/theme')).toBe(true));
  });
  it('the Theme row shows the seasonal theme in use for Automatic and the preset name otherwise', async () => {
    const { w } = await mountAt('/settings');
    const theme = useThemeStore();
    theme.pref = { preset: 'Automatic', overrides: {} };
    await wait(() => expect(w.get(tid('settings-theme-name')).text()).toMatch(/^Automatic · (Spring|Summer|Fall|Halloween|Winter)$/)); // depends on today's season
    theme.pref = { preset: 'Neon', overrides: {} };
    await wait(() => expect(w.get(tid('settings-theme-name')).text()).toBe('Neon'));
  });
  it('persists motivation toggles, shows the best streak and the demo reset only in mock mode', async () => {
    const { w, m } = await mountAt('/settings');
    const stop = useSettingsStore().installAppearance();
    await wait(() => expect(w.get(tid('settings-best-streak')).text()).toBe('7'));
    await w.get(tid('settings-calm-mode')).trigger('click');
    await w.get('[data-testid="settings-animation-level"] [data-value="reduced"]').trigger('click');
    await w.get('[data-testid="settings-transition-warning"] [data-value="5"]').trigger('click');
    await flushPromises();
    const bodies = m.calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
    expect(bodies).toContainEqual({ calmMode: true });
    expect(bodies).toContainEqual({ animationLevel: 'reduced' });
    expect(bodies).toContainEqual({ transitionWarningMinutes: 5 });
    expect(document.documentElement.dataset.calm).toBe('true');
    expect(w.find(tid('settings-reset-demo')).exists()).toBe(true);
    stop();
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
