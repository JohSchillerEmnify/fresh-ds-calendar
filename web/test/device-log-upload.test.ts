/** Sending the error log to the server and the crash records of the Android app (feature device-log). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDeviceLog, deviceLog, logDevice } from '@/lib/deviceLog';
import { crashEntry, importCrashRecords } from '@/native/crashReports';
import { sendDeviceLog, sendNewEntries, sendNewEntriesIfOn } from '@/lib/deviceLogUpload';
import { usePrefsStore } from '@/stores/prefs';
import { api } from '@/api/client';
import { freshPinia } from './helpers';

const sent = (): Array<{ entries: Array<{ summary: string; sent?: boolean }> }> => vi.mocked(api.diagDeviceLog).mock.calls.map((c) => c[0] as never);

beforeEach(() => {
  localStorage.clear();
  clearDeviceLog();
  vi.restoreAllMocks();
  vi.spyOn(api, 'diagDeviceLog').mockResolvedValue(undefined);
  freshPinia();
});

describe('automatic sending', () => {
  it('sends nothing while the pref is off, and only entries the server does not have yet when on', async () => {
    logDevice('error', { name: 'Error', message: 'first' });
    await sendNewEntriesIfOn(true);
    expect(api.diagDeviceLog).not.toHaveBeenCalled();

    usePrefsStore().sendReportsAuto = true;
    await sendNewEntriesIfOn(true);
    logDevice('error', { name: 'Error', message: 'second' });
    await sendNewEntriesIfOn(true);
    expect(sent().map((b) => b.entries.map((e) => e.summary))).toEqual([['Error: first'], ['Error: second']]);
    expect(sent().every((b) => b.entries.every((e) => !('sent' in e)))).toBe(true);

    usePrefsStore().sendReportsAuto = false;
    logDevice('error', { name: 'Error', message: 'third' });
    await sendNewEntriesIfOn(true);
    expect(api.diagDeviceLog).toHaveBeenCalledTimes(2);
  });

  it('keeps an entry unsent when the upload fails, and the failed request is not sent as news', async () => {
    const { ApiError } = await import('@/api/client');
    logDevice('error', { name: 'Error', message: 'first' });
    vi.mocked(api.diagDeviceLog).mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    expect(await sendNewEntries()).toBe('failed');
    logDevice('api', { method: 'POST', route: '/api/diag/device-log', status: 0 });
    expect(await sendNewEntries()).toBe('sent');
    expect(sent()[1]!.entries.map((e) => e.summary)).toEqual(['Error: first']);
    expect(await sendNewEntries()).toBe('nothing');
  });

  it('the button sends the whole log, sent entries included', async () => {
    logDevice('error', { name: 'Error', message: 'first' });
    await sendNewEntries();
    await sendDeviceLog();
    expect(sent()[1]!.entries).toHaveLength(1);
  });
});

describe('crash records', () => {
  it('become crash entries with class and frames and without any message', () => {
    const e = crashEntry({ source: 'java', exception: 'java.lang.IllegalStateException', message: 'Dentist Meyer', causes: ['java.lang.RuntimeException'],
      frames: ['lan.mordor.calendar.widget.WeekFetcher.fetch(WeekFetcher.java:50)', 'Dentist Meyer at 10:00'], thread: 'main', app: '1.1.9', android: 35, time: 1_760_000_000_000 } as never)!;
    expect(e.kind).toBe('crash');
    expect(e.summary).toBe('crash java.lang.IllegalStateException');
    expect(e.data.frames).toBe('lan.mordor.calendar.widget.WeekFetcher.fetch(WeekFetcher.java:50)');
    expect(JSON.stringify(e)).not.toContain('Dentist');
  });

  it('are taken from the app plugin into the log, newest last', async () => {
    logDevice('error', { name: 'Error', message: 'later' });
    const time = Date.now() - 3_600_000;
    vi.stubGlobal('Capacitor', { Plugins: { CrashReports: { take: async () => ({ records: [{ source: 'exit', exception: 'ANR', time }] }) } } });
    expect(await importCrashRecords()).toBe(1);
    expect(deviceLog.value.map((e) => e.summary)).toEqual(['crash ANR', 'Error: later']);
    vi.unstubAllGlobals();
  });
});
