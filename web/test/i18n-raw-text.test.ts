import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

/**
 * Components already moved to the message catalogue (ARCHITECTURE "i18n", "Moving the remaining strings"). Add a
 * file here when its area is migrated; the check then keeps hard-coded UI text out of its template.
 */
const MIGRATED = [
  'src/views/SettingsView.vue',
  'src/components/m3/NavigationBar.vue',
  'src/components/m3/NavigationRail.vue',
];
/** Static attributes that carry text a person reads or a screen reader speaks. */
const TEXT_ATTRS = new Set(['label', 'aria-label', 'title', 'placeholder', 'alt']);
const HAS_WORD = /\p{L}{2,}/u;

interface Node { type: number; content?: string; props?: Array<{ type: number; name: string; value?: { content: string } }>; children?: Node[] }

/** Hard-coded text in a template: static text nodes and static text attributes that contain a word. */
function rawText(node: Node, found: string[] = []): string[] {
  if (node.type === 2 && node.content && HAS_WORD.test(node.content)) found.push(node.content.trim());
  for (const p of node.props ?? []) {
    if (p.type === 6 && TEXT_ATTRS.has(p.name) && p.value && HAS_WORD.test(p.value.content)) found.push(`${p.name}="${p.value.content}"`);
  }
  for (const c of node.children ?? []) rawText(c, found);
  return found;
}

describe('migrated components have no hard-coded UI text', () => {
  it.each(MIGRATED)('%s', (file) => {
    const { descriptor } = parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
    expect(rawText(descriptor.template!.ast as unknown as Node)).toEqual([]);
  });
});
