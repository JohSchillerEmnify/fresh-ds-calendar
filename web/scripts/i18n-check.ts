/**
 * `pnpm i18n:check`: lists the message keys each catalogue lacks compared with `en`.
 *
 * Missing keys in `de` are errors (exit 1); missing keys in the fun languages are reported as info, because they
 * fall back to German and may stay partial. Run with Node's built-in TypeScript support.
 */
import { de } from '../src/i18n/locales/de.ts';
import { deXColdmirror } from '../src/i18n/locales/de-x-coldmirror.ts';
import { deXMainfr } from '../src/i18n/locales/de-x-mainfr.ts';
import { en } from '../src/i18n/locales/en.ts';
import { flattenKeys, missingKeys } from '../src/i18n/keys.ts';

const total = flattenKeys(en).length;
let failed = false;
for (const [name, catalogue, mustBeComplete] of [
  ['de', de, true],
  ['de-x-mainfr', deXMainfr, false],
  ['de-x-coldmirror', deXColdmirror, false],
] as const) {
  const missing = missingKeys(en, catalogue);
  const label = mustBeComplete ? 'ERROR' : 'info';
  console.log(`${name}: ${total - missing.length}/${total} keys${missing.length ? ` (${label}: ${missing.length} missing)` : ''}`);
  if (mustBeComplete && missing.length) failed = true;
  if (mustBeComplete) for (const k of missing) console.log(`  missing ${k}`);
}
process.exit(failed ? 1 : 0);
