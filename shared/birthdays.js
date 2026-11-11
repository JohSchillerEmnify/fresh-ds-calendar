/** Shows a birthday once when two sources hold it (features birthdays, contact-birthdays); shared by the server and the app. */

/** The key of a birthday event linked to a contact: the same contact, kind and day is the same birthday. */
export function birthdayContactKey(resourceName, kind, date) {
  return `c:${resourceName}|${kind}|${date}`;
}

/** The key of a birthday known by its title only (case-insensitive) on a day. */
export function birthdayTitleKey(title, date) {
  return `t:${title.toLowerCase()}|${date}`;
}

/** The day a yearly date falls on in `year`; 29 February falls on the last day of February in years without one. */
export function yearlyDate(year, month, day) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const d = month === 2 && day === 29 && !leap ? 28 : day;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The age a birthday with a known birth year turns on `date` (`YYYY-MM-DD`). */
export function ageOn(birthYear, date) {
  return Number(date.slice(0, 4)) - birthYear;
}

const rank = (i) => (i.readOnlyReason?.kind === 'contact' ? 2 : i.readOnly ? 1 : 0);

/**
 * Drops later copies of a birthday that share a `dupKey` (or the `dupAlt` of a contact date): an editable copy wins over a
 * read-only calendar one, which wins over a contact date.
 */
export function dedupeBirthdays(items) {
  const keysOf = (i) => [i.dupKey, i.dupAlt].filter(Boolean);
  const groupOf = new Map();
  const groups = [];
  for (const i of items) {
    const keys = keysOf(i);
    if (!keys.length) continue;
    const hit = [...new Set(keys.map((k) => groupOf.get(k)).filter(Boolean))];
    const g = hit[0] ?? { best: i };
    if (!hit.length) groups.push(g);
    for (const o of hit.slice(1)) {
      g.best = better(g.best, o.best);
      o.best = null;
      for (const [k, v] of groupOf) if (v === o) groupOf.set(k, g);
    }
    g.best = better(g.best, i);
    for (const k of keys) groupOf.set(k, g);
  }
  return items.filter((i) => {
    const keys = keysOf(i);
    return !keys.length || groupOf.get(keys[0]).best === i;
  });
}

// the same rank keeps the lower id, so a re-sync never flips the copy shown
function better(a, b) {
  return rank(b) < rank(a) || (rank(b) === rank(a) && b.id < a.id) ? b : a;
}
