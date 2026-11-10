import license, { type Dependency } from 'rollup-plugin-license';
import type { Plugin } from 'vite';
import type { Credit } from './src/credits/types';

/** A repository URL as a browsable https link (npm also writes git+https, git:// and github: forms). */
export function webUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const u = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/').replace(/\.git$/, '');
  return u.startsWith('http') ? u : undefined;
}

/** The credits of the production dependencies the bundle really contains, one per package name. */
export function toCredits(deps: readonly Dependency[]): Credit[] {
  const byName = new Map<string, Credit>();
  for (const d of deps) {
    if (!d.name || byName.has(d.name)) continue;
    const repo = typeof d.repository === 'string' ? d.repository : d.repository?.url;
    const author = d.author?.name ?? d.contributors?.[0]?.name;
    const url = webUrl(d.homepage) ?? webUrl(repo);
    byName.set(d.name, { name: d.name, ...(author ? { author } : {}), license: d.license ?? 'unknown', ...(url ? { url } : {}) });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Writes `credits.json` into the build from what the bundle contains (rollup-plugin-license); the app merges its extra credits in. */
export function creditsPlugin(): Plugin[] {
  let credits: Credit[] = [];
  return [
    license({ thirdParty: { includePrivate: false, output: (deps: Dependency[]) => { credits = toCredits(deps); } } }) as Plugin,
    { name: 'credits-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'credits.json', source: JSON.stringify(credits) }); } },
  ];
}
