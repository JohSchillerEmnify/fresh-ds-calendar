/** Shows a birthday once when two calendars hold it (feature birthdays); shared by the server and the app. */

/** Drops later copies of a birthday with the same `dupKey`, keeping an editable copy before a read-only one. */
export function dedupeBirthdays(items) {
  const best = new Map();
  for (const i of items) {
    if (!i.dupKey) continue;
    const cur = best.get(i.dupKey);
    // the same read-only state keeps the lower id, so a re-sync never flips the copy shown
    if (!cur || (!!cur.readOnly && !i.readOnly) || (!!cur.readOnly === !!i.readOnly && i.id < cur.id)) best.set(i.dupKey, i);
  }
  return items.filter((i) => !i.dupKey || best.get(i.dupKey) === i);
}
