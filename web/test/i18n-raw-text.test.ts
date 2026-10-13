import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { rawText, type Node } from '../src/i18n/raw-text';

/**
 * Components already moved to the message catalogue (ARCHITECTURE "i18n", "Moving the remaining strings"). Add a
 * file here when its area is migrated; the check then keeps hard-coded UI text out of its template.
 */
const MIGRATED = [
  'src/views/SettingsView.vue',
  'src/components/m3/NavigationBar.vue',
  'src/components/m3/NavigationRail.vue',
];
/**
 * Strings that other feature branches added before the i18n slice landed. They move into the catalogue with their area
 * (the per-area migration, ARCHITECTURE "i18n"); delete each entry then. Nothing else may be hard-coded.
 */
const NOT_YET_MIGRATED: Record<string, string[]> = {
  'src/views/SettingsView.vue': [
    'Left-handed mode', 'Mirrors the phone layout so the main controls sit under the left thumb', 'label="Left-handed mode"',
    'Plant', 'label="Plant"', 'Sunflowers', 'Applies to the Sunflower field scene', 'label="Sunflowers"',
    'Own themes (AI and import)', 'Experimental: a prompt for an AI and the import of its theme file in the theme menu',
    'label="Own themes (AI and import)"',
  ],
};
describe('migrated components have no hard-coded UI text', () => {
  it.each(MIGRATED)('%s', (file) => {
    const { descriptor } = parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
    const known = NOT_YET_MIGRATED[file] ?? [];
    expect(rawText(descriptor.template!.ast as unknown as Node).filter((x) => !known.includes(x))).toEqual([]);
  });
});
