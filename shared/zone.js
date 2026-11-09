/** Time zone offsets with Intl only (no date library), shared by the server and the web app so the two cannot drift apart. */

const fmtCache = new Map();
/** One cached formatter per zone: building an Intl.DateTimeFormat is slow. */
function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** The wall-clock fields of the instant `ms` in `tz`. */
export function zonedParts(ms, tz) {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset of the zone from UTC at the instant, in minutes east of UTC (Berlin summer: +120). */
export function offsetMinutes(ms, tz) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}
