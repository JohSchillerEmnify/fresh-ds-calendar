/** Lower case, no accents, dashes as spaces, single spaces: what a search query and the texts it looks in are compared as (settings search, item search). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[-‐–—_]/g, ' ').replace(/\s+/g, ' ').trim();
}
