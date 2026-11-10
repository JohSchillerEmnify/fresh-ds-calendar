/** One attribution line of the credits list; shared by the build-time generator and the app. */
export interface Credit {
  name: string;
  author?: string;
  license: string;
  url?: string;
}

/** Merge generated and hand-added credits: one entry per name (generated wins), sorted by name. */
export function mergeCredits(generated: Credit[], extra: Credit[]): Credit[] {
  const byName = new Map<string, Credit>();
  for (const c of [...extra, ...generated]) byName.set(c.name.toLowerCase(), c);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
