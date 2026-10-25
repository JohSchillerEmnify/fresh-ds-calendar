/** The last known state (feature last-known-state, ADR 0023): merge, prune, save, restore, per person, wipe. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarItem } from '@/api/types';
import { memoryKv, PERSON_KEY, setLastKnownDb, wipeLastKnown } from '@/lib/lastKnownDb';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useAuthStore } from '@/stores/auth';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { mergeRange, pruneRanges, useLastKnownStore, type LastKnownSnapshot, type SavedRange } from '@/stores/lastKnown';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { mount } from '@vue/test-utils';
import LastUpdatedNote from '@/components/shell/LastUpdatedNote.vue';
import { config, eventFixture, freshPinia, mockFetch, settingsFixture } from './helpers';

const ev = (id: string, date: string, from = '10:00', to = '11:00') =>
  eventFixture(id, `${date}T${from}:00+02:00`, `${date}T${to}:00+02:00`) as unknown as CalendarItem;
const range = (from: string, to: string, items: CalendarItem[]): SavedRange => ({ from, to, items });
const tpl = (id: string, name: string) => ({ id, name, items: [{ title: 'x' }], estimateMinutes: null, categoryId: null });
const titles = (rs: SavedRange[]) => rs.flatMap((r) => r.items.map((i) => i.id)).sort();

describe('mergeRange', () => {
  it('a newer range replaces the items it covers in older ranges', () => {
    const month = range('2026-09-28', '2026-11-09', [ev('Dentist', '2026-10-13'), ev('Gone', '2026-10-14'), ev('Far', '2026-11-02')]);
    const week = range('2026-10-12', '2026-10-19', [ev('Dentist', '2026-10-13', '11:00', '12:00')]);
    const out = mergeRange([month], week);
    // "Gone" was deleted (not in the week answer, but on its days); "Far" is outside the week and stays
    expect(titles(out)).toEqual(['Dentist', 'Far']);
    expect(out.find((r) => r.from === '2026-10-12')!.items[0]).toMatchObject({ start: '2026-10-13T11:00:00+02:00' });
  });

  it('an item moved out of the newer range is taken from the older one too', () => {
    const month = range('2026-09-28', '2026-11-09', [ev('Call', '2026-10-13')]);
    const moved = ev('Call', '2026-10-30');
    const week = range('2026-10-12', '2026-10-19', []);
    const day = range('2026-10-30', '2026-10-31', [moved]);
    expect(titles(mergeRange(mergeRange([month], week), day))).toEqual(['Call']);
  });

  it('the same range is replaced, not duplicated', () => {
    const a = range('2026-10-12', '2026-10-19', [ev('A', '2026-10-13')]);
    const b = range('2026-10-12', '2026-10-19', [ev('B', '2026-10-13')]);
    const out = mergeRange([a], b);
    expect(out).toHaveLength(1);
    expect(titles(out)).toEqual(['B']);
  });
});

describe('pruneRanges', () => {
  it('keeps what lies within four weeks of today and drops the rest', () => {
    const old = range('2026-08-31', '2026-09-07', [ev('Old', '2026-09-01')]);
    const now = range('2026-10-12', '2026-11-30', [ev('Near', '2026-10-20'), ev('Later', '2026-11-20')]);
    const out = pruneRanges([old, now], '2026-10-12');
    expect(out.map((r) => r.from)).toEqual(['2026-10-12']);
    // 2026-11-09 is today + 28 days: the window ends before it
    expect(titles(out)).toEqual(['Near']);
  });
});

describe('last known state store', () => {
  let kv: ReturnType<typeof memoryKv>;
  let offline = false;
  const snapshot = () => kv.data.get('-') as LastKnownSnapshot | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    window.__appTimers = 0;
    localStorage.clear();
    kv = memoryKv();
    setLastKnownDb(kv);
    offline = false;
    freshPinia();
  });
  afterEach(() => {
    vi.useRealTimers();
    setLastKnownDb(null);
  });

  function server(items: () => unknown[]) {
    const net = (fn: () => unknown) => () => { if (offline) throw new TypeError('Failed to fetch'); return fn(); };
    return mockFetch({
      'GET /api/config': net(() => config()),
      'GET /api/auth/me': net(() => ({ email: null, name: null })),
      'GET /api/items': net(() => ({ items: items(), from: 'a', to: 'b', syncedAt: 'x' })),
      'GET /api/settings': net(() => settingsFixture({ themeMode: 'dark' })),
      'GET /api/prefs': net(() => ({ language: 'de' })),
      'GET /api/calendars': net(() => ({ calendars: [{ id: 'primary', name: 'Me', color: '#039be5', primary: true, hidden: false }] })),
      'GET /api/templates': net(() => ({ templates: [tpl('p', 'Packing'), tpl('w', 'Weekly shop')] })),
    });
  }

  /** One app session: loads like main.ts and App.vue do, shows the week, lets the debounced save run. */
  async function session(opts: { visit?: [string, string] } = {}) {
    const lk = useLastKnownStore();
    const shown = await lk.restore('/week/2026-10-12');
    lk.install();
    const loads = Promise.allSettled([useClockStore().load(), useSettingsStore().load(), useAuthStore().check(), usePrefsStore().load(), useCalendarsStore().load(), useTemplatesStore().load()]);
    if (!shown) await loads;
    const [from, to] = opts.visit ?? ['2026-10-12', '2026-10-19'];
    const sync = useSyncStore();
    await useItemsStore().setVisible(from, to).then(() => sync.markSynced(), () => undefined);
    await loads;
    await vi.advanceTimersByTimeAsync(1000);
    return { lk, shown };
  }

  it('saves nothing before a fresh answer, then the seen range, settings, prefs and calendars', async () => {
    offline = true;
    server(() => [ev('Dentist', '2026-10-13')]);
    await session();
    expect(snapshot()).toBeUndefined();

    offline = false;
    freshPinia();
    await session();
    const s = snapshot()!;
    expect(s.person).toBe('-');
    expect(titles(s.ranges)).toEqual(['Dentist']);
    expect(s.settings?.themeMode).toBe('dark');
    expect(s.prefs.language).toBe('de');
    expect(s.calendars.map((c) => c.id)).toEqual(['primary']);
    expect(s.savedAt).toBe(Date.parse('2026-10-12T06:00:00.000Z'));
    expect(localStorage.getItem(PERSON_KEY)).toBe('-');
    expect(document.documentElement.dataset.lastKnown).toBe('saved');
  });

  it('offline, the next start shows the saved state with its age, kept out of the loaded ranges', async () => {
    server(() => [ev('Dentist', '2026-10-13')]);
    await session();
    offline = true;
    freshPinia();
    const { lk, shown } = await session();
    expect(shown).toBe(true);
    expect(lk.restored).toBe(true);
    expect(lk.savedAt).toBe(Date.parse('2026-10-12T06:00:00.000Z'));
    const items = useItemsStore();
    expect(items.get('Dentist')).toBeTruthy();
    // only fresh data counts as loaded (reminders: windowLoaded)
    expect(Object.keys(items.ranges)).toEqual([]);
    expect(useSettingsStore().settings.themeMode).toBe('dark');
    expect(usePrefsStore().language).toBe('de');
    expect(useClockStore().today).toBe('2026-10-12');
    expect(useCalendarsStore().list).toHaveLength(1);
  });

  it('fresh data replaces the restored data and ends the "last updated" state', async () => {
    let list = [ev('Dentist', '2026-10-13'), ev('Gone', '2026-10-14')];
    server(() => list);
    await session();
    list = [ev('Dentist', '2026-10-13', '11:00', '12:00')];
    freshPinia();
    const { lk } = await session();
    const items = useItemsStore();
    expect(items.get('Dentist')).toMatchObject({ start: '2026-10-13T11:00:00+02:00' });
    expect(items.get('Gone')).toBeUndefined();
    expect(lk.restored).toBe(false);
    expect(titles(snapshot()!.ranges)).toEqual(['Dentist']);
  });

  it('a prefetched neighbour is not kept: only ranges that were shown are', async () => {
    server(() => [ev('Haircut', '2026-10-21')]);
    const lk = useLastKnownStore();
    await lk.restore('/week/2026-10-12');
    lk.install();
    await useClockStore().load();
    await useAuthStore().check();
    const items = useItemsStore();
    await items.setVisible('2026-10-12', '2026-10-19');
    useSyncStore().markSynced();
    await items.fetchRange('2026-10-19', '2026-10-26');
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshot()!.ranges.map((r) => r.from)).toEqual(['2026-10-12']);
  });

  it('keeps the templates, without one waiting for its undo time, and shows them offline at the next start', async () => {
    server(() => []);
    await session();
    expect(snapshot()!.templates!.map((x) => x.name)).toEqual(['Packing', 'Weekly shop']);
    usePendingDeletesStore().deleteTemplate('w', 'Weekly shop');
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshot()!.templates!.map((x) => x.name)).toEqual(['Packing']);
    offline = true;
    freshPinia();
    await session();
    const templates = useTemplatesStore();
    expect(templates.loaded).toBe(true);
    expect(templates.list.map((x) => x.name)).toEqual(['Packing']);
  });

  it('a template deleted just before the page goes away is written out of the snapshot at once', async () => {
    server(() => []);
    await session();
    usePendingDeletesStore().deleteTemplate('w', 'Weekly shop');
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshot()!.templates!.map((x) => x.name), 'still waiting for the debounce').toEqual(['Packing', 'Weekly shop']);
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshot()!.templates!.map((x) => x.name)).toEqual(['Packing']);
  });

  it('undoing a template deletion saves the template back into the snapshot', async () => {
    server(() => []);
    await session();
    const pending = usePendingDeletesStore();
    pending.deleteTemplate('w', 'Weekly shop');
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshot()!.templates!.map((x) => x.name)).toEqual(['Packing']);
    pending.undo();
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshot()!.templates!.map((x) => x.name)).toEqual(['Packing', 'Weekly shop']);
  });

  it('a snapshot from before templates were kept still restores, and the templates stay unread', async () => {
    server(() => []);
    localStorage.setItem(PERSON_KEY, '-');
    await kv.setOnly('-', { v: 1, person: '-', savedAt: 1, config: config(), settings: null, prefs: {}, calendars: [], themes: [], ranges: [] });
    expect(await useLastKnownStore().restore('/week/2026-10-12')).toBe(true);
    expect(useTemplatesStore().loaded).toBe(false);
  });

  it('restores only the snapshot of the person last signed in on this device', async () => {
    server(() => []);
    await kv.setOnly('anna@example.com', { v: 1, person: 'anna@example.com', savedAt: 1, config: config(), settings: null, prefs: {}, calendars: [], themes: [], ranges: [] });
    localStorage.setItem(PERSON_KEY, 'jo@example.com');
    expect(await useLastKnownStore().restore('/week/2026-10-12')).toBe(false);
  });

  it('a session of another person drops the restored data and the stored snapshot, then starts the page afresh', async () => {
    server(() => [ev('Dentist', '2026-10-13')]);
    await session();
    freshPinia();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    mockFetch({
      'GET /api/auth/me': () => ({ email: 'Anna@example.com', name: 'Anna' }),
      'GET /api/config': () => config(),
    });
    const lk = useLastKnownStore();
    await lk.restore('/week/2026-10-12');
    lk.install();
    expect(useItemsStore().get('Dentist')).toBeTruthy();
    await useAuthStore().check();
    await vi.advanceTimersByTimeAsync(10);
    expect(useItemsStore().get('Dentist')).toBeUndefined();
    expect(lk.restored).toBe(false);
    expect(lk.savedAt).toBeNull();
    expect(kv.data.size).toBe(0);
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('after a wipe a pending save writes nothing back', async () => {
    server(() => [ev('Dentist', '2026-10-13')]);
    await session();
    useItemsStore().upsert(ev('Call', '2026-10-14'));
    await wipeLastKnown();
    await vi.advanceTimersByTimeAsync(1000);
    expect(kv.data.size).toBe(0);
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
  });

  it('the sign-in page wipes what the device kept', async () => {
    server(() => [ev('Dentist', '2026-10-13')]);
    await session();
    expect(kv.data.size).toBe(1);
    freshPinia();
    expect(await useLastKnownStore().restore('/signin')).toBe(false);
    expect(kv.data.size).toBe(0);
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
  });

  it('wipeLastKnown clears the store and the person pointer', async () => {
    await kv.setOnly('-', { v: 1 });
    localStorage.setItem(PERSON_KEY, '-');
    await wipeLastKnown();
    expect(kv.data.size).toBe(0);
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
  });
});

describe('the "Last updated" note', () => {
  it('shows the time of the last update while the last known state is shown, and the day when it was not today', async () => {
    const pinia = freshPinia();
    useClockStore().restore(config() as never);
    const lk = useLastKnownStore();
    const w = mount(LastUpdatedNote, { global: { plugins: [pinia] } });
    expect(w.find('[data-testid="last-updated-note"]').exists()).toBe(false);
    lk.savedAt = Date.parse('2026-10-12T06:12:00Z');
    lk.restored = true;
    await w.vm.$nextTick();
    expect(w.get('[data-testid="last-updated-note"]').text()).toBe('Last updated 08:12');
    lk.savedAt = Date.parse('2026-10-10T18:05:00Z');
    await w.vm.$nextTick();
    expect(w.get('[data-testid="last-updated-note"]').text()).toBe('Last updated 10 Oct, 20:05');
    lk.restored = false;
    await w.vm.$nextTick();
    expect(w.find('[data-testid="last-updated-note"]').exists()).toBe(false);
    w.unmount();
  });
});
