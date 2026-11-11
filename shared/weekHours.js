/**
 * The hours a week grid shows, one rule for the Android week widget (`WeekLayout.hourRange`) and the iPhone widget: from the
 * earliest start to the latest end of the week's timed entries (minutes since midnight), at least six hours (the later side
 * grows first, then the earlier), within 0 to 24; 8 to 18 when there are none. The script of the iPhone widget carries a copy
 * of this function's text (a test keeps them equal); the Java copy must stay in step.
 */
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
