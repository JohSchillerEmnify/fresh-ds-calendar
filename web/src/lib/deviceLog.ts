/**
 * Error log on this device (feature device-log): the last entries in `localStorage`, kept over sign-out (every text is scrubbed: no personal data).
 */
import { shallowRef } from 'vue';
import { isNativeApp } from '@/native/app';
import { shareFileNative } from '@/native/shareFile';
import { isIos, isStandalone } from '@/pwa/install';

export const DEVICE_LOG_KEY = 'calendar.deviceLog';
export const MAX_ENTRIES = 500;
const MAX_TEXT = 300;
/** The build version (as `pwa/update` reads it; not imported: the API client imports this module). */
const runningVersion = (): string => document.documentElement.dataset.appVersion ?? __APP_VERSION__;

export type LogKind = 'error' | 'api' | 'outbox' | 'sw' | 'sync' | 'trace' | 'decision';
export type LogData = Record<string, string | number | boolean | undefined>;

export interface LogEntry {
  at: string;
  kind: LogKind;
  summary: string;
  app: string;
  platform: 'ios' | 'android' | 'desktop';
  standalone: boolean;
  native: boolean;
  data: LogData;
}

/** Oldest first; the page shows them reversed. */
export const deviceLog = shallowRef<LogEntry[]>(read());

function read(): LogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE_LOG_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as LogEntry[]) : [];
  } catch { return []; }
}
function write(list: LogEntry[]): void {
  deviceLog.value = list;
  try { localStorage.setItem(DEVICE_LOG_KEY, JSON.stringify(list)); } catch { /* storage full or blocked: the log lives until the page closes */ }
}
/** Reads the stored log again (tests; another tab may have written). */
export function reloadDeviceLog(): void { deviceLog.value = read(); }
export function clearDeviceLog(): void { write([]); }

// --- redaction -------------------------------------------------------------------------------------------------------
/** The fixed words of the API's paths (spec/API.md); any other segment is an id. */
const ROUTE_WORDS = new Set(('api auth me signout signout-all backup restore health config release-notes calendars changes prefs canvas templates '
  + 'theme themes reminders tasks-calendar push key subscriptions plan items summary events tasklists ink order share leave people categories '
  + 'shares open all-open archive settings motivation streak checkin diag sync-error demo reset').split(' '));

