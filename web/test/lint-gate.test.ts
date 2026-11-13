/** The lint gate of ADR 0032: raw buttons, form fields, hand-made roles and clicks on plain elements stay inside web/src/components/m3. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM config module without types
import { GATE_ALLOWLIST } from '../../eslint.allowlist.mjs';

const root = resolve(__dirname, '../..');
const OUTSIDE = 'web/src/features/tasklists/Example.vue';
const BUTTON = '<template><button type="button">Go</button></template>\n';

/** Lints `src` as if it were the file at `path` (relative to the repository root) and returns the kit-gate violations. */
async function lint(path: string, src: string) {
  const [res] = await new ESLint({ cwd: root }).lintText(src, { filePath: resolve(root, path) });
  return res.messages.filter((m) => m.ruleId === 'vue/no-restricted-html-elements' || m.ruleId === 'vue/no-restricted-syntax');
}

describe('no raw buttons outside m3', () => {
  it('rejects a hand-styled button outside the m3 components and names it', async () => {
    const found = await lint(OUTSIDE, BUTTON);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe(2);
    expect(found[0].message).toContain('no raw buttons outside m3');
  });

  it('lets a button element inside web/src/components/m3 pass', async () => {
    expect(await lint('web/src/components/m3/Example.vue', BUTTON)).toEqual([]);
  });
});

describe('no raw fields, roles or clicks on plain elements outside m3', () => {
  const cases: [string, string, string][] = [
    ['an input', '<template><input type="text" /></template>', 'no raw form fields'],
    ['a textarea', '<template><textarea /></template>', 'no raw form fields'],
    ['a select', '<template><select><option>a</option></select></template>', 'no raw form fields'],
    ['role button', '<template><span role="button" tabindex="0">x</span></template>', 'no hand-made role'],
    ['role checkbox', '<template><div role="checkbox" /></template>', 'no hand-made role'],
    ['role dialog', '<template><div role="dialog" /></template>', 'no hand-made role'],
    ['role option', '<template><li role="option">x</li></template>', 'no hand-made role'],
    ['a click on a div', '<template><div @click="go">x</div></template>', 'no click on a plain element'],
    ['a click on a header', '<template><header @click="go">x</header></template>', 'no click on a plain element'],
  ];
  it.each(cases)('rejects %s outside m3', async (_name, src, message) => {
    const found = await lint(OUTSIDE, src);
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(message);
  });

  it('lets the m3 components use them', async () => {
    for (const [, src] of cases) expect(await lint('web/src/components/m3/Example.vue', src)).toEqual([]);
  });

  it('allows a click on a kit component and a plain role such as group', async () => {
    expect(await lint(OUTSIDE, '<template><Pressable @click="go"><div role="group" /></Pressable></template>')).toEqual([]);
  });
});

describe('the allowlist only shrinks', () => {
  const PATTERN = { field: /<(input|textarea|select)\b/, role: /role="(button|checkbox|dialog|option)"|:role=/, click: /@click/ } as const;
  it.each(GATE_ALLOWLIST as { file: string; allow: (keyof typeof PATTERN)[]; reason: string }[])('$file still needs every release it holds', ({ file, allow, reason }) => {
    const text = readFileSync(resolve(root, file), 'utf8');
    expect(reason, 'a reason').not.toBe('');
    for (const kind of allow) expect(PATTERN[kind].test(text), `${file} no longer has a ${kind} to release: drop it from the allowlist`).toBe(true);
  });
});
