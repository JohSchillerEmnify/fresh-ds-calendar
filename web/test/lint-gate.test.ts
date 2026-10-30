/** The lint gate of ADR 0032: a raw <button> outside web/src/components/m3 is an error that names the component. */
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const SRC = '<template><button type="button">Go</button></template>\n';

/** Lints `SRC` as if it were the file at `path` (relative to the repository root) and returns the rule violations. */
async function lint(path: string) {
  const [res] = await new ESLint({ cwd: root }).lintText(SRC, { filePath: resolve(root, path) });
  return res.messages.filter((m) => m.ruleId === 'vue/no-restricted-html-elements');
}

describe('no raw buttons outside m3', () => {
  it('rejects a hand-styled button outside the m3 components and names it', async () => {
    const found = await lint('web/src/features/tasklists/Example.vue');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe(2);
    expect(found[0].message).toContain('no raw buttons outside m3');
  });

  it('lets a button element inside web/src/components/m3 pass', async () => {
    expect(await lint('web/src/components/m3/Example.vue')).toEqual([]);
  });
});
