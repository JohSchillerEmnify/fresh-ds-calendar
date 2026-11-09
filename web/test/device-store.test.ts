/** The device store (ADR 0025): sync, restore, reads from it, the window, per person, wipe, the "Last updated" note. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import LastUpdatedNote from '@/components/shell/LastUpdatedNote.vue';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { useTaskListsStore } from '@/features/tasklists/store';
import { useTasksViewStore } from '@/features/tasklists/tasksStore';
import type { CalendarEvent, TaskList } from '@/api/types';
import type { ChangeSet, DeviceData } from '@/lib/deviceData';
import { memoryKv, PERSON_KEY, setDeviceDb, wipeDevice } from '@/lib/deviceDb';
import { useAuthStore } from '@/stores/auth';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { changesFixture, config, eventFixture, freshPinia, mockFetch, settingsFixture } from './helpers';

const ev = (id: string, date: string, from = '10:00', to = '11:00'): CalendarEvent =>
  eventFixture(id, `${date}T${from}:00+02:00`, `${date}T${to}:00+02:00`) as unknown as CalendarEvent;
const list = (id: string, date: string | null, title = id): TaskList => ({
  kind: 'tasklist', id, calendarId: 'tasks', title, date, time: null, items: [{ id: 'i1', title: 'Milk', done: false }], doneCount: 0, totalCount: 1,
  estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#000', calendarColor: '#000',
  completedOn: null, canvas: null, etag: 'e', updated: '2026-10-12T08:00:00+02:00',
});
const tpl = (id: string, name: string) => ({ id, name, items: [{ title: 'x' }], estimateMinutes: null, categoryId: null });
const cal = { id: 'primary', name: 'Me', color: '#039be5', primary: true, hidden: false, writable: true, defaultReminders: [] };

describe('the device store', () => {
  let kv: ReturnType<typeof memoryKv>;
  let offline = false;
  let events: CalendarEvent[] = [];
  let lists: TaskList[] = [];
  let calls: { path: string }[] = [];
  const stored = (k: string) => kv.data.get(k) as (DeviceData & Record<string, unknown>) | undefined;

  const answer = (): ChangeSet => ({
    full: true, cursor: 'c1', window: { from: '2025-10-12', to: '2027-10-13' }, calendars: [cal],
    events: { calendars: ['primary'], replace: [], series: [], removed: [], upserts: events.filter((e) => e.start < '2027-10-13'), failed: [] },
    taskLists: { replace: true, series: [], removed: [], upserts: lists, failed: false },
    files: {
      settings: settingsFixture({ themeMode: 'dark' }), prefs: { language: 'de' }, themes: { themes: [] },
      templates: { templates: [tpl('p', 'Packing')] }, canvas: { areas: [{ id: 'a', name: 'Haus', color: '#0b8043', x: 0, y: 0, w: 100, h: 100 }] },
    },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    window.__appTimers = 0;
    localStorage.clear();
    kv = memoryKv();
    setDeviceDb(kv);
    offline = false;
    events = [ev('Dentist', '2026-10-13')];
    lists = [list('Visa', '2025-06-02'), list('Taxes', null)];
    calls = [];
    freshPinia();
  });
  afterEach(() => {
    vi.useRealTimers();
    setDeviceDb(null);
  });

  function server() {
    const net = (fn: () => unknown) => () => { if (offline) throw new TypeError('Failed to fetch'); return fn(); };
    const m = mockFetch({
      'GET /api/config': net(() => config()),
      'GET /api/auth/me': net(() => ({ email: null, name: null })),
      'GET /api/changes': net(() => answer()),
      'GET /api/items': net(() => ({ items: [ev('Wedding', '2027-11-20')], from: 'a', to: 'b', syncedAt: 'x' })),
      'GET /api/summary': net(() => ({ days: {} })),
    });
    calls = m.calls;
    return m;
  }

  /** One app session as main.ts and App.vue start it, then lets the debounced save run. */
  async function session(visit: [string, string] = ['2026-10-12', '2026-10-19']) {
    const device = useDeviceStore();
    const shown = await device.restore('/week/2026-10-12');
    device.install();
    await Promise.allSettled([useClockStore().load(), useAuthStore().check()]);
    await useSyncStore().syncNow('open').catch(() => undefined);
    await useItemsStore().setVisible(...visit).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1000);
    return { device, shown };
  }
  const requested = (path: string) => calls.filter((c) => c.path === path).length;

  it('takes in the first full answer: every kind is handed to its store and written to the device', async () => {
    server();
    await session();
    expect(useItemsStore().get('Dentist')).toBeTruthy();
    expect(useSettingsStore().settings.themeMode).toBe('dark');
    expect(usePrefsStore().language).toBe('de');
    expect(useCalendarsStore().list.map((c) => c.id)).toEqual(['primary']);
    expect(useTemplatesStore().list.map((t) => t.name)).toEqual(['Packing']);
    expect(stored('meta')!.person).toBe('-');
    expect(stored('meta')!.cursor).toBe('c1');
    expect(stored('meta')!.config).toMatchObject({ timeZone: 'Europe/Berlin' });
    expect((stored('events') as unknown as CalendarEvent[]).map((e) => e.id)).toEqual(['Dentist']);
    expect((stored('lists') as unknown as TaskList[]).map((l) => l.id).sort()).toEqual(['Taxes', 'Visa']);
    expect(localStorage.getItem(PERSON_KEY)).toBe('-');
    expect(document.documentElement.dataset.deviceStore).toBe('synced');
    expect(document.documentElement.dataset.deviceSyncedAt).toBe(String(Date.parse('2026-10-12T06:00:00.000Z')));
  });

  it('shows a range inside the window from the device without asking for items or counts', async () => {
    server();
    await session();
    expect(requested('/api/items')).toBe(0);
    await useItemsStore().loadSummary('2026-10-01', '2026-11-01');
    expect(useItemsStore().summary['2026-10-13']!.events).toBe(1);
    expect(requested('/api/summary')).toBe(0);
  });

  it('loads a range outside the window from the server and does not keep it', async () => {
    server();
    await session();
    await useItemsStore().setVisible('2027-11-01', '2027-12-01');
    expect(requested('/api/items')).toBe(1);
    expect(useItemsStore().get('Wedding')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1000);
    expect((stored('events') as unknown as CalendarEvent[]).map((e) => e.id)).toEqual(['Dentist']);
  });

  it('offline, a window range shows from the device and a range outside it is empty, with the banner for the failed sync', async () => {
    server();
    await session();
    offline = true;
    freshPinia();
    const { device, shown } = await session();
    expect(shown).toBe(true);
    expect(device.noteShown).toBe(true);
    expect(device.syncedAt).toBe(Date.parse('2026-10-12T06:00:00.000Z'));
    expect(useItemsStore().get('Dentist')).toBeTruthy();
    expect(useClockStore().today).toBe('2026-10-12');
    expect(useSyncStore().state).toBe('error');
    await expect(useItemsStore().setVisible('2027-11-01', '2027-12-01')).rejects.toThrow();
    expect(useItemsStore().all.some((i) => i.id === 'Wedding')).toBe(false);
  });

  it('every task list is on the device, dated or not, also an old one, and the Tasks view lists them offline', async () => {
    server();
    await session();
    offline = true;
    freshPinia();
    await session();
    const tasks = useTasksViewStore();
    await tasks.refresh();
    expect(tasks.lists.map((l) => l.id).sort()).toEqual(['Taxes', 'Visa']);
    expect(requested('/api/tasklists/all-open')).toBe(0);
  });

  it('the tray is worked out on the device', async () => {
    lists = [list('Recent', '2026-10-10')];
    server();
    await session();
    await useTaskListsStore().refresh();
    expect(useTaskListsStore().tray.map((l) => l.id)).toEqual(['Recent']);
    expect(requested('/api/tasklists/open')).toBe(0);
  });

  it('a later sync brings changes made elsewhere, and a failed one keeps the data and the old time', async () => {
    server();
    const { device } = await session();
    expect(device.noteShown).toBe(false);
    const first = device.syncedAt;
    mockFetch({
      'GET /api/changes': () => ({
        ...answer(), full: false, cursor: 'c2',
        events: { calendars: ['primary'], replace: [], series: [], failed: [], removed: [{ calendarId: 'primary', id: 'Dentist' }], upserts: [ev('Flight', '2027-03-01')] },
        taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false },
        files: { prefs: { language: 'en' } },
      }),
      'GET /api/config': () => config(),
      'GET /api/summary': () => ({ days: {} }),
    });
    await vi.advanceTimersByTimeAsync(5000);
    await useSyncStore().syncNow('focus');
    expect(useItemsStore().get('Dentist')).toBeUndefined();
    expect(usePrefsStore().language).toBe('en');
    expect(device.data!.events.map((e) => e.id)).toEqual(['Flight']);
    expect(device.syncedAt).toBeGreaterThanOrEqual(first!);
    const at = device.syncedAt;
    mockFetch({ 'GET /api/changes': () => { throw new TypeError('Failed to fetch'); }, 'GET /api/config': () => { throw new TypeError('x'); } });
    await useSyncStore().syncNow('focus').catch(() => undefined);
    expect(device.failed).toBe(true);
    expect(device.noteShown).toBe(true);
    expect(device.syncedAt).toBe(at);
    expect(device.data!.events.map((e) => e.id)).toEqual(['Flight']);
  });

  it('the note shows until a complete sync succeeded since the app opened', async () => {
    server();
    await session();
    offline = true;
    freshPinia();
    const { device } = await session();
    expect(device.noteShown).toBe(true);
    offline = false;
    server();
    await useSyncStore().syncNow('online');
    expect(device.noteShown).toBe(false);
  });

  it('an incomplete answer (a calendar failed) keeps the old time and counts as a failed sync', async () => {
    server();
    const { device } = await session();
    const at = device.syncedAt;
    await vi.advanceTimersByTimeAsync(5000);
    device.take({ ...answer(), full: false, events: { ...answer().events, failed: ['primary'] } });
    expect(device.syncedAt).toBe(at);
    expect(device.noteShown).toBe(true);
  });

  it('a change goes into the device copy at once; the server\'s answer replaces it; a delete leaves it', async () => {
    server();
    await session();
    const items = useItemsStore();
    const out = useOutboxStore();
    mockFetch({
      'POST /api/events': () => ev('New', '2026-10-14'),
      'DELETE /api/events/Dentist': () => ({ status: 204 }),
    });
    out.saveEvent(ev('New', '2026-10-14') as never, { title: 'New' } as never, true);
    expect(useDeviceStore().data!.events.map((e) => e.title).sort()).toEqual(['Dentist', 'New']);
    await flushPromises();
    expect(useDeviceStore().data!.events.map((e) => e.id).sort()).toEqual(['Dentist', 'New']);
    out.deleteEvent(items.get('Dentist') as never);
    expect(useDeviceStore().data!.events.map((e) => e.id)).toEqual(['New']);
  });

  it('an answer with nothing in it neither rewrites the lists nor hands the data on again', async () => {
    server();
    const { device } = await session();
    const events = device.data!.events, lists = device.data!.taskLists;
    const hydrated = vi.spyOn(useItemsStore(), 'refreshFromDevice');
    kv.data.delete('events');
    await vi.advanceTimersByTimeAsync(5000);
    device.take({ ...answer(), full: false, cursor: 'c2', events: { ...answer().events, replace: [], upserts: [] }, taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false }, files: {} });
    await vi.advanceTimersByTimeAsync(100);
    expect(device.data!.events).toBe(events);
    expect(device.data!.taskLists).toBe(lists);
    expect(hydrated).not.toHaveBeenCalled();
    expect(stored('meta')!.cursor).toBe('c2');
    expect(kv.data.has('events')).toBe(false);
  });

  it('a conflict re-reads the server state: the resync brings the fresh etag, not the stale device copy', async () => {
    server();
    await session();
    const items = useItemsStore();
    await items.setVisible('2026-10-12', '2026-10-19');
    expect(items.get('Dentist')!.etag).toBe('etag-Dentist');
    const fresh = { ...ev('Dentist', '2026-10-13'), etag: 'etag-2' };
    mockFetch({
      'GET /api/changes': () => ({ ...answer(), full: false, cursor: 'c2', events: { calendars: ['primary'], replace: [], series: [], removed: [], failed: [], upserts: [fresh] }, taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false }, files: {} }),
      'GET /api/summary': () => ({ days: {} }),
    });
    await useSyncStore().resyncAfterWrite();
    expect(items.get('Dentist')!.etag).toBe('etag-2');
  });

  it('a category change survives a restart before its full re-read: the restored device still asks for everything', async () => {
    server();
    const { device } = await session();
    device.requestFull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(stored('meta')!.needFull).toBe(true);
    freshPinia();
    const m = server();
    const restored = useDeviceStore();
    await restored.restore('/week/2026-10-12');
    await restored.sync();
    expect(m.calls.filter((c) => c.path === '/api/changes').map((c) => c.url.searchParams.has('cursor'))).toEqual([false]);
    expect(restored.data!.needFull).toBeUndefined();
  });

  it('an answer is not used when the session turns out to be another person than the stored one', async () => {
    server();
    await session();
    freshPinia();
    useAuthStore().status = 'unknown';
    const m = mockFetch({
      'GET /api/auth/me': () => ({ email: 'anna@example.com', name: 'Anna' }),
      'GET /api/config': () => config(),
      'GET /api/changes': () => answer(),
    });
    const device = useDeviceStore();
    await device.restore('/week/2026-10-12');
    const before = device.data;
    await expect(device.sync()).resolves.toBeUndefined();
    expect(m.calls.map((c) => c.path)).toContain('/api/auth/me');
    expect(device.data).toBe(before);
  });

  it('an answer is not applied to restored data while the session is unknown', async () => {
    server();
    await session();
    freshPinia();
    useAuthStore().status = 'unknown';
    const m = mockFetch({
      'GET /api/auth/me': () => ({ status: 500, body: { error: { code: 'INTERNAL', message: 'x' } } }),
      'GET /api/config': () => config(),
      'GET /api/changes': () => ({ ...answer(), full: false, cursor: 'c9', events: { ...answer().events, upserts: [ev('Intruder', '2026-10-14')] }, taskLists: { replace: false, series: [], removed: [], upserts: [], failed: false }, files: {} }),
    });
    const device = useDeviceStore();
    await device.restore('/week/2026-10-12');
    await device.sync();
    expect(useAuthStore().status).toBe('unknown');
    expect(m.calls.map((c) => c.path)).toContain('/api/changes');
    expect(device.data!.cursor).toBe('c1');
    expect(device.data!.events.map((e) => e.id)).toEqual(['Dentist']);
  });

  it('a first sync with nobody stored works once the session is known', async () => {
    server();
    const device = useDeviceStore();
    await device.sync();
    expect(device.ready).toBe(true);
  });

  it('a full answer with a calendar that failed keeps that calendar\'s stored events', async () => {
    server();
    const { device } = await session();
    await vi.advanceTimersByTimeAsync(5000);
    device.take({
      ...answer(), cursor: 'c3',
      events: { calendars: ['primary', 'work'], replace: ['work'], series: [], removed: [], failed: ['primary'], upserts: [ev('Other', '2026-10-15')] },
    });
    expect(device.data!.events.map((e) => e.id).sort()).toEqual(['Dentist', 'Other']);
  });

  it('drops an answer that was on its way when the device was wiped', async () => {
    let release!: () => void;
    const m = server();
    const gate = new Promise<void>((r) => { release = r; });
    mockFetch({
      'GET /api/config': () => config(), 'GET /api/auth/me': () => ({ email: null, name: null }),
      'GET /api/changes': async () => { await gate; return answer(); },
    });
    const device = useDeviceStore();
    await useAuthStore().check();
    const p = device.sync();
    await vi.advanceTimersByTimeAsync(10);
    await wipeDevice();
    release();
    await p;
    expect(device.data).toBeNull();
    expect(kv.data.size).toBe(0);
    expect(m.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('a start before the first sync reads from the server as before', async () => {
    server();
    expect(useDeviceStore().ready).toBe(false);
    await useItemsStore().setVisible('2026-10-12', '2026-10-19');
    expect(requested('/api/items')).toBe(1);
  });

  it('a hanging IndexedDB does not keep the app from starting', async () => {
    localStorage.setItem(PERSON_KEY, '-');
    setDeviceDb({ get: () => new Promise(() => undefined), putMany: async () => undefined, clear: async () => undefined });
    const p = useDeviceStore().restore('/week/2026-10-12');
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toBe(false);
  });

  it('a broken IndexedDB keeps the app working from memory', async () => {
    setDeviceDb({ get: async () => { throw new Error('blocked'); }, putMany: async () => { throw new Error('quota'); }, clear: async () => undefined });
    server();
    await session();
    expect(useItemsStore().get('Dentist')).toBeTruthy();
    expect(useDeviceStore().ready).toBe(true);
  });

  it('restores only the data of the person last signed in on this device', async () => {
    server();
    await session();
    freshPinia();
    localStorage.setItem(PERSON_KEY, 'anna@example.com');
    expect(await useDeviceStore().restore('/week/2026-10-12')).toBe(false);
  });

  it('a session of another person drops what was shown and the stored data, then starts the page afresh', async () => {
    server();
    await session();
    freshPinia();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    mockFetch({ 'GET /api/auth/me': () => ({ email: 'Anna@example.com', name: 'Anna' }), 'GET /api/config': () => config() });
    const device = useDeviceStore();
    await device.restore('/week/2026-10-12');
    device.install();
    await useItemsStore().setVisible('2026-10-12', '2026-10-19');
    expect(useItemsStore().get('Dentist')).toBeTruthy();
    await useAuthStore().check();
    await vi.advanceTimersByTimeAsync(10);
    expect(useItemsStore().get('Dentist')).toBeUndefined();
    expect(device.data).toBeNull();
    expect(kv.data.size).toBe(0);
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('after a wipe a pending save writes nothing back, and the cached theme goes too', async () => {
    server();
    await session();
    localStorage.setItem('cal.theme', '{}');
    useItemsStore().upsert(ev('Call', '2026-10-14'));
    await wipeDevice();
    await vi.advanceTimersByTimeAsync(1000);
    expect(kv.data.size).toBe(0);
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
    expect(localStorage.getItem('cal.theme')).toBeNull();
  });

  it('the sign-in page wipes what the device kept', async () => {
    server();
    await session();
    expect(kv.data.size).toBeGreaterThan(0);
    freshPinia();
    expect(await useDeviceStore().restore('/signin')).toBe(false);
    expect(kv.data.size).toBe(0);
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
  });
});

describe('the "Last updated" note', () => {
  it('shows the time of the last complete sync, and the day when it was not today', async () => {
    const pinia = freshPinia();
    useClockStore().restore(config() as never);
    const device = useDeviceStore();
    const w = mount(LastUpdatedNote, { global: { plugins: [pinia] } });
    expect(w.find('[data-testid="last-updated-note"]').exists()).toBe(false);
    device.data = { v: 2, person: '-', cursor: 'c', syncedAt: Date.parse('2026-10-12T06:12:00Z'), window: null, config: null, calendars: [], events: [], taskLists: [], files: {} };
    await w.vm.$nextTick();
    expect(w.get('[data-testid="last-updated-note"]').text()).toBe('Last updated 08:12');
    device.data = { ...device.data, syncedAt: Date.parse('2026-10-10T18:05:00Z') };
    await w.vm.$nextTick();
    expect(w.get('[data-testid="last-updated-note"]').text()).toBe('Last updated 10 Oct, 20:05');
    device.fresh = true;
    await w.vm.$nextTick();
    expect(w.find('[data-testid="last-updated-note"]').exists()).toBe(false);
    device.failed = true;
    await w.vm.$nextTick();
    expect(w.find('[data-testid="last-updated-note"]').exists()).toBe(true);
    w.unmount();
  });
});

describe('categories', () => {
  it('a change of the categories on another device makes the next sync a full one', async () => {
    freshPinia();
    vi.useFakeTimers();
    setDeviceDb(memoryKv());
    const full = { ...changesFixture({ cursor: 'c1' }), files: { settings: settingsFixture() } };
    const m = mockFetch({ 'GET /api/changes': () => full, 'GET /api/auth/me': () => ({ email: null, name: null }) });
    const device = useDeviceStore();
    await device.sync();
    full.full = false;
    (full.files as { settings: unknown }).settings = settingsFixture({ categories: [{ id: 'x', name: 'X', color: '#111111', icon: null, googleColorId: '1' }] });
    full.cursor = 'c2';
    await device.sync();
    const urls = m.calls.filter((c) => c.path === '/api/changes').map((c) => c.url.search);
    expect(urls[1]).toContain('cursor=c1');
    expect(urls[2]).not.toContain('cursor');
    vi.useRealTimers();
    setDeviceDb(null);
  });
});
