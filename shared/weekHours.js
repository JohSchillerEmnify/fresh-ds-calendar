/** The hours of a week grid, one rule for the Android week widget (`WeekLayout.hourRange`, keep in step) and the iPhone widget:
 * earliest start to latest end in minutes, at least six hours (later side grows first), within 0 to 24, else 8 to 18. */
export function hourRange(segments) {
  const defaultFrom = 8, defaultTo = 18, minSpan = 6;
  if (!segments.length) return [defaultFrom, defaultTo];
  let first = Math.max(0, Math.floor(Math.min(...segments.map((g) => g.start)) / 60));
  let last = Math.min(24, Math.ceil(Math.max(...segments.map((g) => Math.max(g.end, g.start + 1))) / 60));
  while (last - first < minSpan) {
    if (last < 24) last++;
    if (last - first < minSpan && first > 0) first--;
  }
  return [first, last];
}
