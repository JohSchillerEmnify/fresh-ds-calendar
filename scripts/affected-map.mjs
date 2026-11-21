// Path-to-scenario map for `pnpm e2e:affected` (e2e/affected-map.json) and its gate on unmapped source files.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Source trees whose every file must be mapped (or marked "no e2e"). */
export const GATED = /^(web\/src|server\/src|shared)\//;

/** `**` crosses folders, `*` stays in one; no other glob syntax is used in the map. */
export function globRegex(g) {
  const re = g.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*\*\/|\*\*|\*/g, (m) => ({ '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*' })[m]);
  return new RegExp(`^${re}$`);
}

export function loadMap(root) {
  const m = JSON.parse(readFileSync(resolve(root, 'e2e/affected-map.json'), 'utf8'));
  const compile = (r, noE2e) => ({ ...r, noE2e, res: r.paths.map(globRegex) });
  return [...m.noE2e.map((r) => compile(r, true)), ...m.rules.map((r) => compile(r, false))];
}

/** First rule that matches the path, or undefined. */
export const ruleFor = (rules, path) => rules.find((r) => r.res.some((re) => re.test(path)));

export const unmappedFiles = (rules, files) => files.filter((f) => GATED.test(f) && !ruleFor(rules, f));
