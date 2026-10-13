/** Helpers over message catalogues that do not need the vue-i18n runtime (shared with `pnpm i18n:check`). */

/** Every leaf of a nested catalogue as a dotted key (`settings.language.label`), sorted. */
export function flattenKeys(messages: object, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(path);
    else if (v && typeof v === 'object') keys.push(...flattenKeys(v, path));
  }
  return keys.sort();
}

/** The keys in `source` that `target` does not define. */
export function missingKeys(source: object, target: object): string[] {
  const have = new Set(flattenKeys(target));
  return flattenKeys(source).filter((k) => !have.has(k));
}
