import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { addReminderSink, dueReminder, REMINDED_KEY, startBedtimeReminder, stopBedtimeReminder } from '@/features/bedtime/bedtimeReminder';
import { absMinutes, bedtimeWindows, DEFAULT_BEDTIME } from '@/features/bedtime/bedtime';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

const prefs = { ...DEFAULT_BEDTIME, enabled: true };
const windows = bedtimeWindows({ from: '2026-10-14', to: '2026-10-16' }, prefs, { get: () => [] });
const at = (hhmm: string) => absMinutes('2026-10-14', Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));

describe('dueReminder', () => {
  it('is due from the lead before bedtime until bedtime', () => {
    expect(dueReminder(windows, at('22:29'), 30)).toBeNull();
    expect(dueReminder(windows, at('22:30'), 30)).toEqual({ night: '2026-10-15', inMin: 30 });
    expect(dueReminder(windows, at('22:50'), 30)).toEqual({ night: '2026-10-15', inMin: 10 });
    expect(dueReminder(windows, at('23:00'), 30)).toBeNull();
  });

  it('never with a lead of 0 minutes', () => {
    expect(dueReminder(windows, at('22:59'), 0)).toBeNull();
  });
});

describe('startBedtimeReminder', () => {
  beforeEach(() => {
    localStorage.removeItem(REMINDED_KEY);
    freshPinia();
    stopBedtimeReminder();
  });

  const setup = (isoNow: string) => {
    const clock = useClockStore();
    clock.nowTick = Date.parse(isoNow);
    usePrefsStore().bedtime = { ...DEFAULT_BEDTIME, enabled: true };
    return clock;
  };

  it('shows the snackbar once per night, not again on the next ticks', async () => {
    const clock = setup('2026-10-14T22:30:00+02:00');
    const stop = startBedtimeReminder();
    const ui = useUiStore();
    expect(ui.snackbars.map((s) => [s.text, s.testid])).toEqual([['Bedtime in 30 minutes', 'bedtime-reminder']]);
    clock.nowTick = Date.parse('2026-10-14T22:31:00+02:00');
    await nextTick();
    expect(ui.snackbars).toHaveLength(1);
    expect(localStorage.getItem(REMINDED_KEY)).toBe('2026-10-15');
    stop();
  });

  it('stays quiet while the app is hidden and shows when it is visible again', async () => {
    const clock = setup('2026-10-14T22:40:00+02:00');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const stop = startBedtimeReminder();
    const ui = useUiStore();
    expect(ui.snackbars).toHaveLength(0);
    hidden.mockReturnValue(false);
    clock.nowTick = Date.parse('2026-10-14T22:41:00+02:00');
    await nextTick();
    expect(ui.snackbars.map((s) => s.text)).toEqual(['Bedtime in 19 minutes']);
    hidden.mockRestore();
    stop();
  });

  it('does not repeat a night that was reminded already on this device, and stays off when bedtime is off', () => {
    localStorage.setItem(REMINDED_KEY, '2026-10-15');
    setup('2026-10-14T22:30:00+02:00');
    const stop = startBedtimeReminder();
    expect(useUiStore().snackbars).toHaveLength(0);
    stop();
    localStorage.removeItem(REMINDED_KEY);
    usePrefsStore().bedtime = { ...DEFAULT_BEDTIME, enabled: false };
    const stop2 = startBedtimeReminder();
    expect(useUiStore().snackbars).toHaveLength(0);
    stop2();
  });

  it('hands the reminder to every sink, so push can hook in later', () => {
    setup('2026-10-14T22:45:00+02:00');
    const seen: number[] = [];
    const off = addReminderSink((r) => seen.push(r.inMin));
    const stop = startBedtimeReminder();
    expect(seen).toEqual([15]);
    off();
    stop();
  });
});
