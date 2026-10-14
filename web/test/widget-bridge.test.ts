import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Owner bug 2026-10-14: the widget flashed and showed hidden calendars. The bridge pushes only changed, hidden-free snapshots. */
let setSnapshot: ReturnType<typeof vi.fn>;
let hiddenIds: string[];
let onSynced: () => Promise<void>;
let useCalendarsStore: typeof import('@/stores/calendars').useCalendarsStore;

const cal = (id: string, hidden: boolean) => ({ id, summary: id, backgroundColor: '#039be5', primary: id === 'primary', accessRole: 'owner', hidden });
const titles = (call: number) => (JSON.parse(setSnapshot.mock.calls[call][0].json).days as { events: { title: string }[] }[]).flatMap((d) => d.events.map((e) => e.title));

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-10-14T08:30:00Z') });
  vi.resetModules(); // a fresh bridge module (and so no remembered last push) per test, with the helpers and stores from the same registry
  const { config, eventFixture, freshPinia, mockFetch } = await import('./helpers');
  ({ useCalendarsStore } = await import('@/stores/calendars'));
  const { useClockStore } = await import('@/stores/clock');
  freshPinia();
  hiddenIds = ['work'];
  setSnapshot = vi.fn(async () => ({}));
  (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { WidgetBridge: { setSnapshot } } };
  mockFetch({
    'GET /api/config': () => config({ now: '2026-10-14T10:30:00+02:00' }),
    'GET /api/calendars': () => ({ calendars: [cal('primary', false), cal('work', hiddenIds.includes('work'))] }),
    'GET /api/items': () => ({
      items: [
        eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00', { title: 'Mine' }),
        eventFixture('b', '2026-10-14T11:00:00+02:00', '2026-10-14T12:00:00+02:00', { title: 'Work thing', calendarId: 'work' }),
      ],
      from: 'a', to: 'b', syncedAt: 'x',
    }),
  });
  await useClockStore().load();
  ({ onSynced } = await import('@/native/widgetBridge'));
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('widget bridge', () => {
  it('leaves out hidden calendars even when the first push comes before the calendar list was loaded (app start)', async () => {
    expect(useCalendarsStore().list).toEqual([]);
    await onSynced();
    expect(setSnapshot).toHaveBeenCalledTimes(1);
    expect(titles(0)).toEqual(['Mine']);
  });

  it('does not push again when only the time moved on (a clock tick or the next poll)', async () => {
    await onSynced();
    vi.setSystemTime(new Date('2026-10-14T08:30:30Z'));
    await onSynced();
    vi.advanceTimersByTime(5000);
    await onSynced();
    expect(setSnapshot).toHaveBeenCalledTimes(1);
  });

  it('pushes again when a calendar is shown again', async () => {
    await onSynced();
    hiddenIds = [];
    await useCalendarsStore().load();
    await onSynced();
    expect(setSnapshot).toHaveBeenCalledTimes(2);
    expect(titles(1)).toEqual(['Mine', 'Work thing']);
  });
});
