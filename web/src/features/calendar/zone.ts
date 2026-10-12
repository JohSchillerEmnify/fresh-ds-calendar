/** Wall-clock <-> RFC 3339 helpers for the calendar time zone (DST safe, mirrors server/src/lib/time.ts). */

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    fmts.set(tz, f);
  }
  return f;
}

/** Offset of `tz` at the instant `ms`, in minutes east of UTC. */
export function offsetMinutes(ms: number, tz: string): number {
  const p = Object.fromEntries(fmt(tz).formatToParts(ms).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

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
