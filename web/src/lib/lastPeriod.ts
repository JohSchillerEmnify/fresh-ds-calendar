/** The calendar period last shown: reopening the app soon after the system ended it returns there, not to today. */

const KEY = 'cal.lastPeriod';
/** How long after the last visit an opening counts as a resume (30 minutes). */
export const RESUME_MS = 30 * 60 * 1000;
const PERIOD_PATH = /^\/(year|month|week|day)\/[\w-]+(\?.*)?$/;

/** Remembers the path (with its filter query) of the calendar period on screen. */
export function rememberPeriod(fullPath: string, now = Date.now()): void {
  if (!PERIOD_PATH.test(fullPath)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ path: fullPath, at: now })); } catch { /* storage unavailable: no resume */ }
}

/** The remembered period when the last visit is recent enough, else null. */
export function resumePath(now = Date.now()): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path?: unknown; at?: unknown } | null;
    if (typeof v?.path !== 'string' || typeof v.at !== 'number' || !PERIOD_PATH.test(v.path)) return null;
    return now - v.at <= RESUME_MS ? v.path : null;
  } catch {
    return null;
  }
}

/** Forgets the remembered period (the person was signed out: the next one on this device starts at today). */
export function forgetPeriod(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
