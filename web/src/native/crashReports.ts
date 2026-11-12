/** The Android app's crash records (feature device-log): the native plugin `CrashReports` hands them over once per start. */
import { addEntries, platform, runningVersion, type LogEntry } from '@/lib/deviceLog';

/** What the plugin sends per record (android/.../crash/CrashRecorder.java and ExitReasonReader.java). */
export interface CrashRecord {
  source?: string;
  exception?: string;
  causes?: string[];
  frames?: string[];
  thread?: string;
  app?: string;
  android?: number;
  time?: number;
}

interface CrashPlugin { take(): Promise<{ records?: CrashRecord[] }> }

const plugin = (): CrashPlugin | undefined => (window as unknown as { Capacitor?: { Plugins?: { CrashReports?: CrashPlugin } } }).Capacitor?.Plugins?.CrashReports;

/** Every text is checked against the shape of code (class names, frames, version numbers): a crash entry never carries free text. */
const CLASS = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const FRAME = /^[\w$.<>]+(\([\w$.]+(:\d+)?\)|\(Native Method\)|\(Unknown Source\))?$/;
const THREAD = /^[\w$.:#-]{1,40}$/;
const VERSION = /^[\w.-]{1,20}$/;
const MAX_FRAMES = 15;

const only = (v: unknown, re: RegExp): string | undefined => (typeof v === 'string' && re.test(v) ? v : undefined);

/** One log entry for a record, or null when it has no usable time. */
export function crashEntry(r: CrashRecord): LogEntry | null {
  if (typeof r.time !== 'number' || !Number.isFinite(r.time) || r.time <= 0) return null;
  const exception = only(r.exception, CLASS) ?? 'unknown';
  const frames = (r.frames ?? []).map((f) => only(f, FRAME)).filter((f): f is string => !!f).slice(0, MAX_FRAMES).join('\n');
  const causes = (r.causes ?? []).map((c) => only(c, CLASS)).filter((c): c is string => !!c).join(', ');
  const data: LogEntry['data'] = { exception, source: r.source === 'exit' ? 'exit' : 'java' };
  const thread = only(r.thread, THREAD);
  const nativeApp = only(r.app, VERSION);
  if (thread) data.thread = thread;
  if (nativeApp) data.nativeApp = nativeApp;
  if (typeof r.android === 'number') data.android = r.android;
  if (causes) data.causes = causes;
  if (frames) data.frames = frames;
  return { at: new Date(r.time).toISOString(), kind: 'crash', summary: `crash ${exception}`, app: runningVersion(), ...platform(), data };
}

/** Takes the native records into the device log; never throws. Returns how many entries were added. */
export async function importCrashRecords(): Promise<number> {
  try {
    const p = plugin();
    if (!p) return 0;
    const entries = ((await p.take()).records ?? []).map(crashEntry).filter((e): e is LogEntry => !!e);
    addEntries(entries);
    return entries.length;
  } catch { return 0; }
}
