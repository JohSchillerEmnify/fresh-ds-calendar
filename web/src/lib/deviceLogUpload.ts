/** Sending the error log to the server (feature device-log, ADR 0045): the button sends all of it, the opt-in pref only what is new. */
import { watch } from 'vue';
import { api, ApiError, type DeviceLogUpload } from '@/api/client';
import { importCrashRecords } from '@/native/crashReports';
import { usePrefsStore } from '@/stores/prefs';
import { deviceLog, markSent, runningVersion, type LogEntry } from './deviceLog';

/** The server refuses more than 256 KB; stay well below it. */
const MAX_BYTES = 200_000;
const UPLOAD_ROUTE = '/api/diag/device-log';
/** The automatic sending asks again when the app comes back, but not more often than this. */
const AUTO_EVERY_MS = 10 * 60_000;

export type SendOutcome = 'sent' | 'nothing' | 'failed';

/** The newest entries that fit the size the server takes, oldest first. */
function newestWithinLimit(list: readonly LogEntry[]): LogEntry[] {
  const out: LogEntry[] = [];
  let bytes = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    bytes += JSON.stringify(list[i]).length + 1;
    if (bytes > MAX_BYTES) break;
    out.unshift(list[i]!);
  }
  return out;
}

async function send(entries: LogEntry[]): Promise<SendOutcome> {
  if (!entries.length) return 'nothing';
  const body: DeviceLogUpload = { app: runningVersion(), exportedAt: new Date().toISOString(), entries: entries.map(({ sent: _sent, ...e }) => e) };
  try {
    await api.diagDeviceLog(body);
  } catch (e) {
    if (e instanceof ApiError) return 'failed';
    throw e;
  }
  markSent(new Set(entries));
  return 'sent';
}

/** The button: the whole log. */
export function sendDeviceLog(): Promise<SendOutcome> {
  return send(newestWithinLimit(deviceLog.value));
}

/** The entries the server does not have yet; the failed upload's own request entry is not one of them (it would send itself forever). */
export function sendNewEntries(): Promise<SendOutcome> {
  return send(newestWithinLimit(deviceLog.value.filter((e) => !e.sent && !(e.kind === 'api' && e.data.route === UPLOAD_ROUTE))));
}

let lastAuto = 0;

/** Sends the new entries when the person turned the automatic sending on; a no-op while it is off. */
export async function sendNewEntriesIfOn(force = false): Promise<void> {
  const prefs = usePrefsStore();
  if (!prefs.sendReportsAuto || (!force && Date.now() - lastAuto < AUTO_EVERY_MS)) return;
  lastAuto = Date.now();
  await sendNewEntries();
}

/** At start: takes the native crash records into the log, then sends the new entries if the pref is on; again whenever the app returns. */
export function startDeviceReports(): void {
  const prefs = usePrefsStore();
  const run = async (): Promise<void> => {
    await importCrashRecords();
    await sendNewEntriesIfOn();
  };
  // the pref is known only after the first load; until then nothing is sent
  if (prefs.loaded) void run();
  else {
    const stop = watch(() => prefs.loaded, (ok) => { if (ok) { stop(); void run(); } });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void run(); });
}
