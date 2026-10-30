/** Merging two devices' changes to one ink item (decision G5, ADR 0033). Plain ESM like the other shared files. */

/** Identity of a stroke: when it was drawn and where it starts (the same stroke has the same key on every device). */
export const inkKey = (s) => `${s.t ?? 0}|${s.p.length}|${s.p[0]?.join(',') ?? ''}`;

/** The strokes to draw: erase marks have no points. */
export const visibleInk = (strokes) => strokes.filter((s) => s.p.length > 0);

/** The item's strokes after a change (`after`, made at `at` from the strokes keyed `base`) is applied on top of `current`. */
export function mergeInk(current, after, base, at) {
  const known = new Set(base);
  const kept = new Set(after.map(inkKey));
  const gone = new Set(base.filter((k) => !kept.has(k)));
  // an erased line loses everything drawn before the erase, also what the device never saw
  const erased = base.length > 0 && after.length === 0;
  let clearedAt = Math.max(0, ...current.filter((s) => s.p.length === 0).map((s) => s.t ?? 0));
  if (erased) clearedAt = Math.max(clearedAt, at);
  const out = [];
  const seen = new Set();
  for (const s of [...visibleInk(current), ...after.filter((s) => !known.has(inkKey(s)))]) {
    const k = inkKey(s);
    if (seen.has(k) || gone.has(k) || (clearedAt > 0 && (s.t ?? 0) <= clearedAt)) continue;
    seen.add(k);
    out.push(s);
  }
  return clearedAt > 0 ? [{ p: [], t: clearedAt }, ...out] : out;
}