/** An API path as its route template: ids become `:id`, the query goes. */
export function routeOf(path: string): string {
  const p = path.split(/[?#]/)[0]!;
  if (!p.startsWith('/api/')) return p;
  return p.split('/').map((s) => (s === '' || ROUTE_WORDS.has(s) ? s : ':id')).join('/');
}

/** A property path a browser names in its message (`e.change.id`): code, not data. */
const CODE_PATH = /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\(\)|\[\d+\])+$/;

/** Text without personal data: e-mail addresses, long tokens, host names, queries and quoted text go. */
export function scrub(text: string): string {
  return text
    .replace(/https?:\/\/[^/\s'"]+(\/[^\s'")]*)?/g, (_m, path: string | undefined) => (path ? routeOf(path) : ''))
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '<token>')
    .replace(/[A-Za-z0-9_\-+/=.]{32,}/g, '<token>')
    .replace(/(["'“‘])([^"'“”‘’]*)(["'”’])/g, (m, a: string, inner: string, b: string) => (CODE_PATH.test(inner) ? m : `${a}…${b}`))
    .slice(0, MAX_TEXT);
}

/** Name, message and the first lines of the stack of anything thrown, scrubbed. */
export function errorFacts(e: unknown): { errorName: string; errorMessage: string; stack?: string } {
  if (e instanceof Error) {
    const stack = e.stack?.split('\n').slice(0, 4).join('\n');
    return { errorName: e.name, errorMessage: scrub(e.message), ...(stack ? { stack: scrub(stack) } : {}) };
  }
  return { errorName: typeof e, errorMessage: typeof e === 'string' ? scrub(e) : '' };
}

// --- writing ---------------------------------------------------------------------------------------------------------
function platform(): Pick<LogEntry, 'platform' | 'standalone' | 'native'> {
  try {
    const ua = navigator.userAgent;
    return {
      platform: isIos() ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop',
      standalone: isStandalone(),
      native: 'Capacitor' in window,
    };
  } catch { return { platform: 'desktop', standalone: false, native: false }; }
}

const join = (...parts: Array<string | number | undefined | false>): string => parts.filter((p) => p !== undefined && p !== false && p !== '').join(' ');

/** The one line the page shows for an entry. */
function summarize(kind: LogKind, d: LogData): string {
  const err = d.errorName ? `${d.errorName}: ${d.errorMessage ?? ''}` : '';
  switch (kind) {
    case 'api': return join(d.method as string, d.route as string, d.status as number, d.code as string);
    case 'outbox': return join(`${d.op} ${d.decision}`, d.method as string, d.route as string, d.status as number, d.code as string, !d.status && err);
    case 'sync': return join('sync', d.task as string, d.status as number, d.code as string, err);
    case 'decision': return join(d.what as string, d.decision as string, d.method as string, d.route as string, d.status as number, d.code as string, !d.status && err);
    case 'trace': return join(d.step as string, d.detail as string);
    case 'sw': return join('service worker', d.step as string, err);
    default: return d.name ? `${d.prefix ? `${d.prefix} ` : ''}${d.name}: ${d.message ?? ''}` : String(d.message ?? '');
  }
}

/** Appends an entry; every text value is scrubbed first. Never throws. */
export function logDevice(kind: LogKind, data: LogData): void {
  try {
    const clean: LogData = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) clean[k] = typeof v === 'string' ? scrub(v) : v;
    const entry: LogEntry = { at: new Date().toISOString(), kind, summary: scrub(summarize(kind, clean)), app: runningVersion(), ...platform(), data: clean };
    write([...deviceLog.value, entry].slice(-MAX_ENTRIES));
  } catch { /* the log must never break the app */ }
}

/** Logs errors nobody caught and promise rejections nobody handled. Returns the uninstall function. */
export function installDeviceLog(target: EventTarget = window): () => void {
  const onError = (ev: Event): void => {
    const e = ev as ErrorEvent;
    const f = errorFacts(e.error ?? e.message);
    logDevice('error', { name: f.errorName, message: f.errorMessage, stack: f.stack });
  };
  const onRejection = (ev: Event): void => {
    const f = errorFacts((ev as PromiseRejectionEvent).reason);
    logDevice('error', { prefix: 'unhandled', name: f.errorName, message: f.errorMessage, stack: f.stack });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => { target.removeEventListener('error', onError); target.removeEventListener('unhandledrejection', onRejection); };
}

// --- leaving the device ----------------------------------------------------------------------------------------------
export function exportDeviceLog(): string {
  return JSON.stringify({ app: runningVersion(), exportedAt: new Date().toISOString(), entries: deviceLog.value }, null, 2);
}
const fileName = (ext: 'json' | 'txt' = 'json'): string => `calendar-error-log-${new Date().toISOString().slice(0, 10)}.${ext}`;

/** What Share or Download did; `failed` means nothing left the device, so the caller must offer another way out. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** The app's WebView has neither Web Share nor blob downloads: the file goes through the native share sheet. */
async function viaNativeSheet(): Promise<ShareOutcome> {
  const r = await shareFileNative(fileName(), exportDeviceLog());
  return r === 'unavailable' ? 'failed' : r;
}

export async function downloadDeviceLog(): Promise<ShareOutcome> {
  if (isNativeApp()) return viaNativeSheet();
  const url = URL.createObjectURL(new Blob([exportDeviceLog()], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** The share sheet with the log as a file (native sheet in the app; Web Share elsewhere, as .txt: Chrome refuses .json), else a download. */
export async function shareDeviceLog(): Promise<ShareOutcome> {
  if (isNativeApp()) return viaNativeSheet();
  // no await before navigator.share: it needs the click's user activation
  const file = new File([exportDeviceLog()], fileName('txt'), { type: 'text/plain' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  return downloadDeviceLog();
}
