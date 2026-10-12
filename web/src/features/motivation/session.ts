/** "Once per session" flags (sessionStorage, with an in-memory fallback when storage is blocked). */
const mem = new Set<string>();

export function onceFlag(key: string): boolean {
  const k = `motion:${key}`;
  if (mem.has(k)) return false;
  mem.add(k);
  try {
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
  } catch {
    /* storage blocked: memory flag only */
  }
  return true;
}

/** Test hook. */
export function __resetOnce(): void {
  mem.clear();
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith('motion:')).forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
