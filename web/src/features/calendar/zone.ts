/** Wall-clock <-> RFC 3339 helpers for the calendar time zone (DST safe; the offset lookup is shared with the server). */
import { offsetMinutes } from '@calendar/shared/zone';

export { offsetMinutes };

/** Wall-clock fields -> minutes since 1970 as if they were UTC (pure arithmetic, no zone). */
export function wallMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) / 60000;
}
export function fromWallMinutes(min: number): { date: string; time: string } {
  const d = new Date(min * 60000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return { date: `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

function sign(off: number): string {
  const a = Math.abs(off);
  return `${off < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' + 'HH:mm' in `tz` -> '2026-10-14T09:00:00+02:00'. In a DST gap the offset before the jump is used. */
export function localToIso(date: string, time: string, tz: string): string {
  const wall = wallMinutes(date, time) * 60000;
  const o1 = offsetMinutes(wall - 43_200_000, tz);
  const o2 = offsetMinutes(wall + 43_200_000, tz);
  let off = o1;
  for (const o of o1 === o2 ? [o1] : [o1, o2]) {
    if (offsetMinutes(wall - o * 60000, tz) === o) { off = o; break; }
  }
  return `${date}T${time}:00${sign(off)}`;
}
